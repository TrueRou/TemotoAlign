declare module 'mp4-muxer' {
    export class ArrayBufferTarget {
        buffer: ArrayBuffer
    }

    export class Muxer<T = ArrayBufferTarget> {
        constructor(options: any)
        addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata, timestamp?: number, compositionTimeOffset?: number): void
        addAudioChunk(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata, timestamp?: number): void
        addVideoChunkRaw(data: Uint8Array, type: 'key' | 'delta', timestamp: number, duration: number, meta?: EncodedVideoChunkMetadata, compositionTimeOffset?: number): void
        addAudioChunkRaw(data: Uint8Array, type: 'key' | 'delta', timestamp: number, duration: number, meta?: EncodedAudioChunkMetadata): void
        finalize(): void
    }
}
