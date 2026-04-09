<script setup lang="ts">
import ExportWorker from '../workers/export.worker?worker'
import WebCodecsExportWorker from '../workers/webcodecs-export.worker?worker'

const store = useAlignTaskStore()
const { probeFile } = useMediaProbe()
const { prepareForAlignment } = useAudioPreparation()
const { align } = useAlignApi()
const { deliver } = useExportDelivery()
const { prepareMixedAudio } = usePreviewExporter()
const toast = useToast()

type TrackId = 'clip1' | 'clip2'

const trackControls = reactive<Record<TrackId, { mute: boolean }>>({
    clip1: { mute: false },
    clip2: { mute: false },
})
const previewObjectUrl = ref<string | null>(null)
const timelineCursorSec = ref(0)
const supportsAudioEncoder = ref(true)
const hasSelectedMedia = computed(() => Boolean(store.clip1File && store.clip2File))
const hasStartedAlignFlow = computed(() => store.task.phase !== 'idle' || Boolean(store.alignResult))
const showInputPanel = computed(() => !hasStartedAlignFlow.value)
const showTimelinePanel = computed(() => hasSelectedMedia.value && hasStartedAlignFlow.value)
const isAligning = computed(() => store.task.phase === 'aligning')
const isExporting = computed(() => store.task.phase === 'exporting')
const canStartAlign = computed(() => hasSelectedMedia.value && !isAligning.value && !isExporting.value)

const currentStep = computed(() => {
    const phase = store.task.phase
    if (phase === 'idle' || phase === 'probing')
        return 1
    if (phase === 'aligning')
        return 2
    return 3
})

const timelineDurationSec = computed(() => {
    const clip1Start = store.alignResult?.clip1StartSec ?? 0
    const clip2Start = store.alignResult?.clip2StartSec ?? 0
    const clip1Duration = store.clip1Probe?.durationSec ?? 0
    const clip2Duration = store.clip2Probe?.durationSec ?? 0
    return Math.max(clip1Start + clip1Duration, clip2Start + clip2Duration, store.alignResult?.outputDurationSec ?? 0, 1)
})

const timelineTracks = computed(() => {
    const total = timelineDurationSec.value || 1
    return [
        {
            id: 'clip1' as const,
            label: 'Clip1',
            subtitle: store.clip1File?.name || '手元视频',
            colorClass: 'from-primary/80 to-primary',
            glowClass: 'shadow-primary/30',
            startSec: store.alignResult?.clip1StartSec ?? 0,
            durationSec: store.clip1Probe?.durationSec ?? 0,
            gainDb: store.config.audio1GainDb,
            muted: trackControls.clip1.mute,
            widthPercent: ((store.clip1Probe?.durationSec ?? 0) / total) * 100,
            offsetPercent: ((store.alignResult?.clip1StartSec ?? 0) / total) * 100,
        },
        {
            id: 'clip2' as const,
            label: 'Clip2',
            subtitle: store.clip2File?.name || '对齐音轨',
            colorClass: 'from-secondary/80 to-secondary',
            glowClass: 'shadow-secondary/30',
            startSec: store.alignResult?.clip2StartSec ?? 0,
            durationSec: store.clip2Probe?.durationSec ?? 0,
            gainDb: store.config.audio2GainDb,
            muted: trackControls.clip2.mute,
            widthPercent: ((store.clip2Probe?.durationSec ?? 0) / total) * 100,
            offsetPercent: ((store.alignResult?.clip2StartSec ?? 0) / total) * 100,
        },
    ]
})

const previewCursorPercent = computed(() => {
    if (timelineDurationSec.value <= 0)
        return 0
    return (timelineCursorSec.value / timelineDurationSec.value) * 100
})

const currentPreviewOffsetSec = computed(() => {
    const clipStart = store.alignResult?.clip1StartSec ?? 0
    return Math.max(0, timelineCursorSec.value - clipStart)
})

function toggleMute(trackId: TrackId) {
    trackControls[trackId].mute = !trackControls[trackId].mute
}

function resetAll() {
    trackControls.clip1.mute = false
    trackControls.clip2.mute = false
    timelineCursorSec.value = 0
    if (previewObjectUrl.value) {
        URL.revokeObjectURL(previewObjectUrl.value)
        previewObjectUrl.value = null
    }
    store.clip1File = null
    store.clip2File = null
    store.clip1Probe = null
    store.clip2Probe = null
    store.resetTask()
}

function updateTimelineCursor(value: number) {
    timelineCursorSec.value = Math.max(0, Math.min(value, timelineDurationSec.value))
}

