<script setup lang="ts">
import ExportWorker from '../workers/export.worker?worker'

const store = useAlignTaskStore()
const { evaluate } = useCapabilityGate()
const { probeFile } = useMediaProbe()
const { prepareForAlignment } = useAudioPreparation()
const { align } = useAlignApi()
const { deliver } = useExportDelivery()
const { prepareMixedAudio } = usePreviewExporter()

const runningCapabilityCheck = ref(false)
const muteClip1 = ref(false)
const muteClip2 = ref(false)

const canStartAlign = computed(() => {
    return Boolean(store.clip1File && store.clip2File && store.capabilityReport?.status !== 'deny')
})

async function runCapabilityCheck() {
    runningCapabilityCheck.value = true
    store.task.phase = 'probing'
    store.task.message = '正在检查本地导出能力...'
    store.task.progress = 0.05

    try {
        store.capabilityReport = await evaluate()
        store.task.phase = 'idle'
        store.task.message = store.capabilityReport.status === 'deny' ? '当前环境不支持导出。' : '能力检查完成。'
        store.task.progress = 0.1
    }
    catch (error) {
        store.task.phase = 'failed'
        store.task.error = error instanceof Error ? error.message : '能力检查失败'
    }
    finally {
        runningCapabilityCheck.value = false
    }
}

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

async function runExport(kind: 'preview' | 'final') {
    if (!store.alignResult || !store.clip1File || !store.clip2File) {
        return
    }

    const report = store.capabilityReport
    if (!report || report.status === 'deny') {
        store.task.phase = 'failed'
        store.task.error = '当前环境不支持导出，请升级设备或浏览器。'
        return
    }

    const plan = buildExportPlan(store.alignResult, {
        audio1GainDb: store.config.audio1GainDb,
        audio2GainDb: store.config.audio2GainDb,
        audioReverbWet: store.config.audioReverbWet,
        muteClip1: muteClip1.value,
        muteClip2: muteClip2.value,
        previewDurationSec: kind === 'preview' ? store.config.previewDurationSec : undefined,
    })

    store.task.phase = 'exporting'
    store.task.progress = 0.6
    store.task.error = undefined
    store.task.outputSavedPath = undefined
    store.task.message = kind === 'preview' ? '正在执行本地预览导出...' : '正在执行本地完整导出...'

    if (store.outputObjectUrl) {
        URL.revokeObjectURL(store.outputObjectUrl)
        store.outputObjectUrl = null
    }

    try {
        let mixedAudio = await prepareMixedAudio({
            clip1File: store.clip1File,
            clip2File: store.clip2File,
            plan,
            kind,
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
                    kind,
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
        store.task.message = delivered.savedPath ? '导出完成，已写入设备并打开分享面板。' : '导出完成。'
    }
    catch (error) {
        store.task.phase = 'failed'
        store.task.error = error instanceof Error ? error.message : '导出失败'
    }
}

onMounted(async () => {
    await runCapabilityCheck()
})
</script>

<template>
    <main class="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-8 md:px-6">
        <section class="hero rounded-box bg-base-100 shadow-sm">
            <div class="hero-content w-full justify-between max-md:flex-col">
                <div>
                    <h1 class="text-4xl font-bold">
                        TemotoAlign
                    </h1>
                    <p class="mt-2 max-w-2xl text-sm opacity-75">
                        将 `maimai-timing-align` 的音频对齐与本地导出流程迁移到 Nuxt 客户端架构中。
                        当前版本已完成能力门禁、素材输入、对齐代理和导出任务接线。
                    </p>
                </div>
                <button class="btn btn-outline" :disabled="runningCapabilityCheck" @click="runCapabilityCheck">
                    重新检查环境
                </button>
            </div>
        </section>

        <div class="card-grid">
            <CapabilityReportCard :report="store.capabilityReport" :pending="runningCapabilityCheck" />
            <ExportTaskCard :result="store.alignResult" :task="store.task" />
        </div>

        <section class="card bg-base-100 shadow-sm">
            <div class="card-body gap-6">
                <div>
                    <h2 class="card-title">
                        素材输入
                    </h2>
                    <p class="text-sm opacity-70">
                        `Clip1` 必须是视频，`Clip2` 可以是视频或音频。
                    </p>
                </div>

                <div class="grid gap-4 md:grid-cols-2">
                    <InputMediaFilePicker
                        label="Clip1（手元视频）" accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                        :file="store.clip1File" @update="assignFile('clip1', $event)"
                    />
                    <InputMediaFilePicker
                        label="Clip2（音频来源）"
                        accept="video/mp4,video/quicktime,video/webm,video/x-matroska,audio/*" :file="store.clip2File"
                        @update="assignFile('clip2', $event)"
                    />
                </div>

                <div class="grid gap-4 md:grid-cols-2">
                    <div class="rounded-box bg-base-200 p-4 text-sm">
                        <div class="font-medium">
                            Clip1 元数据
                        </div>
                        <div class="mt-2 opacity-75">
                            {{ store.clip1Probe ? `${store.clip1Probe.durationSec.toFixed(3)}s /
                            ${store.clip1Probe.width || '-'}x${store.clip1Probe.height || '-'}` : '未检测' }}
                        </div>
                    </div>
                    <div class="rounded-box bg-base-200 p-4 text-sm">
                        <div class="font-medium">
                            Clip2 元数据
                        </div>
                        <div class="mt-2 opacity-75">
                            {{ store.clip2Probe ? `${store.clip2Probe.durationSec.toFixed(3)}s /
                            ${store.clip2Probe.mimeType}` : '未检测' }}
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <ExportConfigPanel
            v-model="store.config"
            :disabled="store.capabilityReport?.status === 'deny'"
        />

        <section class="card bg-base-100 shadow-sm">
            <div class="card-body gap-4">
                <h2 class="card-title">
                    导出控制
                </h2>
                <div class="flex flex-wrap gap-4">
                    <label class="label cursor-pointer gap-2">
                        <span class="label-text">静音 Clip1</span>
                        <input v-model="muteClip1" class="toggle toggle-primary" type="checkbox">
                    </label>
                    <label class="label cursor-pointer gap-2">
                        <span class="label-text">静音 Clip2</span>
                        <input v-model="muteClip2" class="toggle toggle-primary" type="checkbox">
                    </label>
                </div>

                <div class="flex flex-wrap gap-3">
                    <button class="btn btn-primary" :disabled="!canStartAlign" @click="runAlign">
                        开始对齐
                    </button>
                    <button class="btn btn-secondary" :disabled="!store.alignResult" @click="runExport('preview')">
                        导出预览片段
                    </button>
                    <button class="btn btn-secondary" :disabled="!store.alignResult" @click="runExport('final')">
                        导出完整视频
                    </button>
                    <a
                        v-if="store.outputObjectUrl" class="btn btn-accent" :href="store.outputObjectUrl"
                        :download="store.task.outputFileName || 'temotoalign-preview.mp4'"
                    >
                        下载当前导出结果
                    </a>
                    <span v-if="store.task.outputSavedPath" class="text-sm opacity-70">
                        已保存：{{ store.task.outputSavedPath }}
                    </span>
                </div>
            </div>
        </section>
    </main>
</template>
