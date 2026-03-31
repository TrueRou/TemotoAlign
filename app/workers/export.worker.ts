import type { ExportPlan, ExportWorkerAudioBuffer, ExportWorkerMessage, ExportWorkerRequest } from '../../shared/types/alignment'
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
    description?: Uint8Array
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
    track.description = undefined
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

function validatePlan(plan: ExportPlan) {
    if (plan.outputDurationSec <= 0.5) {
        throw new Error('导出重叠时长不足，无法创建导出任务。')
    }
}

function getMuxerVideoCodec(codec: string): 'avc' | 'hevc' {
    if (codec.startsWith('avc1') || codec.startsWith('avc3')) {
        return 'avc'
    }

    if (codec.startsWith('hvc1') || codec.startsWith('hev1')) {
        return 'hevc'
    }

    throw new Error(`暂不支持直接封装的视频编码：${codec}`)
}

function postProgress(progress: number, message: string) {
    globalThis.postMessage({
        type: 'progress',
        progress,
        message,
    } satisfies ExportWorkerMessage)
}

function toMp4BoxBuffer(buffer: ArrayBuffer) {
    const mp4Buffer = buffer as ArrayBuffer & { fileStart: number }
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

function buildAvcDescription(avcC: any): Uint8Array {
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
        const payload = sps.data instanceof Uint8Array ? sps.data : new Uint8Array(sps.data || sps)
        const header = new Uint8Array(2)
        new DataView(header.buffer).setUint16(0, payload.byteLength)
        parts.push(header, payload)
    }

    parts.push(new Uint8Array([avcC.PPS.length]))
    for (const pps of avcC.PPS) {
        const payload = pps.data instanceof Uint8Array ? pps.data : new Uint8Array(pps.data || pps)
        const header = new Uint8Array(2)
        new DataView(header.buffer).setUint16(0, payload.byteLength)
        parts.push(header, payload)
    }

    if (avcC.ext?.byteLength) {
        parts.push(avcC.ext)
    }

    return concatUint8Arrays(parts)
}

function buildHevcDescription(hvcC: any): Uint8Array {
    const parts: Uint8Array[] = []
    const header = new Uint8Array(23)
    const view = new DataView(header.buffer)
    header[0] = hvcC.configurationVersion
    header[1] = ((hvcC.general_profile_space & 0x03) << 6) | ((hvcC.general_tier_flag & 0x01) << 5) | (hvcC.general_profile_idc & 0x1F)
    view.setUint32(2, hvcC.general_profile_compatibility >>> 0)
    header.set(hvcC.general_constraint_indicator || new Uint8Array(6), 6)
    header[12] = hvcC.general_level_idc
    view.setUint16(13, 0xF000 | (hvcC.min_spatial_segmentation_idc & 0x0FFF))
    header[15] = 0xFC | (hvcC.parallelismType & 0x03)
    header[16] = 0xFC | (hvcC.chroma_format_idc & 0x03)
    header[17] = 0xF8 | (hvcC.bit_depth_luma_minus8 & 0x07)
    header[18] = 0xF8 | (hvcC.bit_depth_chroma_minus8 & 0x07)
    view.setUint16(19, hvcC.avgFrameRate)
    header[21] = ((hvcC.constantFrameRate & 0x03) << 6) | ((hvcC.numTemporalLayers & 0x07) << 3) | ((hvcC.temporalIdNested & 0x01) << 2) | (hvcC.lengthSizeMinusOne & 0x03)
    header[22] = hvcC.nalu_arrays.length
    parts.push(header)

    for (const array of hvcC.nalu_arrays) {
        const arrayHeader = new Uint8Array(3)
        const arrayView = new DataView(arrayHeader.buffer)
        arrayHeader[0] = ((array.completeness || 0) << 7) | (array.nalu_type & 0x3F)
        arrayView.setUint16(1, array.length)
        parts.push(arrayHeader)

        for (const nalu of array) {
            const payload = nalu.data instanceof Uint8Array ? nalu.data : new Uint8Array(nalu.data)
            const unitHeader = new Uint8Array(2)
            new DataView(unitHeader.buffer).setUint16(0, payload.byteLength)
            parts.push(unitHeader, payload)
        }
    }

    return concatUint8Arrays(parts)
}

