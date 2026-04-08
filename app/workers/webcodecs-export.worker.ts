import type { ExportPlan, ExportWorkerAudioBuffer, ExportWorkerMessage, ExportWorkerRequest } from '../../shared/types/alignment'
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, type ConversionVideoOptions } from 'mediabunny'
import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import * as MP4Box from 'mp4box'

interface ParsedTrackSample {
    timescale: number
    dts: number
    cts: number
    duration: number
    isRap: boolean
    data: ArrayBuffer
}

interface ParsedVideoTrack {
    id: number
    codec: string
    width: number
    height: number
    timescale: number
    samples: ParsedTrackSample[]
    description: Uint8Array
}

interface Mp4BoxArrayBuffer extends ArrayBuffer {
    fileStart: number
}

interface Mp4BoxSample {
    timescale: number
    dts: number
    cts: number
    duration: number
    is_sync?: boolean
    is_rap?: boolean
    data: ArrayBuffer
}

interface Mp4BoxTrackInfo {
    id: number
    codec: string
    timescale: number
    nb_samples: number
    track_width?: number
    track_height?: number
    video?: {
        width?: number
        height?: number
    }
}

interface AvcParameterSetLike {
    data?: Uint8Array | ArrayBuffer
}

interface AvcConfigurationBoxLike {
    configurationVersion: number
    AVCProfileIndication: number
    profile_compatibility: number
    AVCLevelIndication: number
    lengthSizeMinusOne: number
    SPS: Array<Uint8Array | ArrayBuffer | AvcParameterSetLike>
    PPS: Array<Uint8Array | ArrayBuffer | AvcParameterSetLike>
    ext?: Uint8Array
}

interface SampleEntryLike {
    avcC?: AvcConfigurationBoxLike
}

interface TrackBoxLike {
    tkhd?: {
        track_id?: number
    }
    mdia?: {
        minf?: {
            stbl?: {
                stsd?: {
                    entries?: SampleEntryLike[]
                }
            }
        }
    }
}

interface Mp4BoxInfoLike {
    videoTracks?: Mp4BoxTrackInfo[]
}

interface Mp4BoxFileLike {
    onError?: (module: string, message: string) => void
    onReady?: (info: Mp4BoxInfoLike) => void
    onSamples?: (trackId: number, user: unknown, samples: Mp4BoxSample[]) => void
    appendBuffer: (data: Mp4BoxArrayBuffer, last?: boolean) => number
    setExtractionOptions: (trackId: number, user: unknown, options: { nbSamples: number }) => void
    start: () => void
    flush: () => void
    moov?: {
        traks?: TrackBoxLike[]
    }
}

interface VideoCompressionPreset {
    codec: 'h264'
    bitrate: number
    framerate: number
    maxDimension: number
}

const WEBCODECS_COMPRESSION_PRESET: Readonly<VideoCompressionPreset> = Object.freeze({
    codec: 'h264',
    bitrate: 3_500_000,
    framerate: 60,
    maxDimension: 1920,
})

function alignEven(value: number) {
    const rounded = Math.max(2, Math.round(value))
    return rounded % 2 === 0 ? rounded : rounded - 1
}

function normalizeVideoCompressionDimensions(sourceWidth: number, sourceHeight: number) {
    const longestSide = Math.max(sourceWidth, sourceHeight)
    const scale = longestSide > WEBCODECS_COMPRESSION_PRESET.maxDimension
        ? WEBCODECS_COMPRESSION_PRESET.maxDimension / longestSide
        : 1

    return {
        width: alignEven(sourceWidth * scale),
        height: alignEven(sourceHeight * scale),
    }
}

function validatePlan(plan: ExportPlan) {
    if (plan.outputDurationSec <= 0.5) {
        throw new Error('导出重叠时长不足，无法创建导出任务。')
    }
}

function postProgress(progress: number, message: string) {
    globalThis.postMessage({
        type: 'progress',
        progress,
        message,
    } satisfies ExportWorkerMessage)
}

