interface ExportAudioPreparationOptions {
    clip1File: File
    clip2File: File
    plan: ExportPlan
    onProgress?: (progress: number, message: string) => void
}

const AUDIO_SAMPLE_RATE = 48_000
const AUDIO_CHANNELS = 2

function gainFromDb(value: number): number {
    return 10 ** (value / 20)
}

async function decodeAudio(file: File): Promise<AudioBuffer> {
    const context = new AudioContext()

    try {
        const buffer = await file.arrayBuffer()
        return await context.decodeAudioData(buffer.slice(0))
    }
    finally {
        await context.close()
    }
}

async function renderMixedAudio(options: ExportAudioPreparationOptions): Promise<AudioBuffer> {
    const { clip1File, clip2File, plan } = options
    const [audio1, audio2] = await Promise.all([decodeAudio(clip1File), decodeAudio(clip2File)])
    const frameCount = Math.max(1, Math.ceil(plan.outputDurationSec * AUDIO_SAMPLE_RATE))
    const offline = new OfflineAudioContext({
        numberOfChannels: AUDIO_CHANNELS,
        length: frameCount,
        sampleRate: AUDIO_SAMPLE_RATE,
    })

    const createSourceChain = (audioBuffer: AudioBuffer, startOffsetSec: number, gainDb: number, muted: boolean) => {
        const source = offline.createBufferSource()
        source.buffer = audioBuffer

        const gainNode = offline.createGain()
        gainNode.gain.value = muted ? 0 : gainFromDb(gainDb)

        const compressor = offline.createDynamicsCompressor()
        compressor.threshold.value = -8
        compressor.knee.value = 12
        compressor.ratio.value = 4
        compressor.attack.value = 0.003
        compressor.release.value = 0.2

        source.connect(gainNode)
        gainNode.connect(compressor)
        compressor.connect(offline.destination)
        source.start(0, Math.max(0, startOffsetSec), plan.outputDurationSec)
    }

    createSourceChain(audio1, plan.clip1StartSec, plan.audio1GainDb, plan.muteClip1)
    createSourceChain(audio2, plan.clip2StartSec, plan.audio2GainDb, plan.muteClip2)

    if (plan.audioReverbWet > 0) {
        const impulse = offline.createBuffer(AUDIO_CHANNELS, Math.max(1, Math.floor(AUDIO_SAMPLE_RATE * 0.18)), AUDIO_SAMPLE_RATE)
        for (let channel = 0; channel < AUDIO_CHANNELS; channel += 1) {
            const samples = impulse.getChannelData(channel)
            for (let index = 0; index < samples.length; index += 1) {
                const decay = (1 - index / samples.length) ** 2
                samples[index] = (Math.random() * 2 - 1) * decay * plan.audioReverbWet
            }
        }

        const convolver = offline.createConvolver()
        convolver.buffer = impulse
        convolver.connect(offline.destination)
    }

    return await offline.startRendering()
}

export function usePreviewExporter() {
    const prepareMixedAudio = async (options: ExportAudioPreparationOptions): Promise<ExportWorkerAudioBuffer> => {
        options.onProgress?.(0.1, '正在渲染完整音频...')
        const mixedAudio = await renderMixedAudio(options)
        return {
            sampleRate: mixedAudio.sampleRate,
            numberOfChannels: mixedAudio.numberOfChannels,
            length: mixedAudio.length,
            channels: Array.from({ length: mixedAudio.numberOfChannels }, (_, channel) => {
                const source = mixedAudio.getChannelData(channel)
                return source.slice().buffer
            }),
        }
    }

    return {
        prepareMixedAudio,
    }
}
