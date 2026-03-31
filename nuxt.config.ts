import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: process.env.NODE_ENV === 'development' },
    modules: ['@pinia/nuxt', '@nuxt/eslint'],
    css: ['~/assets/css/main.css'],
    srcDir: 'app/',
    vite: {
        plugins: [
            tailwindcss(),
        ],
        build: {
            sourcemap: false,
        },
        worker: {
            format: 'es',
        },
    },
    eslint: {
        config: {
            standalone: false,
        },
    },
    runtimeConfig: {
        otoge: {
            baseURL: process.env.NUXT_OTOGE_BASE_URL || 'https://api.turou.fun/otoge',
            developerToken: process.env.NUXT_OTOGE_DEVELOPER_TOKEN || 'c4f33434df6d5e22a91283e68c9899f9',
            timeoutMs: Number(process.env.NUXT_OTOGE_TIMEOUT_MS || 120000),
        },
        public: {
            appName: 'TemotoAlign',
            maxUploadBytes: Number(process.env.NUXT_PUBLIC_MAX_UPLOAD_BYTES || 524288000),
            supportedVideoCodecs: ['avc1.42001f', 'avc1.4d401f', 'hvc1.1.6.L93.B0'],
            supportedAudioMimeTypes: ['audio/wav', 'audio/mp4', 'audio/mpeg'],
            supportBaseline: {
                web: {
                    chrome: 121,
                    safari: 18,
                },
                ios: 18,
                androidWebView: 121,
            },
        },
    },
    nitro: {
        preset: 'node-server',
    },
})
