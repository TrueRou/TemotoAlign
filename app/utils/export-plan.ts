export function buildExportPlan(result: AlignResult, options: {
    audio1GainDb: number
    audio2GainDb: number
    audioReverbWet: number
    muteClip1?: boolean
    muteClip2?: boolean
}): ExportPlan {
    return {
        clip1StartSec: result.clip1StartSec,
        clip2StartSec: result.clip2StartSec,
        outputDurationSec: result.outputDurationSec,
        muteClip1: Boolean(options.muteClip1),
        muteClip2: Boolean(options.muteClip2),
        audio1GainDb: options.audio1GainDb,
        audio2GainDb: options.audio2GainDb,
        audioReverbWet: options.audioReverbWet,
    }
}
