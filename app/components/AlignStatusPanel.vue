<script setup lang="ts">
const props = defineProps<{
    result: AlignResult | null
    task: ExportTaskState
}>()

const confidenceIndicator = computed(() => {
    if (!props.result)
        return null
    const c = props.result.confidence
    if (c >= 0.7)
        return { label: '高', cls: 'text-[#34c759]' }
    if (c >= 0.4)
        return { label: '中', cls: 'text-[#ff9f0a]' }
    return { label: '低', cls: 'text-[#ff3b30]' }
})
</script>

<template>
    <div class="rounded-lg bg-[#272729] p-5">
        <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <h2 class="text-lg font-semibold text-white">
                    任务状态
                </h2>
                <span v-if="confidenceIndicator" class="apple-caption font-semibold" :class="confidenceIndicator.cls">
                    置信度: {{ confidenceIndicator.label }}
                </span>
            </div>
            <div class="apple-micro text-white/50">
                {{ Math.round(props.task.progress * 100) }}%
            </div>
        </div>

        <div v-if="props.result" class="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div class="rounded-lg bg-[#1d1d1f] p-3">
                <div class="apple-micro text-white/50">
                    Clip1 起点
                </div>
                <div class="mt-1 apple-caption font-semibold text-white">
                    {{ props.result.clip1StartSec.toFixed(3) }}s
                </div>
            </div>
            <div class="rounded-lg bg-[#1d1d1f] p-3">
                <div class="apple-micro text-white/50">
                    Clip2 起点
                </div>
                <div class="mt-1 apple-caption font-semibold text-white">
                    {{ props.result.clip2StartSec.toFixed(3) }}s
                </div>
            </div>
            <div class="rounded-lg bg-[#1d1d1f] p-3">
                <div class="apple-micro text-white/50">
                    偏移
                </div>
                <div class="mt-1 apple-caption font-semibold text-white">
                    {{ props.result.offsetSec.toFixed(3) }}s
                </div>
            </div>
            <div class="rounded-lg bg-[#1d1d1f] p-3">
                <div class="apple-micro text-white/50">
                    导出时长
                </div>
                <div class="mt-1 apple-caption font-semibold text-white">
                    {{ props.result.outputDurationSec.toFixed(3) }}s
                </div>
            </div>
        </div>

        <div v-if="props.result?.segmentCountUsed" class="mt-3 apple-micro text-white/50">
            匹配片段: {{ (props.result.segmentIndex ?? 0) + 1 }} / {{ props.result.segmentCountUsed }}
        </div>

        <div class="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
                class="h-full rounded-full bg-[#0071e3] transition-all duration-300"
                :style="{ width: `${props.task.progress * 100}%` }"
            />
        </div>
        <div class="mt-2 apple-caption text-white/70">
            {{ props.task.message }}
        </div>

        <div v-if="props.result?.warnings?.length" class="mt-3 space-y-2">
            <div v-for="(warn, i) in props.result.warnings" :key="i" class="rounded-lg bg-[#ff9f0a]/10 p-3 apple-caption text-[#ff9f0a]">
                {{ warn }}
            </div>
        </div>

        <div v-if="props.task.error" class="mt-4 rounded-lg bg-[#ff3b30]/10 p-3 apple-caption text-[#ff3b30]">
            {{ props.task.error }}
        </div>
        <div v-else-if="props.task.outputSavedPath" class="mt-3 apple-caption text-white/50">
            已保存：{{ props.task.outputSavedPath }}
        </div>
    </div>
</template>
