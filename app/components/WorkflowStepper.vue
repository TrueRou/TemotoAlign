<script setup lang="ts">
const props = defineProps<{
    currentStep: number
}>()

const steps = [
    { label: '选择素材' },
    { label: '对齐' },
    { label: '预览 / 导出' },
]
</script>

<template>
    <div class="flex items-center justify-center gap-0">
        <template v-for="(step, index) in steps" :key="index">
            <div class="flex items-center gap-2">
                <div
                    class="flex size-6 items-center justify-center rounded-full apple-micro font-semibold transition-colors"
                    :class="index < props.currentStep
                        ? 'bg-[#0071e3] text-white'
                        : 'bg-white/20 text-white/60'"
                >
                    {{ index + 1 }}
                </div>
                <span
                    class="apple-micro"
                    :class="index < props.currentStep ? 'text-white font-semibold' : 'text-white/48'"
                >
                    {{ step.label }}
                </span>
            </div>
            <div
                v-if="index < steps.length - 1"
                class="mx-3 h-px w-8 transition-colors sm:w-12"
                :class="index < props.currentStep - 1 ? 'bg-[#0071e3]' : 'bg-white/20'"
            />
        </template>
    </div>
</template>
