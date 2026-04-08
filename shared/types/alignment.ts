export type CapabilityStatus = 'allow' | 'limited' | 'deny'
export type AlignTaskPhase = 'idle' | 'probing' | 'aligning' | 'ready' | 'exporting' | 'done' | 'failed'
export type ExportMethod = 'remux' | 'webcodecs'

export interface AlignConfig {
    audioSr: number
    audioHopLength: number
    audioNfft: number
    audioSearchRangeSec: number
    audioMinOverlapSec: number
    audioConfidenceFloor: number
    audioMaxDurationSec: number
    audio1GainDb: number
    audio2GainDb: number
    audioReverbWet: number
    outputAudioBitrateK: number
}

export interface AlignResult {
    clip1AnchorSec: number
    clip2AnchorSec: number
    offsetSec: number
    clip1StartSec: number
    clip2StartSec: number
    outputDurationSec: number
    confidence: number
    method: string
    warnings: string[]
}

export interface MediaProbeResult {
    durationSec: number
    hasAudio: boolean
    hasVideo: boolean
    width?: number
    height?: number
    mimeType: string
    fileName: string
    fileSize: number
    mediaKind: 'audio' | 'video'
}

export interface PreparedAudioPayload {
    base64: string
    sampleRate: number
    durationSec: number
}

export interface ExportPlan {
    clip1StartSec: number
    clip2StartSec: number
    outputDurationSec: number
    muteClip1: boolean
    muteClip2: boolean
    audio1GainDb: number
    audio2GainDb: number
    audioReverbWet: number
}

export interface CapabilityIssue {
    code: string
    message: string
    fatal: boolean
}

export interface CodecSupport {
    codec: 'audio-aac' | 'video-remux'
    supported: boolean
    reason?: string
}

export interface ExportCapabilityReport {
    status: CapabilityStatus
    platform: string
    issues: CapabilityIssue[]
    codecs: CodecSupport[]
    maxWidth: number
    maxFps: number
    supportsFilesystemSave: boolean
    supportsWorker: boolean
    supportsOfflineAudio: boolean
    supportsVideoEncoding: boolean
}

export interface AlignRequestPayload {
    config: AlignConfig
    clip1FileName: string
    clip2FileName: string
    clip1AudioBase64: string
    clip2AudioBase64: string
}

export interface AlignResponsePayload {
    result: AlignResult
}

export interface ExportTaskState {
    id: string
    phase: AlignTaskPhase
    progress: number
    message: string
    outputFileName?: string
    outputSavedPath?: string
    error?: string
}

export interface ExportWorkerSourceFile {
    fileName: string
    mimeType: string
    size: number
    width?: number
    height?: number
    buffer: ArrayBuffer
}

export interface ExportWorkerAuxSourceFile {
    fileName: string
    mimeType: string
    size: number
    width?: number
    height?: number
}

export interface ExportWorkerAudioBuffer {
    sampleRate: number
    numberOfChannels: number
    length: number
    channels: ArrayBuffer[]
}

export interface ExportWorkerRequest {
    type: 'export-preview'
    payload: {
        plan: ExportPlan
        clip1: ExportWorkerSourceFile
        clip2?: ExportWorkerAuxSourceFile
        mixedAudio: ExportWorkerAudioBuffer
    }
}

export interface ExportWorkerProgressMessage {
    type: 'progress'
    progress: number
    message: string
}

export interface ExportWorkerSuccessMessage {
    type: 'success'
    blob: Blob
    fileName: string
}

export interface ExportWorkerErrorMessage {
    type: 'error'
    error: string
}

export type ExportWorkerMessage = ExportWorkerProgressMessage | ExportWorkerSuccessMessage | ExportWorkerErrorMessage
