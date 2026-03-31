<script setup lang="ts">
const props = defineProps<{
    label: string
    accept: string
    file: File | null
}>()

const emit = defineEmits<{
    update: [file: File | null]
}>()

function onChange(event: Event) {
    const target = event.target as HTMLInputElement
    emit('update', target.files?.[0] || null)
}

function formatFileSize(size: number): string {
    if (size <= 0) {
        return '0 MB'
    }

    return `${(size / 1024 / 1024).toFixed(2)} MB`
}
</script>

<template>
    <div
        class="cursor-pointer rounded-3xl border border-base-300 bg-linear-to-br from-base-100 to-base-200/70 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
    >
        <div class="flex flex-row items-start justify-between">
            <div class="min-w-0">
                <div class="text-sm font-semibold tracking-wide text-base-content">
                    {{ props.label }}
                </div>
            </div>
            <div class="w-fit rounded-full border border-base-300 bg-base-100/80 px-3 py-1 text-xs opacity-70 transition group-hover:border-primary/30 group-hover:text-primary">
                浏览文件
            </div>
        </div>

        <div class="relative mt-4 rounded-2xl border border-dashed border-base-300 bg-base-100/60 p-4 transition group-hover:border-primary/40 group-hover:bg-primary/5 sm:p-5">
            <input class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" type="file" :accept="props.accept" @change="onChange">

            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0-4 4m4-4 4 4M4 16.5v1.25A2.25 2.25 0 0 0 6.25 20h11.5A2.25 2.25 0 0 0 20 17.75V16.5" />
                    </svg>
                </div>

                <div class="min-w-0 flex-1">
                    <div v-if="props.file" class="break-all text-sm font-medium text-base-content sm:truncate">
                        {{ props.file.name }}
                    </div>
                    <div v-else class="text-sm font-medium text-base-content/80">
                        点击此处选择文件
                    </div>

                    <div class="mt-1 text-xs opacity-60 wrap-break-word">
                        {{ props.file ? formatFileSize(props.file.size) : props.accept }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
