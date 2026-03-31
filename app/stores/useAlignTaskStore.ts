export const useAlignTaskStore = defineStore('alignTask', () => {
    const config = ref<AlignConfig>({ ...defaultAlignConfig })
    const capabilityReport = ref<ExportCapabilityReport | null>(null)
    const clip1File = ref<File | null>(null)
    const clip2File = ref<File | null>(null)
    const clip1Probe = ref<MediaProbeResult | null>(null)
    const clip2Probe = ref<MediaProbeResult | null>(null)
    const clip1PreparedAudio = ref<PreparedAudioPayload | null>(null)
    const clip2PreparedAudio = ref<PreparedAudioPayload | null>(null)
    const alignResult = ref<AlignResult | null>(null)
    const outputObjectUrl = ref<string | null>(null)
    const task = ref<ExportTaskState>({
        id: 'default',
        phase: 'idle',
        progress: 0,
        message: '等待开始',
    })

    function resetTask() {
        if (outputObjectUrl.value) {
            URL.revokeObjectURL(outputObjectUrl.value)
        }

        alignResult.value = null
        clip1PreparedAudio.value = null
        clip2PreparedAudio.value = null
        outputObjectUrl.value = null
        task.value = {
            id: crypto.randomUUID(),
            phase: 'idle',
            progress: 0,
            message: '等待开始',
            outputSavedPath: undefined,
        }
    }

    return {
        config,
        capabilityReport,
        clip1File,
        clip2File,
        clip1Probe,
        clip2Probe,
        clip1PreparedAudio,
        clip2PreparedAudio,
        alignResult,
        outputObjectUrl,
        task,
        resetTask,
    }
})