watch(() => store.clip1File, (file, previousFile) => {
    if (previewObjectUrl.value) {
        URL.revokeObjectURL(previewObjectUrl.value)
        previewObjectUrl.value = null
    }
    if (file)
        previewObjectUrl.value = URL.createObjectURL(file)
    if (previousFile !== file)
        updateTimelineCursor(store.alignResult?.clip1StartSec ?? 0)
})

watch(() => store.alignResult, (result) => {
    updateTimelineCursor(result?.clip1StartSec ?? 0)
}, { deep: true })

onMounted(() => {
    supportsAudioEncoder.value = typeof AudioEncoder !== 'undefined'
})

onBeforeUnmount(() => {
    if (previewObjectUrl.value)
        URL.revokeObjectURL(previewObjectUrl.value)
})

async function assignFile(kind: 'clip1' | 'clip2', file: File | null) {
    if (!file) {
        if (kind === 'clip1') {
            store.clip1File = null
            store.clip1Probe = null
        }
        else {
            store.clip2File = null
            store.clip2Probe = null
        }
        return
    }
    mediaInputSchema.parse({ name: file.name, type: file.type || 'application/octet-stream', size: file.size })
    const probe = await probeFile(file)
    if (kind === 'clip1') {
        store.clip1File = file
        store.clip1Probe = probe
    }
    else {
        store.clip2File = file
        store.clip2Probe = probe
    }
}

async function runAlign() {
    if (!store.clip1File || !store.clip2File)
        return

    try {
        alignConfigSchema.parse(store.config)
        store.task.phase = 'aligning'
        store.task.progress = 0.2
        store.task.error = undefined
        store.task.message = '正在提取音轨并请求对齐...'

        const [clip1Audio, clip2Audio] = await Promise.all([
            prepareForAlignment(store.clip1File, store.config.audioSr),
            prepareForAlignment(store.clip2File, store.config.audioSr),
        ])
        store.clip1PreparedAudio = clip1Audio
        store.clip2PreparedAudio = clip2Audio

        const response = await align({
            config: store.config,
            clip1FileName: store.clip1File.name,
            clip2FileName: store.clip2File.name,
            clip1AudioBase64: clip1Audio.base64,
            clip2AudioBase64: clip2Audio.base64,
        })

        store.alignResult = response.result
        store.task.phase = 'ready'
        store.task.progress = 0.5
        store.task.message = '对齐完成，等待导出。'
        toast.show(`对齐完成，置信度 ${(response.result.confidence * 100).toFixed(0)}%`, 'success')
    }
    catch (error) {
        store.task.phase = 'failed'
        store.task.error = error instanceof Error ? error.message : '对齐失败'
        toast.show(store.task.error ?? '对齐失败', 'error')
    }
}