function clearParsedTrackSamples(samples: ParsedTrackSample[] | null | undefined) {
    if (!samples) {
        return
    }

    for (const sample of samples) {
        sample.data = new ArrayBuffer(0)
    }

    samples.length = 0
}

function clearParsedVideoTrack(track: ParsedVideoTrack | null | undefined) {
    if (!track) {
        return
    }

    clearParsedTrackSamples(track.samples)
    track.description = new Uint8Array()
}

function clearWorkerAudioBuffer(audioBuffer: ExportWorkerAudioBuffer | null | undefined) {
    if (!audioBuffer) {
        return
    }

    for (let index = 0; index < audioBuffer.channels.length; index += 1) {
        audioBuffer.channels[index] = new ArrayBuffer(0)
    }

    audioBuffer.channels.length = 0
}

function toMp4BoxBuffer(buffer: ArrayBuffer): Mp4BoxArrayBuffer {
    const mp4Buffer = buffer as Mp4BoxArrayBuffer
    mp4Buffer.fileStart = 0
    return mp4Buffer
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
    const totalLength = parts.reduce((sum, part) => sum + part.byteLength, 0)
    const output = new Uint8Array(totalLength)
    let offset = 0

    for (const part of parts) {
        output.set(part, offset)
        offset += part.byteLength
    }

    return output
}

function toUint8Array(value: Uint8Array | ArrayBuffer | AvcParameterSetLike): Uint8Array {
    if (value instanceof Uint8Array) {
        return value
    }

    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value)
    }

    if (value.data instanceof Uint8Array) {
        return value.data
    }

    if (value.data instanceof ArrayBuffer) {
        return new Uint8Array(value.data)
    }

    throw new Error('无法读取 AVC 配置中的参数集数据。')
}

function buildAvcDescription(avcC: AvcConfigurationBoxLike): Uint8Array {
    const parts: Uint8Array[] = []
    parts.push(new Uint8Array([
        avcC.configurationVersion,
        avcC.AVCProfileIndication,
        avcC.profile_compatibility,
        avcC.AVCLevelIndication,
        0xFC | (avcC.lengthSizeMinusOne & 0x03),
        0xE0 | (avcC.SPS.length & 0x1F),
    ]))

    for (const sps of avcC.SPS) {
        const payload = toUint8Array(sps)
        const header = new Uint8Array(2)
        new DataView(header.buffer).setUint16(0, payload.byteLength)
        parts.push(header, payload)
    }

    parts.push(new Uint8Array([avcC.PPS.length]))
    for (const pps of avcC.PPS) {
        const payload = toUint8Array(pps)
        const header = new Uint8Array(2)
        new DataView(header.buffer).setUint16(0, payload.byteLength)
        parts.push(header, payload)
    }

    if (avcC.ext?.byteLength) {
        parts.push(avcC.ext)
    }

    return concatUint8Arrays(parts)
}

function getVideoDecoderConfig(track: ParsedVideoTrack) {
    return {
        codec: track.codec,
        description: track.description,
    }
}

async function parseVideoTrack(buffer: ArrayBuffer): Promise<ParsedVideoTrack> {
    const mp4File = MP4Box.createFile(false) as unknown as Mp4BoxFileLike

    return await new Promise((resolve, reject) => {
        mp4File.onError = (_module: string, message: string) => reject(new Error(message))
        mp4File.onReady = (info: Mp4BoxInfoLike) => {
            const track = info.videoTracks?.[0]
            if (!track) {
                reject(new Error('转码输出中未找到视频轨。'))
                return
            }

            const samples: ParsedTrackSample[] = []
            mp4File.onSamples = (_id: number, _user: unknown, parsedSamples: Mp4BoxSample[]) => {
                for (const sample of parsedSamples) {
                    samples.push({
                        timescale: sample.timescale,
                        dts: sample.dts,
                        cts: sample.cts,
                        duration: sample.duration,
                        isRap: Boolean(sample.is_sync ?? sample.is_rap ?? (samples.length === 0)),
                        data: sample.data,
                    })
                }
            }

            mp4File.setExtractionOptions(track.id, null, { nbSamples: track.nb_samples })
            mp4File.start()
            mp4File.flush()

            const trak = mp4File.moov?.traks?.find(entry => entry.tkhd?.track_id === track.id)
            const sampleEntry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0]
            const avcC = sampleEntry?.avcC

            if (!avcC) {
                reject(new Error('转码输出缺少 AVC 解码配置，无法重新封装。'))
                return
            }

            resolve({
                id: track.id,
                codec: track.codec,
                width: track.video?.width || track.track_width || 0,
                height: track.video?.height || track.track_height || 0,
                timescale: track.timescale,
                samples,
                description: buildAvcDescription(avcC),
            })

            mp4File.onSamples = undefined
            mp4File.onReady = undefined
            mp4File.onError = undefined
        }

        mp4File.appendBuffer(toMp4BoxBuffer(buffer), true)
    })
}

