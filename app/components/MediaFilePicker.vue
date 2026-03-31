<script setup lang="ts">
defineProps<{
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
    <label
        class="group block cursor-pointer rounded-3xl border border-base-300 bg-linear-to-br from-base-100 to-base-200/70 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
    >
        <div class="flex items-start justify-between gap-4">
            <div>
                <div class="text-sm font-semibold tracking-wide text-base-content">
                    {{ label }}
                </div>
                <div class="mt-1 text-xs opacity-60">
                    选择本地媒体文件后将自动读取元数据
                </div>
            </div>
            <div class="rounded-full border border-base-300 bg-base-100/80 px-3 py-1 text-xs opacity-70 transition group-hover:border-primary/30 group-hover:text-primary">
                浏览文件
            </div>
        </div>

        <div class="mt-4 rounded-2xl border border-dashed border-base-300 bg-base-100/60 p-4 transition group-hover:border-primary/40 group-hover:bg-primary/5">
            <input class="hidden" type="file" :accept="accept" @change="onChange">

            <div class="flex items-center gap-4">
                <div class="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0-4 4m4-4 4 4M4 16.5v1.25A2.25 2.25 0 0 0 6.25 20h11.5A2.25 2.25 0 0 0 20 17.75V16.5" />
                    </svg>
                </div>

                <div class="min-w-0 flex-1">
                    <div v-if="file" class="truncate text-sm font-medium text-base-content">
                        {{ file.name }}
                    </div>
                    <div v-else class="text-sm font-medium text-base-content/80">
                        点击此处选择文件
                    </div>

                    <div class="mt-1 text-xs opacity-60">
                        {{ file ? formatFileSize(file.size) : accept }}
                    </div>
                </div>
            </div>
        </div>
    </label>
</template>