async function runExport() {
    if (!store.alignResult || !store.clip1File || !store.clip2File)
        return

    const plan = buildExportPlan(store.alignResult, {
        audio1GainDb: store.config.audio1GainDb,
        audio2GainDb: store.config.audio2GainDb,
        audioReverbWet: store.config.audioReverbWet,
        muteClip1: trackControls.clip1.mute,
        muteClip2: trackControls.clip2.mute,
    })

    store.task.phase = 'exporting'
    store.task.progress = 0.6
    store.task.error = undefined
    store.task.outputSavedPath = undefined
    store.task.message = '正在执行本地完整导出...'

    if (store.outputObjectUrl) {
        URL.revokeObjectURL(store.outputObjectUrl)
        store.outputObjectUrl = null
    }

    try {
        let mixedAudio = await prepareMixedAudio({
            clip1File: store.clip1File,
            clip2File: store.clip2File,
            plan,
            onProgress: (progress, message) => {
                store.task.progress = progress
                store.task.message = message
            },
        })

        let clip1Buffer = await store.clip1File.arrayBuffer()
        const transferables = [clip1Buffer, ...mixedAudio.channels]
        const worker = store.exportMethod === 'webcodecs'
            ? new WebCodecsExportWorker()
            : new ExportWorker()

        const result = await new Promise<{ blob: Blob, fileName: string }>((resolve, reject) => {
            const cleanupWorker = () => {
                worker.onmessage = null
                worker.onerror = null
                worker.terminate()
            }

            worker.onmessage = (event: MessageEvent<ExportWorkerMessage>) => {
                if (event.data.type === 'progress') {
                    store.task.progress = event.data.progress
                    store.task.message = event.data.message
                    return
                }
                if (event.data.type === 'success') {
                    cleanupWorker()
                    resolve({ blob: event.data.blob, fileName: event.data.fileName })
                    return
                }
                cleanupWorker()
                reject(new Error(event.data.error))
            }

            worker.onerror = (event) => {
                cleanupWorker()
                reject(new Error(event.message || 'Worker 导出失败'))
            }

            const payload: ExportWorkerRequest = {
                type: 'export-preview',
                payload: {
                    plan,
                    clip1: {
                        fileName: store.clip1File?.name || 'clip1.mp4',
                        mimeType: store.clip1File?.type || 'video/mp4',
                        size: store.clip1File?.size || clip1Buffer.byteLength,
                        width: store.clip1Probe?.width,
                        height: store.clip1Probe?.height,
                        buffer: clip1Buffer,
                    },
                    clip2: {
                        fileName: store.clip2File?.name || 'clip2.mp4',
                        mimeType: store.clip2File?.type || 'video/mp4',
                        size: store.clip2File?.size || 0,
                        width: store.clip2Probe?.width,
                        height: store.clip2Probe?.height,
                    },
                    mixedAudio,
                },
            }

            worker.postMessage(payload, transferables)
        })

        clip1Buffer = new ArrayBuffer(0)
        for (let index = 0; index < mixedAudio.channels.length; index += 1) {
            mixedAudio.channels[index] = new ArrayBuffer(0)
        }
        mixedAudio.channels.length = 0
        mixedAudio = { sampleRate: 0, numberOfChannels: 0, length: 0, channels: [] }

        const delivered = await deliver(result.blob, result.fileName)
        store.outputObjectUrl = delivered.objectUrl || null
        store.task.phase = 'done'
        store.task.progress = 1
        store.task.outputFileName = result.fileName
        store.task.outputSavedPath = delivered.savedPath
        store.task.message = delivered.savedPath ? '导出完成，已写入设备并打开分享面板。' : '导出完成，已开始下载。'
        toast.show('导出完成', 'success')
    }
    catch (error) {
        store.task.phase = 'ready'
        store.task.progress = 0.5
        store.task.message = '导出失败，可重试。'
        store.task.error = error instanceof Error ? error.message : '导出失败'
        toast.show(store.task.error ?? '导出失败', 'error')
    }
}
</script>

