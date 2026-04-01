<script setup lang="ts">
type TrackId = 'clip1' | 'clip2'

interface TimelineTrack {
    id: TrackId
    label: string
    subtitle: string
    colorClass: string
    glowClass: string
    startSec: number
    durationSec: number
    gainDb: number
    muted: boolean
    widthPercent: number
    offsetPercent: number
}

const props = defineProps<{
    tracks: TimelineTrack[]
    durationSec: number
    cursorSec: number
    cursorPercent: number
    previewOffsetSec: number
    previewObjectUrl: string | null
    config: AlignConfig
}>()

const emit = defineEmits<{
    'update:cursorSec': [value: number]
    'update:audio1GainDb': [value: number]
    'update:audio2GainDb': [value: number]
    'toggleMute': [trackId: TrackId]
}>()

const previewVideo = ref<HTMLVideoElement | null>(null)
const syncingPreviewVideo = ref(false)

function formatSeconds(value: number): string {
    if (!Number.isFinite(value))
        return '0.00s'
    return `${value.toFixed(2)}s`
}

function onCursorInput(event: Event) {
    const value = Number((event.target as HTMLInputElement).value)
    emit('update:cursorSec', Math.max(0, Math.min(value, props.durationSec)))
}

function syncPreviewVideoTime() {
    if (!previewVideo.value || syncingPreviewVideo.value)
        return
    syncingPreviewVideo.value = true
    previewVideo.value.currentTime = Math.min(
        Math.max(0, props.previewOffsetSec),
        Math.max(0, (props.tracks[0]?.durationSec ?? 0) - 0.05),
    )
    window.requestAnimationFrame(() => {
        syncingPreviewVideo.value = false
    })
}

watch(() => props.previewOffsetSec, () => syncPreviewVideoTime())
</script>

<template>
    <section class="rounded-4xl border border-base-300 bg-base-100 p-6">
        <div class="space-y-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 class="text-xl font-semibold">
                        可视化时间轴
                    </h2>
                    <p class="text-sm opacity-70">
                        对齐完成后会按起始时间排布。拖动底部游标即可预览。
                    </p>
                </div>
                <div class="flex flex-wrap gap-2 text-xs">
                    <span class="rounded-full border border-base-300 px-3 py-1">时间轴总长 {{ formatSeconds(props.durationSec) }}</span>
                    <span class="rounded-full border border-base-300 px-3 py-1">预览位置 {{ formatSeconds(props.previewOffsetSec) }}</span>
                </div>
            </div>

            <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
                <div class="rounded-3xl bg-base-200 p-4">
                    <div class="mb-4 flex items-center justify-between text-xs opacity-60">
                        <span>0s</span>
                        <span>{{ formatSeconds(props.durationSec / 2) }}</span>
                        <span>{{ formatSeconds(props.durationSec) }}</span>
                    </div>

                    <div class="space-y-4">
                        <div
                            v-for="track in props.tracks"
                            :key="track.id"
                            class="flex gap-3 rounded-2xl bg-base-100/70 p-3"
                        >
                            <div class="relative flex min-h-24 flex-1 items-center overflow-hidden rounded-2xl bg-base-300/40 px-3">
                                <div class="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-base-content/10" />
                                <div class="absolute inset-y-2 left-0 w-px bg-base-content/10" />
                                <div class="absolute inset-y-2 right-0 w-px bg-base-content/10" />
                                <div
                                    class="absolute inset-y-3 rounded-xl bg-linear-to-r shadow-lg"
                                    :class="[track.colorClass, track.glowClass, track.muted ? 'opacity-35' : 'opacity-95']"
                                    :style="{
                                        left: `${Math.min(track.offsetPercent, 100)}%`,
                                        width: `${Math.max(Math.min(track.widthPercent, 100 - track.offsetPercent), 4)}%`,
                                    }"
                                >
                                    <div v-if="track.durationSec" class="flex h-full items-center justify-between px-4 text-[11px] font-medium text-primary-content">
                                        <span>{{ formatSeconds(track.startSec) }}</span>
                                        <span>{{ formatSeconds(track.durationSec) }}</span>
                                    </div>
                                </div>
                                <div
                                    class="pointer-events-none absolute inset-y-1 w-0.5 bg-accent shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
                                    :style="{ left: `${props.cursorPercent}%` }"
                                />
                            </div>
                        </div>
                    </div>

                    <div class="mt-4 rounded-2xl bg-base-100/80 p-4">
                        <input
                            :value="props.cursorSec"
                            class="range range-accent w-full"
                            type="range"
                            min="0"
                            :max="props.durationSec"
                            step="0.01"
                            @input="onCursorInput"
                        >
                    </div>
                </div>

                <div class="rounded-3xl bg-base-200 p-4">
                    <div class="mb-4">
                        <h3 class="text-lg font-semibold">
                            控制区
                        </h3>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="rounded-2xl bg-base-100/80 p-4">
                            <div class="text-sm font-semibold">
                                Clip1
                            </div>
                            <div class="mt-1 text-xs opacity-60">
                                手元视频
                            </div>
                            <div class="mt-4 flex h-40 items-center justify-center">
                                <div class="relative flex h-36 w-16 items-center justify-center">
                                    <input
                                        :value="props.config.audio1GainDb"
                                        class="range range-primary absolute w-36 -rotate-90"
                                        type="range"
                                        min="-18"
                                        max="6"
                                        step="0.5"
                                        @input="emit('update:audio1GainDb', Number(($event.target as HTMLInputElement).value))"
                                    >
                                </div>
                            </div>
                            <div class="text-center text-sm font-medium text-primary">
                                {{ props.config.audio1GainDb.toFixed(1) }} dB
                            </div>
                            <div class="mt-3 flex justify-center">
                                <button
                                    class="btn btn-sm"
                                    :class="props.tracks[0]?.muted ? 'btn-error' : 'btn-outline btn-primary'"
                                    @click="emit('toggleMute', 'clip1')"
                                >
                                    {{ props.tracks[0]?.muted ? '取消静音' : '静音轨道' }}
                                </button>
                            </div>
                        </div>

                        <div class="rounded-2xl bg-base-100/80 p-4">
                            <div class="text-sm font-semibold">
                                Clip2
                            </div>
                            <div class="mt-1 text-xs opacity-60">
                                对齐音轨
                            </div>
                            <div class="mt-4 flex h-40 items-center justify-center">
                                <div class="relative flex h-36 w-16 items-center justify-center">
                                    <input
                                        :value="props.config.audio2GainDb"
                                        class="range range-secondary absolute w-36 -rotate-90"
                                        type="range"
                                        min="-18"
                                        max="6"
                                        step="0.5"
                                        @input="emit('update:audio2GainDb', Number(($event.target as HTMLInputElement).value))"
                                    >
                                </div>
                            </div>
                            <div class="text-center text-sm font-medium text-secondary">
                                {{ props.config.audio2GainDb.toFixed(1) }} dB
                            </div>
                            <div class="mt-3 flex justify-center">
                                <button
                                    class="btn btn-sm"
                                    :class="props.tracks[1]?.muted ? 'btn-error' : 'btn-outline btn-secondary'"
                                    @click="emit('toggleMute', 'clip2')"
                                >
                                    {{ props.tracks[1]?.muted ? '取消静音' : '静音轨道' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
