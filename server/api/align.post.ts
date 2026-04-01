function base64ToArrayBuffer(data: string): ArrayBuffer {
    const content = data.includes(',') ? data.split(',').at(-1) || '' : data
    const bytes = Uint8Array.from(Buffer.from(content, 'base64'))
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

export default defineEventHandler(async (event): Promise<AlignResponsePayload> => {
    const body = await readBody<AlignRequestPayload>(event)
    const config = useRuntimeConfig(event)

    if (!body?.clip1AudioBase64 || !body?.clip2AudioBase64) {
        throw createError({ statusCode: 400, statusMessage: '缺少音频输入数据' })
    }

    const formData = new FormData()
    formData.append('sample_rate', String(body.config.audioSr))
    formData.append('hop_length', String(body.config.audioHopLength))
    formData.append('n_fft', String(body.config.audioNfft))
    formData.append('search_range_sec', String(body.config.audioSearchRangeSec))
    formData.append('min_overlap_sec', String(body.config.audioMinOverlapSec))
    formData.append('confidence_floor', String(body.config.audioConfidenceFloor))
    formData.append('max_duration_sec', String(body.config.audioMaxDurationSec))
    formData.append('prefer_tail', String(body.config.preferTail))
    formData.append('segment_count', String(body.config.segmentCount))
    formData.append('tail_bias_weight', String(body.config.tailBiasWeight))
    formData.append('audio_a', new Blob([base64ToArrayBuffer(body.clip1AudioBase64)], { type: 'audio/wav' }), `${body.clip1FileName}.wav`)
    formData.append('audio_b', new Blob([base64ToArrayBuffer(body.clip2AudioBase64)], { type: 'audio/wav' }), `${body.clip2FileName}.wav`)

    const payload = await $fetch<Record<string, any>>(`${config.otoge.baseURL.replace(/\/$/, '')}/audalign/audalign/align`, {
        method: 'POST',
        headers: config.otoge.developerToken
            ? { 'x-developer-token': config.otoge.developerToken }
            : undefined,
        body: formData,
    })

    if (Number(payload.code) !== 200 || !payload.data) {
        throw createError({
            statusCode: 502,
            statusMessage: `对齐服务返回异常: ${payload.message || 'unknown error'}`,
        })
    }

    const data = payload.data as Record<string, any>
    const result: AlignResult = {
        clip1AnchorSec: Number(data.anchor_a_sec || 0),
        clip2AnchorSec: Number(data.anchor_b_sec || 0),
        offsetSec: Number(data.offset_sec || 0),
        clip1StartSec: Number(data.start_a_sec || 0),
        clip2StartSec: Number(data.start_b_sec || 0),
        outputDurationSec: Number(data.overlap_duration_sec || 0),
        confidence: Number(data.confidence || 0),
        method: String(data.method || 'audio_remote'),
        warnings: Array.isArray(data.warnings) ? data.warnings.map(item => String(item)) : [],
        segmentIndex: data.segment_index != null ? Number(data.segment_index) : undefined,
        segmentCountUsed: data.segment_count_used != null ? Number(data.segment_count_used) : undefined,
    }

    return {
        result,
    }
})
