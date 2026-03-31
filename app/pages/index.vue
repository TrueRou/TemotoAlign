<script setup lang="ts">
import ExportWorker from '../workers/export.worker?worker'

const store = useAlignTaskStore()
const { probeFile } = useMediaProbe()
const { prepareForAlignment } = useAudioPreparation()
const { align } = useAlignApi()
const { deliver } = useExportDelivery()
const { prepareMixedAudio } = usePreviewExporter()

type TrackId = 'clip1' | 'clip2'

interface TrackControlState {
    mute: boolean
}

const trackControls = reactive<Record<TrackId, TrackControlState>>({
    clip1: { mute: false },
    clip2: { mute: false },
})
const previewVideo = ref<HTMLVideoElement | null>(null)
const previewObjectUrl = ref<string | null>(null)
const timelineCursorSec = ref(0)
const syncingPreviewVideo = ref(false)
const supportsAudioEncoder = ref(true)

const hasSelectedMedia = computed(() => Boolean(store.clip1File && store.clip2File))
const hasStartedAlignFlow = computed(() => {
    return store.task.phase !== 'idle' || Boolean(store.alignResult)
})
const showInputPanel = computed(() => !hasStartedAlignFlow.value)
const showTimelinePanel = computed(() => hasSelectedMedia.value && hasStartedAlignFlow.value)
const isAligning = computed(() => store.task.phase === 'aligning')
const isExporting = computed(() => store.task.phase === 'exporting')

const canStartAlign = computed(() => {
    return hasSelectedMedia.value && !isAligning.value && !isExporting.value
})

const timelineDurationSec = computed(() => {
    const clip1Start = store.alignResult?.clip1StartSec ?? 0
    const clip2Start = store.alignResult?.clip2StartSec ?? 0
    const clip1Duration = store.clip1Probe?.durationSec ?? 0
    const clip2Duration = store.clip2Probe?.durationSec ?? 0
    const maxDuration = Math.max(
        clip1Start + clip1Duration,
        clip2Start + clip2Duration,
        store.alignResult?.outputDurationSec ?? 0,
        1,
    )

    return maxDuration
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
            muted: isTrackMuted('clip1'),
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
            muted: isTrackMuted('clip2'),
            widthPercent: ((store.clip2Probe?.durationSec ?? 0) / total) * 100,
            offsetPercent: ((store.alignResult?.clip2StartSec ?? 0) / total) * 100,
        },
    ]
})

const previewCursorPercent = computed(() => {
    if (timelineDurationSec.value <= 0) {
        return 0
    }

    return (timelineCursorSec.value / timelineDurationSec.value) * 100
})

const currentPreviewOffsetSec = computed(() => {
    const clipStart = store.alignResult?.clip1StartSec ?? 0
    return Math.max(0, timelineCursorSec.value - clipStart)
})

function isTrackMuted(trackId: TrackId): boolean {
    return trackControls[trackId].mute
}

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

function formatSeconds(value: number): string {
    if (!Number.isFinite(value)) {
        return '0.00s'
    }

    return `${value.toFixed(2)}s`
}

function updateTimelineCursor(value: number) {
    const clamped = Math.max(0, Math.min(value, timelineDurationSec.value))
    timelineCursorSec.value = clamped
}

function syncPreviewVideoTime() {
    if (!previewVideo.value || syncingPreviewVideo.value) {
        return
    }

    syncingPreviewVideo.value = true
    previewVideo.value.currentTime = Math.min(
        Math.max(0, currentPreviewOffsetSec.value),
        Math.max(0, (store.clip1Probe?.durationSec ?? 0) - 0.05),
    )
    window.requestAnimationFrame(() => {
        syncingPreviewVideo.value = false
    })
}

watch(currentPreviewOffsetSec, () => {
    syncPreviewVideoTime()
})

watch(() => store.clip1File, (file, previousFile) => {
    if (previewObjectUrl.value) {
        URL.revokeObjectURL(previewObjectUrl.value)
        previewObjectUrl.value = null
    }

    if (file) {
        previewObjectUrl.value = URL.createObjectURL(file)
    }

    if (previousFile !== file) {
        updateTimelineCursor(store.alignResult?.clip1StartSec ?? 0)
    }
})

