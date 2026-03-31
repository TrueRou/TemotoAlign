<script setup lang="ts">
import type { AlignResult, ExportTaskState } from '../../../shared/types/alignment'

defineProps<{
    result: AlignResult | null
    task: ExportTaskState
}>()
</script>

<template>
    <section class="card bg-base-100 shadow-sm">
        <div class="card-body gap-4">
            <h2 class="card-title">任务状态</h2>

            <div class="grid gap-3 md:grid-cols-4" v-if="result">
                <div class="stat rounded-box bg-base-200">
                    <div class="stat-title">Clip1 起点</div>
                    <div class="stat-value text-lg">{{ result.clip1StartSec.toFixed(3) }}s</div>
                </div>
                <div class="stat rounded-box bg-base-200">
                    <div class="stat-title">Clip2 起点</div>
                    <div class="stat-value text-lg">{{ result.clip2StartSec.toFixed(3) }}s</div>
                </div>
                <div class="stat rounded-box bg-base-200">
                    <div class="stat-title">偏移</div>
                    <div class="stat-value text-lg">{{ result.offsetSec.toFixed(3) }}s</div>
                </div>
                <div class="stat rounded-box bg-base-200">
                    <div class="stat-title">导出时长</div>
                    <div class="stat-value text-lg">{{ result.outputDurationSec.toFixed(3) }}s</div>
                </div>
            </div>

            <progress class="progress progress-primary w-full" :value="task.progress" max="1" />
            <div class="text-sm opacity-80">{{ task.message }}</div>

            <div v-if="task.error" class="alert alert-error">
                <span>{{ task.error }}</span>
            </div>
        </div>
    </section>
</template>
