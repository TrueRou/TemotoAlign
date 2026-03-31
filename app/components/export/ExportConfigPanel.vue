<script setup lang="ts">
import type { AlignConfig } from '../../../shared/types/alignment'
import { computed } from 'vue'

const props = defineProps<{
    modelValue: AlignConfig
    disabled?: boolean
}>()

const emit = defineEmits<{
    'update:modelValue': [value: AlignConfig]
}>()

const config = computed({
    get: () => props.modelValue,
    set: (value: AlignConfig) => emit('update:modelValue', value),
})
</script>

<template>
    <section class="card bg-base-100 shadow-sm">
        <div class="card-body gap-5">
            <div>
                <h2 class="card-title">
                    音频参数
                </h2>
                <p class="text-sm opacity-70">
                    当前版本强制保留 `Clip1` 原始视频轨，仅调整混音结果与预览时长。
                </p>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
                <label class="form-control gap-2">
                    <span class="label-text">A 轨增益 (dB)</span>
                    <input v-model.number="config.audio1GainDb" class="range" type="range" min="-18" max="6" step="0.5" :disabled="disabled">
                    <span class="text-xs opacity-70">{{ config.audio1GainDb.toFixed(1) }} dB</span>
                </label>

                <label class="form-control gap-2">
                    <span class="label-text">B 轨增益 (dB)</span>
                    <input v-model.number="config.audio2GainDb" class="range" type="range" min="-18" max="6" step="0.5" :disabled="disabled">
                    <span class="text-xs opacity-70">{{ config.audio2GainDb.toFixed(1) }} dB</span>
                </label>

                <label class="form-control gap-2">
                    <span class="label-text">预览时长 (秒)</span>
                    <input v-model.number="config.previewDurationSec" class="range" type="range" min="2" max="30" step="1" :disabled="disabled">
                    <span class="text-xs opacity-70">{{ config.previewDurationSec.toFixed(0) }} s</span>
                </label>
            </div>
        </div>
    </section>
</template>