<template>
    <div class="relative flex min-h-screen flex-col bg-cover bg-center bg-fixed" style="background-image: url('https://cdn.assets.turou.fun/static/atri_bg.webp')">
        <div class="pointer-events-none absolute inset-0 bg-black/60" />
        <div class="relative z-10 flex min-h-screen flex-col text-white">
            <AppHeader />

            <!-- Hero Section (Dark) -->
            <section class="py-20">
                <div class="mx-auto max-w-245 px-4 md:px-6">
                    <WorkflowStepper :current-step="currentStep" class="mb-12" />

                    <ClientOnly>
                        <div
                            v-if="!supportsAudioEncoder"
                            class="mb-8 rounded-lg bg-[#ff9f0a]/10 px-4 py-3 apple-caption text-[#ff9f0a]"
                        >
                            当前浏览器缺少 AudioEncoder 支持，无法正常导出视频。请更换为较新的 Chrome、Edge 或其它兼容浏览器。
                        </div>
                    </ClientOnly>

                    <div class="text-center">
                        <h1 class="apple-display-hero text-white">
                            TemotoAlign
                        </h1>
                        <p class="mx-auto mt-4 max-w-xl text-[21px] font-normal leading-[1.19] tracking-[0.231px] text-white/80">
                            一键对齐手元视频与高质量音频，导出可直接使用的手元成品。
                        </p>

                        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
                            <button
                                class="btn bg-[#0071e3] text-white border-transparent hover:bg-[#0077ed]"
                                :disabled="!canStartAlign"
                                @click="runAlign"
                            >
                                <span v-if="isAligning" class="loading loading-spinner loading-sm" />
                                {{ isAligning ? '对齐中...' : '开始对齐' }}
                            </button>
                            <button
                                class="btn bg-white/10 text-white border-white/10 backdrop-blur-xl hover:bg-white/15"
                                :disabled="!store.alignResult || isAligning || isExporting"
                                @click="runExport()"
                            >
                                <span v-if="isExporting" class="loading loading-spinner loading-sm" />
                                {{ isExporting ? '导出中...' : '导出视频' }}
                            </button>
                            <button
                                v-if="store.alignResult"
                                class="rounded-[980px] border border-white/30 px-4 py-2 apple-caption text-white transition-colors hover:bg-white/10"
                                :disabled="isAligning || isExporting"
                                @click="resetAll"
                            >
                                重置
                            </button>
                        </div>
                        <!-- Export settings -->
                        <div class="mx-auto mt-6 flex max-w-md items-center justify-center gap-3">
                            <span class="apple-caption text-white/60">封装方式</span>
                            <select
                                v-model="store.exportMethod"
                                class="rounded-lg border border-white/10 bg-white/10 px-3 py-2 apple-caption text-white/80 outline-none backdrop-blur-xl transition-colors hover:bg-white/15"
                            >
                                <option value="remux">
                                    速度优先（直通封装）
                                </option>
                                <option value="webcodecs">
                                    兼容模式（WebCodecs 转码）
                                </option>
                            </select>
                        </div>

                        <!-- Status panel -->
                        <div class="mx-auto mt-8 max-w-2xl">
                            <AlignStatusPanel :result="store.alignResult" :task="store.task" />
                        </div>
                    </div>
                </div>
            </section>
            <!-- Input Section (Light) -->
            <Transition name="fade-slide">
                <section v-if="showInputPanel" class="py-16">
                    <div class="mx-auto max-w-245 px-4 md:px-6">
                        <h2 class="apple-section-heading text-center text-white">
                            素材输入
                        </h2>
                        <div class="mt-10 flex flex-col items-stretch gap-4 md:flex-row">
                            <div class="flex-1">
                                <MediaFilePicker
                                    label="Clip1（手元视频）"
                                    accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                                    :file="store.clip1File"
                                    :probe="store.clip1Probe"
                                    @update="assignFile('clip1', $event)"
                                />
                            </div>
                            <div class="flex-1">
                                <MediaFilePicker
                                    label="Clip2（音频来源）"
                                    accept="video/mp4,video/quicktime,video/webm,video/x-matroska,audio/*"
                                    :file="store.clip2File"
                                    :probe="store.clip2Probe"
                                    @update="assignFile('clip2', $event)"
                                />
                            </div>
                        </div>
                    </div>
                </section>
            </Transition>

            <!-- Timeline Section (Dark) -->
            <Transition name="fade-slide">
                <section v-if="showTimelinePanel" class="py-16">
                    <div class="mx-auto max-w-245 px-4 md:px-6">
                        <TimelinePanel
                            :tracks="timelineTracks"
                            :duration-sec="timelineDurationSec"
                            :cursor-sec="timelineCursorSec"
                            :cursor-percent="previewCursorPercent"
                            :preview-offset-sec="currentPreviewOffsetSec"
                            :preview-object-url="previewObjectUrl"
                            :config="store.config"
                            @update:cursor-sec="updateTimelineCursor"
                            @update:audio1-gain-db="store.config.audio1GainDb = $event"
                            @update:audio2-gain-db="store.config.audio2GainDb = $event"
                            @toggle-mute="toggleMute"
                        />
                    </div>
                </section>
            </Transition>

            <!-- Related Projects Section (Light) -->
            <section class="py-16">
                <div class="mx-auto max-w-245 px-4 md:px-6">
                    <h2 class="apple-section-heading text-center text-white">
                        更多项目
                    </h2>
                    <div class="mt-10 grid gap-6 sm:grid-cols-2">
                        <a
                            href="https://uc.turou.fun/"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="group rounded-lg bg-white/10 backdrop-blur-md p-6 transition-all hover:bg-white/20"
                        >
                            <div class="apple-card-title text-white group-hover:text-[#64d2ff]">
                                兔兔实验室
                            </div>
                            <p class="mt-2 apple-caption text-white/60">
                                将独特的设计与个性化的功能结合，快速定制属于你的高技术力周边，从创意到成品一步到位。
                            </p>
                            <span class="mt-4 inline-block apple-caption text-[#64d2ff] hover:underline">
                                了解更多 &rsaquo;
                            </span>
                        </a>
                        <div class="rounded-lg bg-white/10 backdrop-blur-md p-6">
                            <div class="apple-card-title text-white">
                                DAY的曲库窝
                            </div>
                            <p class="mt-2 apple-caption text-white/60">
                                支持多种查分器的成绩管理工具。有则更加强大的搜索功能、支持自义定列表，可以对成绩进行整理，并且附带统计。
                            </p>
                            <div class="mt-4 flex gap-4">
                                <a
                                    href="https://song-collections.pages.dev/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="apple-caption text-[#64d2ff] hover:underline"
                                >
                                    官网 &rsaquo;
                                </a>
                                <a
                                    href="https://github.com/DAYGoodTime/MaiMaiSongCollectionWeb"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="apple-caption text-[#64d2ff] hover:underline"
                                >
                                    GitHub &rsaquo;
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <AppFooter />
            <ToastContainer />
        </div>
    </div>
</template>
