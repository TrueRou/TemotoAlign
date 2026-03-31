export interface WavEncodeOptions {
    sampleRate: number
    channelCount?: number
}

function clampSample(value: number): number {
    return Math.max(-1, Math.min(1, value))
}

export function audioBufferToMonoPcm16Wav(audioBuffer: AudioBuffer, options: WavEncodeOptions): Uint8Array {
    const targetSampleRate = options.sampleRate
    const channelCount = Math.max(1, options.channelCount || 1)
    const frameCount = audioBuffer.length
    const bytesPerSample = 2
    const blockAlign = channelCount * bytesPerSample
    const dataSize = frameCount * blockAlign
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)
    const output = new Uint8Array(buffer)

    const writeAscii = (offset: number, value: string) => {
        for (let index = 0; index < value.length; index += 1) {
            view.setUint8(offset + index, value.charCodeAt(index))
        }
    }

    writeAscii(0, 'RIFF')
    view.setUint32(4, 36 + dataSize, true)
    writeAscii(8, 'WAVE')
    writeAscii(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, channelCount, true)
    view.setUint32(24, targetSampleRate, true)
    view.setUint32(28, targetSampleRate * blockAlign, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, 16, true)
    writeAscii(36, 'data')
    view.setUint32(40, dataSize, true)

    let writeOffset = 44
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        let mixed = 0
        for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
            mixed += audioBuffer.getChannelData(channelIndex)[frameIndex] || 0
        }
        mixed /= audioBuffer.numberOfChannels || 1

        const sample = clampSample(mixed)
        const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
        view.setInt16(writeOffset, Math.round(pcm), true)
        writeOffset += 2
    }

    return output
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = ''
    const chunkSize = 0x8000

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.subarray(offset, offset + chunkSize)
        binary += String.fromCharCode(...chunk)
    }

    return btoa(binary)
}