function createAudioData(buffer: ExportWorkerAudioBuffer): AudioData {
    const planar = new Float32Array(buffer.length * buffer.numberOfChannels)

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        planar.set(new Float32Array(buffer.channels[channel] || new ArrayBuffer(0)), channel * buffer.length)
    }

    return new AudioData({
        format: 'f32-planar',
        sampleRate: buffer.sampleRate,
        numberOfFrames: buffer.length,
        numberOfChannels: buffer.numberOfChannels,
        timestamp: 0,
        data: planar,
    })
}

async function encodeAudioTrack(audioBuffer: ExportWorkerAudioBuffer, muxer: Muxer<ArrayBufferTarget>) {
    const audioData = createAudioData(audioBuffer)

    await new Promise<void>((resolve, reject) => {
        const encoder = new AudioEncoder({
            output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
            error: error => reject(error),
        })

        encoder.configure({
            codec: 'mp4a.40.2',
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels,
            bitrate: 192_000,
        })

        encoder.encode(audioData)
        encoder.flush().then(() => {
            audioData.close()
            encoder.close()
            resolve()
        }).catch((error) => {
            audioData.close()
            encoder.close()
            reject(error)
        })
    })
}

function muxVideoTrack(track: ParsedVideoTrack, muxer: Muxer<ArrayBufferTarget>) {
    for (let index = 0; index < track.samples.length; index += 1) {
        const sample = track.samples[index]!
        const timestampUs = Math.round((sample.cts / sample.timescale) * 1_000_000)
        const durationUs = Math.max(1, Math.round((sample.duration / sample.timescale) * 1_000_000))
        const compositionTimeOffsetUs = Math.round(((sample.cts - sample.dts) / sample.timescale) * 1_000_000)

        muxer.addVideoChunkRaw(
            new Uint8Array(sample.data),
            sample.isRap ? 'key' : 'delta',
            timestampUs,
            durationUs,
            index === 0
                ? {
                        decoderConfig: {
                            ...getVideoDecoderConfig(track),
                        },
                    }
                : undefined,
            compositionTimeOffsetUs,
        )

        sample.data = new ArrayBuffer(0)
    }
}

