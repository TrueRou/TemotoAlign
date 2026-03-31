import type { PreparedAudioPayload } from '../../shared/types/alignment'
import { audioBufferToMonoPcm16Wav, uint8ArrayToBase64 } from '../utils/audio'

async function decodeAudioFile(file: File): Promise<AudioBuffer> {
    const audioContext = new AudioContext()

    try {
        const arrayBuffer = await file.arrayBuffer()
        return await audioContext.decodeAudioData(arrayBuffer.slice(0))
    }
    catch (error) {
        throw new Error(`${file.name} 无法解码音频轨：${error instanceof Error ? error.message : 'unknown error'}`)
    }
    finally {
        await audioContext.close()
    }
}

async function resampleAudioBuffer(audioBuffer: AudioBuffer, sampleRate: number): Promise<AudioBuffer> {
    if (audioBuffer.sampleRate === sampleRate && audioBuffer.numberOfChannels === 1) {
        return audioBuffer
    }

    const offlineAudioContext = new OfflineAudioContext({
        numberOfChannels: 1,
        length: Math.ceil(audioBuffer.duration * sampleRate),
        sampleRate,
    })
    const source = offlineAudioContext.createBufferSource()
    const monoBuffer = offlineAudioContext.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate)
    const targetChannel = monoBuffer.getChannelData(0)

    for (let frameIndex = 0; frameIndex < audioBuffer.length; frameIndex += 1) {
        let mixed = 0
        for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
            mixed += audioBuffer.getChannelData(channelIndex)[frameIndex] || 0
        }
        targetChannel[frameIndex] = mixed / Math.max(1, audioBuffer.numberOfChannels)
    }

    source.buffer = monoBuffer
    source.connect(offlineAudioContext.destination)
    source.start(0)

    return await offlineAudioContext.startRendering()
}

export function useAudioPreparation() {
    const prepareForAlignment = async (file: File, sampleRate: number): Promise<PreparedAudioPayload> => {
        const decoded = await decodeAudioFile(file)
        const rendered = await resampleAudioBuffer(decoded, sampleRate)
        const wavBytes = audioBufferToMonoPcm16Wav(rendered, { sampleRate, channelCount: 1 })

        return {
            base64: uint8ArrayToBase64(wavBytes),
            sampleRate,
            durationSec: rendered.duration,
        }
    }

    return {
        prepareForAlignment,
    }
}
