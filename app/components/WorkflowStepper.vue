<script setup lang="ts">
const props = defineProps<{
    currentStep: number
}>()

const steps = [
    { label: '选择素材', icon: '1' },
    { label: '对齐', icon: '2' },
    { label: '预览 / 导出', icon: '3' },
]
</script>

<template>
    <ul class="steps w-full">
        <li
            v-for="(step, index) in steps"
            :key="index"
            class="step"
            :class="{ 'step-primary': index < props.currentStep }"
        >
            {{ step.label }}
        </li>
    </ul>
</template>