globalThis.onmessage = async (event: MessageEvent<ExportWorkerRequest>) => {
    const message = event.data
    let parsedVideoTrack: ParsedVideoTrack | null = null
    let mixedAudio: ExportWorkerAudioBuffer | null = message.payload.mixedAudio
    let muxerTarget: ArrayBufferTarget | null = null
    let transcodedVideoBuffer: ArrayBuffer | null = null
    let input: Input | null = null

    if (message.type !== 'export-preview') {
        globalThis.postMessage({ type: 'error', error: '未知任务类型' } satisfies ExportWorkerMessage)
        return
    }

    try {
        validatePlan(message.payload.plan)
        postProgress(0.05, 'Worker 已接收导出任务。')

        const { plan, clip1 } = message.payload
        const sourceWidth = clip1.width ?? 0
        const sourceHeight = clip1.height ?? 0

        if (sourceWidth <= 0 || sourceHeight <= 0) {
            throw new Error('缺少源视频分辨率信息，无法进行 WebCodecs 转码。')
        }

        const dimensions = normalizeVideoCompressionDimensions(sourceWidth, sourceHeight)
        const sourceBlob = new Blob([clip1.buffer], { type: clip1.mimeType || 'video/mp4' })
        input = new Input({
            source: new BlobSource(sourceBlob),
            formats: ALL_FORMATS,
        })

        const target = new BufferTarget()
        const output = new Output({
            format: new Mp4OutputFormat(),
            target,
        })

        postProgress(0.1, '开始使用 mediabunny 进行视频转码。')
        const videoOptions = {
            codec: 'avc',
            bitrate: WEBCODECS_COMPRESSION_PRESET.bitrate,
            width: dimensions.width,
            height: dimensions.height,
            fit: 'contain',
            frameRate: WEBCODECS_COMPRESSION_PRESET.framerate,
            forceTranscode: true,
            allowRotationMetadata: false,
        } satisfies ConversionVideoOptions

        const conversion = await Conversion.init({
            input,
            output,
            trim: {
                start: plan.clip1StartSec,
                end: plan.clip1StartSec + plan.outputDurationSec,
            },
            audio: {
                discard: true,
            },
            video: videoOptions,
        })

        if (!conversion.isValid) {
            throw new Error('当前环境无法完成该视频的 WebCodecs 转码。')
        }

        conversion.onProgress = (progress: number) => {
            const mappedProgress = 0.2 + Math.min(1, Math.max(0, progress)) * 0.5
            postProgress(mappedProgress, 'mediabunny 正在转码视频。')
        }

        await conversion.execute()

        if (!target.buffer) {
            throw new Error('mediabunny 未生成视频输出缓冲区。')
        }

        transcodedVideoBuffer = target.buffer
        postProgress(0.75, '视频转码完成，正在解析输出。')

        message.payload.clip1.buffer = new ArrayBuffer(0)

        postProgress(0.8, '正在解析转码后的视频样本。')
        parsedVideoTrack = await parseVideoTrack(transcodedVideoBuffer)
        muxerTarget = new ArrayBufferTarget()
        const muxer = new Muxer({
            target: muxerTarget,
            video: {
                codec: 'avc',
                width: parsedVideoTrack.width,
                height: parsedVideoTrack.height,
                frameRate: undefined,
            },
            audio: {
                codec: 'aac',
                numberOfChannels: message.payload.mixedAudio.numberOfChannels,
                sampleRate: message.payload.mixedAudio.sampleRate,
            },
            fastStart: false,
            firstTimestampBehavior: 'offset',
        })

        muxVideoTrack(parsedVideoTrack, muxer)
        postProgress(0.86, '视频样本重封装完成。')

        await encodeAudioTrack(mixedAudio, muxer)
        clearWorkerAudioBuffer(mixedAudio)
        mixedAudio = null
        postProgress(0.92, '音频编码完成。')

        postProgress(0.95, '正在封装最终 MP4。')
        muxer.finalize()

        globalThis.postMessage({
            type: 'success',
            blob: new Blob([muxerTarget.buffer], { type: 'video/mp4' }),
            fileName: `temotoalign-webcodecs-${Date.now()}.mp4`,
        } satisfies ExportWorkerMessage)
        postProgress(1, '导出成功。')
    }
    catch (error) {
        console.error('WebCodecs export worker error:', error)
        globalThis.postMessage({
            type: 'error',
            error: error instanceof Error ? error.message : 'Worker 导出失败',
        } satisfies ExportWorkerMessage)
    }
    finally {
        message.payload.clip1.buffer = new ArrayBuffer(0)
        clearParsedVideoTrack(parsedVideoTrack)
        clearWorkerAudioBuffer(mixedAudio)

        parsedVideoTrack = null
        mixedAudio = null
        muxerTarget = null
        transcodedVideoBuffer = null

        input?.dispose()
        input = null
    }
}
