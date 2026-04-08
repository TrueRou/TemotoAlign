<script setup lang="ts">
const props = defineProps<{
    result: AlignResult | null
    task: ExportTaskState
}>()

const confidenceBadge = computed(() => {
    if (!props.result)
        return null
    const c = props.result.confidence
    if (c >= 0.7)
        return { label: '高', cls: 'badge-success' }
    if (c >= 0.4)
        return { label: '中', cls: 'badge-warning' }
    return { label: '低', cls: 'badge-error' }
})
</script>

<template>
    <div class="rounded-3xl border border-base-300 bg-base-100/80 p-5">
        <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <h2 class="text-lg font-semibold">
                    任务状态
                </h2>
                <div v-if="confidenceBadge" class="badge badge-sm" :class="confidenceBadge.cls">
                    置信度: {{ confidenceBadge.label }}
                </div>
            </div>
            <div class="text-right text-xs opacity-60">
                <div>{{ Math.round(props.task.progress * 100) }}%</div>
            </div>
        </div>

        <div v-if="props.result" class="mt-4 grid grid-cols-2 gap-3 text-sm xl:grid-cols-4">
            <div class="rounded-2xl bg-base-200 p-3">
                <div class="opacity-60">
                    Clip1 起点
                </div>
                <div class="mt-1 font-semibold">
                    {{ props.result.clip1StartSec.toFixed(3) }}s
                </div>
            </div>
            <div class="rounded-2xl bg-base-200 p-3">
                <div class="opacity-60">
                    Clip2 起点
                </div>
                <div class="mt-1 font-semibold">
                    {{ props.result.clip2StartSec.toFixed(3) }}s
                </div>
            </div>
            <div class="rounded-2xl bg-base-200 p-3">
                <div class="opacity-60">
                    偏移
                </div>
                <div class="mt-1 font-semibold">
                    {{ props.result.offsetSec.toFixed(3) }}s
                </div>
            </div>
            <div class="rounded-2xl bg-base-200 p-3">
                <div class="opacity-60">
                    导出时长
                </div>
                <div class="mt-1 font-semibold">
                    {{ props.result.outputDurationSec.toFixed(3) }}s
                </div>
            </div>
        </div>

        <div v-if="props.result?.segmentCountUsed" class="mt-3 text-xs opacity-60">
            匹配片段: {{ (props.result.segmentIndex ?? 0) + 1 }} / {{ props.result.segmentCountUsed }}
        </div>

        <progress class="progress progress-primary mt-4 w-full" :value="props.task.progress" max="1" />
        <div class="mt-2 text-sm opacity-80">
            {{ props.task.message }}
        </div>

        <div v-if="props.result?.warnings?.length" class="mt-3 space-y-2">
            <div v-for="(warn, i) in props.result.warnings" :key="i" class="alert alert-warning py-2 text-sm">
                <span>{{ warn }}</span>
            </div>
        </div>

        <div v-if="props.task.error" class="alert alert-error mt-4">
            <span>{{ props.task.error }}</span>
        </div>
        <div v-else-if="props.task.outputSavedPath" class="mt-3 text-sm opacity-70">
            已保存：{{ props.task.outputSavedPath }}
        </div>
    </div>
</template>