async function parseVideoTrack(buffer: ArrayBuffer): Promise<ParsedVideoTrack> {
    const mp4File = MP4Box.createFile(false)

    return await new Promise((resolve, reject) => {
        mp4File.onError = (_module: string, message: string) => reject(new Error(message))
        mp4File.onReady = (info: any) => {
            const track = info.videoTracks?.[0]
            if (!track) {
                reject(new Error('Clip1 中未找到视频轨'))
                return
            }

            const samples: ParsedTrackSample[] = []
            mp4File.onSamples = (_id: number, _user: unknown, parsedSamples: any[]) => {
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

            const trak = mp4File.moov?.traks?.find((entry: any) => entry.tkhd?.track_id === track.id)
            const sampleEntry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0] as any

            let description: Uint8Array | undefined
            if (sampleEntry?.avcC) {
                description = buildAvcDescription(sampleEntry.avcC)
            }
            else if (sampleEntry?.hvcC) {
                description = buildHevcDescription(sampleEntry.hvcC)
            }

            resolve({
                id: track.id,
                codec: track.codec,
                width: track.video?.width || track.track_width,
                height: track.video?.height || track.track_height,
                timescale: track.timescale,
                samples,
                description,
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

function getSelectedVideoSamples(track: ParsedVideoTrack, plan: ExportPlan): ParsedTrackSample[] {
    const sourceStartTicks = Math.floor(plan.clip1StartSec * track.timescale)
    const sourceEndTicks = Math.ceil((plan.clip1StartSec + plan.outputDurationSec) * track.timescale)
    const sortedSamples = [...track.samples].sort((left, right) => left.dts - right.dts || left.cts - right.cts)
    const firstInRangeIndex = sortedSamples.findIndex(sample => sample.cts + sample.duration > sourceStartTicks && sample.cts < sourceEndTicks)

    if (firstInRangeIndex < 0) {
        throw new Error('视频轨中没有可导出的样本。')
    }

    let decodeStartIndex = firstInRangeIndex
    while (decodeStartIndex > 0 && !sortedSamples[decodeStartIndex]?.isRap) {
        decodeStartIndex -= 1
    }

    if (!sortedSamples[decodeStartIndex]?.isRap) {
        decodeStartIndex = 0
    }

    const selectedSamples = sortedSamples.slice(decodeStartIndex).filter((sample, index) => {
        if (index === 0) {
            return true
        }

        return sample.cts < sourceEndTicks
    })

    if (selectedSamples.length === 0) {
        throw new Error('视频轨中没有可导出的样本。')
    }

    return selectedSamples
}

function muxVideoTrackDirect(
    track: ParsedVideoTrack,
    selectedSamples: ParsedTrackSample[],
    plan: ExportPlan,
    muxer: Muxer<ArrayBufferTarget>,
) {
    const sourceStartUs = Math.round(plan.clip1StartSec * 1_000_000)

    for (let index = 0; index < selectedSamples.length; index += 1) {
        const sample = selectedSamples[index]!
        const timestampUs = Math.round((sample.cts / sample.timescale) * 1_000_000) - sourceStartUs
        const durationUs = Math.round((sample.duration / sample.timescale) * 1_000_000)
        const compositionTimeOffsetUs = Math.round(((sample.cts - sample.dts) / sample.timescale) * 1_000_000)

        if (timestampUs + durationUs <= 0) {
            sample.data = new ArrayBuffer(0)
            continue
        }

        muxer.addVideoChunkRaw(
            new Uint8Array(sample.data),
            sample.isRap ? 'key' : 'delta',
            Math.max(0, timestampUs),
            Math.max(1, durationUs),
            index === 0 && track.description
                ? {
                        decoderConfig: {
                            codec: track.codec,
                            description: track.description,
                        },
                    }
                : undefined,
            compositionTimeOffsetUs,
        )

        sample.data = new ArrayBuffer(0)
        postProgress(0.3 + ((index + 1) / selectedSamples.length) * 0.5, `Worker 正在直通封装视频样本 ${index + 1}/${selectedSamples.length}`)
    }

    return {
        width: track.width,
        height: track.height,
    }
}

globalThis.onmessage = async (event: MessageEvent<ExportWorkerRequest>) => {
    const message = event.data
    let parsedVideoTrack: ParsedVideoTrack | null = null
    let selectedSamples: ParsedTrackSample[] | null = null
    let mixedAudio: ExportWorkerAudioBuffer | null = message.payload.mixedAudio
    let muxerTarget: ArrayBufferTarget | null = null

    if (message.type !== 'export-preview') {
        globalThis.postMessage({ type: 'error', error: '未知任务类型' })
        return
    }

    try {
        validatePlan(message.payload.plan)
        postProgress(0.12, 'Worker 已接收导出任务，开始解析视频轨。')

        parsedVideoTrack = await parseVideoTrack(message.payload.clip1.buffer)
        message.payload.clip1.buffer = new ArrayBuffer(0)
        selectedSamples = getSelectedVideoSamples(parsedVideoTrack, message.payload.plan)
        const outputWidth = parsedVideoTrack.width
        const outputHeight = parsedVideoTrack.height
        muxerTarget = new ArrayBufferTarget()
        const muxer = new Muxer({
            target: muxerTarget,
            video: {
                codec: getMuxerVideoCodec(parsedVideoTrack.codec),
                width: outputWidth,
                height: outputHeight,
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

        postProgress(0.2, 'Worker 已切换为强制视频直通封装模式，跳过全部视频转码。')

        const { width, height } = muxVideoTrackDirect(parsedVideoTrack, selectedSamples, message.payload.plan, muxer)
        clearParsedTrackSamples(selectedSamples)
        selectedSamples = null
        clearParsedVideoTrack(parsedVideoTrack)
        postProgress(0.86, `Worker 视频直通封装完成，分辨率 ${width}x${height}`)
        await encodeAudioTrack(mixedAudio, muxer)
        clearWorkerAudioBuffer(mixedAudio)
        mixedAudio = null
        postProgress(0.95, 'Worker 音频编码完成，正在封装 MP4...')
        muxer.finalize()

        globalThis.postMessage({
            type: 'success',
            blob: new Blob([muxerTarget.buffer], { type: 'video/mp4' }),
            fileName: `temotoalign-final-${Date.now()}.mp4`,
        } satisfies ExportWorkerMessage)
    }
    catch (error) {
        console.error('Worker error:', error)
        globalThis.postMessage({
            type: 'error',
            error: error instanceof Error ? error.message : 'Worker 导出失败',
        } satisfies ExportWorkerMessage)
    }
    finally {
        message.payload.clip1.buffer = new ArrayBuffer(0)
        clearParsedTrackSamples(selectedSamples)
        clearParsedVideoTrack(parsedVideoTrack)
        clearWorkerAudioBuffer(mixedAudio)

        parsedVideoTrack = null
        selectedSamples = null
        mixedAudio = null
        muxerTarget = null
    }
}
