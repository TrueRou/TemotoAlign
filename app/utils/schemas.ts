import { z } from 'zod'

export const alignConfigSchema = z.object({
    audioSr: z.number().int().min(8000).max(96000),
    audioHopLength: z.number().int().min(64).max(4096),
    audioNfft: z.number().int().min(256).max(8192),
    audioSearchRangeSec: z.number().min(3).max(60),
    audioMinOverlapSec: z.number().min(3).max(60),
    audioConfidenceFloor: z.number().min(0).max(1),
    audioMaxDurationSec: z.number().min(30).max(900),
    audio1GainDb: z.number().min(-18).max(6),
    audio2GainDb: z.number().min(-18).max(6),
    audioReverbWet: z.number().min(0).max(0.6),
    outputAudioBitrateK: z.number().int().min(96).max(320),
})

export const mediaInputSchema = z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    size: z.number().int().positive(),
})
