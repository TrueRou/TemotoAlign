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
</script>

<template>
    <label class="form-control w-full gap-2">
        <div class="label">
            <span class="label-text font-medium">{{ label }}</span>
        </div>
        <input class="file-input file-input-bordered w-full" type="file" :accept="accept" @change="onChange">
        <div class="text-sm opacity-70">
            {{ file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : '尚未选择文件' }}
        </div>
    </label>
</template>
