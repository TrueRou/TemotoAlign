<script setup lang="ts">
const props = defineProps<{
    label: string
    accept: string
    file: File | null
    probe?: MediaProbeResult | null
}>()

const emit = defineEmits<{
    update: [file: File | null]
}>()

const isDragging = ref(false)

function onChange(event: Event) {
    const target = event.target as HTMLInputElement
    emit('update', target.files?.[0] || null)
}

function onDrop(event: DragEvent) {
    isDragging.value = false
    const file = event.dataTransfer?.files?.[0]
    if (file)
        emit('update', file)
}

function clearFile() {
    emit('update', null)
}

function formatFileSize(size: number): string {
    if (size <= 0)
        return '0 MB'
    return `${(size / 1024 / 1024).toFixed(2)} MB`
}

function formatDuration(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
}

const isVideo = computed(() => {
    if (props.file?.type)
        return props.file.type.startsWith('video/')
    return props.accept.includes('video/')
})
</script>

<template>
    <div
        class="h-full cursor-pointer rounded-lg bg-white p-4 transition-colors duration-200"
        :class="isDragging ? 'bg-[#0071e3]/5' : 'hover:bg-white/80'"
        @dragenter.prevent="isDragging = true"
        @dragover.prevent
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
    >
        <div class="flex flex-row items-start justify-between">
            <div class="min-w-0">
                <div class="apple-caption font-semibold text-[#1d1d1f]">
                    {{ props.label }}
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button
                    v-if="props.file"
                    class="flex items-center justify-center text-black/48 transition-colors hover:text-[#1d1d1f]"
                    aria-label="清除文件"
                    @click.stop="clearFile"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
                <div class="rounded-full bg-[#f5f5f7] px-3 py-1 apple-micro text-black/60">
                    浏览文件
                </div>
            </div>
        </div>

        <div
            class="relative mt-4 rounded-lg p-4 transition-colors duration-200 sm:p-5"
            :class="isDragging ? 'bg-[#0071e3]/5' : 'bg-[#f5f5f7]'"
        >
            <input class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" type="file" :accept="props.accept" @change="onChange">

            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#0071e3]/8 text-[#0071e3]">
                    <svg v-if="isVideo" xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" />
                    </svg>
                </div>

                <div class="min-w-0 flex-1">
                    <div v-if="isDragging" class="apple-caption font-medium text-[#0071e3]">
                        松开以选择文件
                    </div>
                    <div v-else-if="props.file" class="break-all apple-caption font-medium text-[#1d1d1f] sm:truncate">
                        {{ props.file.name }}
                    </div>
                    <div v-else class="apple-caption text-black/48">
                        点击或拖拽文件到此处
                    </div>

                    <div v-if="!isDragging" class="mt-1 apple-micro text-black/48 wrap-break-word">
                        {{ props.file ? formatFileSize(props.file.size) : props.accept }}
                    </div>

                    <div v-if="props.probe && props.file && !isDragging" class="mt-2 flex flex-wrap gap-1.5">
                        <span class="rounded-full bg-[#e8e8ed] px-2 py-0.5 apple-micro">{{ formatDuration(props.probe.durationSec) }}</span>
                        <span v-if="props.probe.width && props.probe.height" class="rounded-full bg-[#e8e8ed] px-2 py-0.5 apple-micro">{{ props.probe.width }}x{{ props.probe.height }}</span>
                        <span class="rounded-full bg-[#e8e8ed] px-2 py-0.5 apple-micro">{{ formatFileSize(props.probe.fileSize) }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