watch(() => store.alignResult, (result) => {
    updateTimelineCursor(result?.clip1StartSec ?? 0)
}, { deep: true })

onMounted(() => {
    supportsAudioEncoder.value = typeof AudioEncoder !== 'undefined'
})

onBeforeUnmount(() => {
    if (previewObjectUrl.value) {
        URL.revokeObjectURL(previewObjectUrl.value)
    }
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

    mediaInputSchema.parse({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
    })

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
    if (!store.clip1File || !store.clip2File) {
        return
    }

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
}

async function runExport() {
    if (!store.alignResult || !store.clip1File || !store.clip2File) {
        return
    }

    const plan = buildExportPlan(store.alignResult, {
        audio1GainDb: store.config.audio1GainDb,
        audio2GainDb: store.config.audio2GainDb,
        audioReverbWet: store.config.audioReverbWet,
        muteClip1: isTrackMuted('clip1'),
        muteClip2: isTrackMuted('clip2'),
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
        const transferables = [
            clip1Buffer,
            ...mixedAudio.channels,
        ]
        const worker = new ExportWorker()

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
        mixedAudio = {
            sampleRate: 0,
            numberOfChannels: 0,
            length: 0,
            channels: [],
        }

        const delivered = await deliver(result.blob, result.fileName)
        store.outputObjectUrl = delivered.objectUrl || null
        store.task.phase = 'done'
        store.task.progress = 1
        store.task.outputFileName = result.fileName
        store.task.outputSavedPath = delivered.savedPath
        store.task.message = delivered.savedPath ? '导出完成，已写入设备并打开分享面板。' : '导出完成，已开始下载。'
    }
    catch (error) {
        store.task.phase = 'failed'
        store.task.error = error instanceof Error ? error.message : '导出失败'
    }
}
</script>

<template>
    <main class="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-8 md:px-6">
        <ClientOnly>
            <div
                v-if="!supportsAudioEncoder"
                class="rounded-3xl border border-warning/40 bg-warning/12 px-4 py-3 text-sm text-warning-content shadow-sm"
            >
                当前浏览器缺少 `AudioEncoder` 支持，无法正常导出视频。请更换为较新的 Chrome、Edge 或其它兼容浏览器。
            </div>
        </ClientOnly>

        <section class="overflow-hidden rounded-4xl border border-base-300 bg-linear-to-br from-base-100 via-base-100 to-base-200">
            <div class="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:px-8">
                <div class="space-y-5">
                    <h1 class="mt-4 text-4xl font-bold">
                        TemotoAlign
                    </h1>
                    <p class="mt-3 max-w-2xl text-sm leading-7 opacity-75">
                        一键对齐手元视频与高质量音频，导出可直接使用的手元成品。
                    </p>

                    <div class="flex flex-wrap gap-2">
                        <button class="btn btn-primary" :disabled="!canStartAlign" @click="runAlign">
                            <span v-if="isAligning" class="loading loading-spinner loading-sm" />
                            {{ isAligning ? '对齐中...' : '开始对齐' }}
                        </button>
                        <button class="btn btn-secondary" :disabled="!store.alignResult || isAligning || isExporting" @click="runExport()">
                            <span v-if="isExporting" class="loading loading-spinner loading-sm" />
                            {{ isExporting ? '导出中...' : '导出视频' }}
                        </button>
                        <button v-if="store.alignResult" class="btn btn-outline" :disabled="isAligning || isExporting" @click="resetAll">
                            重置
                        </button>
                    </div>
                </div>

                <div class="rounded-3xl border border-base-300 bg-base-100/80 p-5">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <h2 class="text-lg font-semibold">
                                任务状态
                            </h2>
                        </div>
                        <div class="text-right text-xs opacity-60">
                            <div>{{ Math.round(store.task.progress * 100) }}%</div>
                        </div>
                    </div>

                    <div v-if="store.alignResult" class="mt-4 grid grid-cols-2 gap-3 text-sm xl:grid-cols-4">
                        <div class="rounded-2xl bg-base-200 p-3">
                            <div class="opacity-60">
                                Clip1 起点
                            </div>
                            <div class="mt-1 font-semibold">
                                {{ store.alignResult.clip1StartSec.toFixed(3) }}s
                            </div>
                        </div>
                        <div class="rounded-2xl bg-base-200 p-3">
                            <div class="opacity-60">
                                Clip2 起点
                            </div>
                            <div class="mt-1 font-semibold">
                                {{ store.alignResult.clip2StartSec.toFixed(3) }}s
                            </div>
                        </div>
                        <div class="rounded-2xl bg-base-200 p-3">
                            <div class="opacity-60">
                                偏移
                            </div>
                            <div class="mt-1 font-semibold">
                                {{ store.alignResult.offsetSec.toFixed(3) }}s
                            </div>
                        </div>
                        <div class="rounded-2xl bg-base-200 p-3">
                            <div class="opacity-60">
                                导出时长
                            </div>
                            <div class="mt-1 font-semibold">
                                {{ store.alignResult.outputDurationSec.toFixed(3) }}s
                            </div>
                        </div>
                    </div>

                    <progress class="progress progress-primary mt-4 w-full" :value="store.task.progress" max="1" />
                    <div class="mt-2 text-sm opacity-80">
                        {{ store.task.message }}
                    </div>

                    <div v-if="store.task.error" class="alert alert-error mt-4">
                        <span>{{ store.task.error }}</span>
                    </div>
                    <div v-else-if="store.task.outputSavedPath" class="mt-3 text-sm opacity-70">
                        已保存：{{ store.task.outputSavedPath }}
                    </div>
                </div>
            </div>
        </section>

        <section v-if="showInputPanel" class="rounded-4xl border border-base-300 bg-base-100 p-4 sm:p-6">
            <div class="space-y-6">
                <div>
                    <h2 class="text-xl font-semibold">
                        素材输入
                    </h2>
                </div>

                <div class="flex flex-col gap-4 md:flex-row">
                    <div class="flex-1">
                        <MediaFilePicker
                            label="Clip1（手元视频）" accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                            :file="store.clip1File" @update="assignFile('clip1', $event)"
                        />
                    </div>
                    <div class="flex-1">
                        <MediaFilePicker
                            label="Clip2（音频来源）"
                            accept="video/mp4,video/quicktime,video/webm,video/x-matroska,audio/*" :file="store.clip2File"
                            @update="assignFile('clip2', $event)"
                        />
                    </div>
                </div>
            </div>
        </section>

        <section v-if="showTimelinePanel" class="rounded-4xl border border-base-300 bg-base-100 p-6">
            <div class="space-y-6">
                <div class="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 class="text-xl font-semibold">
                            可视化时间轴
                        </h2>
                        <p class="text-sm opacity-70">
                            对齐完成后会按起始时间排布。拖动底部游标即可预览。
                        </p>
                    </div>

                    <div class="flex flex-wrap gap-2 text-xs">
                        <span class="rounded-full border border-base-300 px-3 py-1">时间轴总长 {{ formatSeconds(timelineDurationSec) }}</span>
                        <span class="rounded-full border border-base-300 px-3 py-1">预览位置 {{ formatSeconds(currentPreviewOffsetSec) }}</span>
                    </div>
                </div>

                <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
                    <div class="rounded-3xl bg-base-200 p-4">
                        <div class="mb-4 flex items-center justify-between text-xs opacity-60">
                            <span>0s</span>
                            <span>{{ formatSeconds(timelineDurationSec / 2) }}</span>
                            <span>{{ formatSeconds(timelineDurationSec) }}</span>
                        </div>

                        <div class="space-y-4">
                            <div
                                v-for="track in timelineTracks"
                                :key="track.id"
                                class="flex gap-3 rounded-2xl bg-base-100/70 p-3"
                            >
                                <div class="relative flex min-h-24 items-center overflow-hidden rounded-2xl bg-base-300/40 px-3 flex-1">
                                    <div class="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-base-content/10" />
                                    <div class="absolute inset-y-2 left-0 w-px bg-base-content/10" />
                                    <div class="absolute inset-y-2 right-0 w-px bg-base-content/10" />
                                    <div
                                        class="absolute inset-y-3 rounded-xl bg-linear-to-r shadow-lg"
                                        :class="[track.colorClass, track.glowClass, isTrackMuted(track.id) ? 'opacity-35' : 'opacity-95']"
                                        :style="{
                                            left: `${Math.min(track.offsetPercent, 100)}%`,
                                            width: `${Math.max(Math.min(track.widthPercent, 100 - track.offsetPercent), 4)}%`,
                                        }"
                                    >
                                        <div v-if="track.durationSec" class="flex h-full items-center justify-between px-4 text-[11px] font-medium text-primary-content">
                                            <span>{{ formatSeconds(track.startSec) }}</span>
                                            <span>{{ formatSeconds(track.durationSec) }}</span>
                                        </div>
                                    </div>

                                    <div
                                        class="pointer-events-none absolute inset-y-1 w-0.5 bg-accent shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
                                        :style="{ left: `${previewCursorPercent}%` }"
                                    />
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 rounded-2xl bg-base-100/80 p-4">
                            <input
                                :model-value="timelineCursorSec"
                                class="range range-accent w-full"
                                type="range"
                                min="0"
                                :max="timelineDurationSec"
                                step="0.01"
                                @input="updateTimelineCursor(Number(($event.target as HTMLInputElement).value))"
                            >
                        </div>
                    </div>

                    <div class="rounded-3xl bg-base-200 p-4">
                        <div class="mb-4">
                            <h3 class="text-lg font-semibold">
                                控制区
                            </h3>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="rounded-2xl bg-base-100/80 p-4">
                                <div class="text-sm font-semibold">
                                    Clip1
                                </div>
                                <div class="mt-1 text-xs opacity-60">
                                    手元视频
                                </div>
                                <div class="mt-4 flex h-40 items-center justify-center">
                                    <div class="relative flex h-36 w-16 items-center justify-center">
                                        <input
                                            v-model.number="store.config.audio1GainDb"
                                            class="range range-primary absolute w-36 -rotate-90"
                                            type="range"
                                            min="-18"
                                            max="6"
                                            step="0.5"
                                        >
                                    </div>
                                </div>
                                <div class="text-center text-sm font-medium text-primary">
                                    {{ store.config.audio1GainDb.toFixed(1) }} dB
                                </div>
                                <div class="mt-3 flex justify-center">
                                    <button
                                        class="btn btn-sm"
                                        :class="isTrackMuted('clip1') ? 'btn-error' : 'btn-outline btn-primary'"
                                        @click="toggleMute('clip1')"
                                    >
                                        {{ isTrackMuted('clip1') ? '取消静音' : '静音轨道' }}
                                    </button>
                                </div>
                            </div>

                            <div class="rounded-2xl bg-base-100/80 p-4">
                                <div class="text-sm font-semibold">
                                    Clip2
                                </div>
                                <div class="mt-1 text-xs opacity-60">
                                    对齐音轨
                                </div>
                                <div class="mt-4 flex h-40 items-center justify-center">
                                    <div class="relative flex h-36 w-16 items-center justify-center">
                                        <input
                                            v-model.number="store.config.audio2GainDb"
                                            class="range range-secondary absolute w-36 -rotate-90"
                                            type="range"
                                            min="-18"
                                            max="6"
                                            step="0.5"
                                        >
                                    </div>
                                </div>
                                <div class="text-center text-sm font-medium text-secondary">
                                    {{ store.config.audio2GainDb.toFixed(1) }} dB
                                </div>
                                <div class="mt-3 flex justify-center">
                                    <button
                                        class="btn btn-sm"
                                        :class="isTrackMuted('clip2') ? 'btn-error' : 'btn-outline btn-secondary'"
                                        @click="toggleMute('clip2')"
                                    >
                                        {{ isTrackMuted('clip2') ? '取消静音' : '静音轨道' }}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>
</template>
