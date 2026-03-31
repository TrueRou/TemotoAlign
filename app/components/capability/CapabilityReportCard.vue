<script setup lang="ts">
import type { ExportCapabilityReport } from '../../../shared/types/alignment'

defineProps<{
    report: ExportCapabilityReport | null
    pending?: boolean
}>()
</script>

<template>
    <section class="card bg-base-100 shadow-sm">
        <div class="card-body gap-4">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="card-title">环境能力检查</h2>
                    <p class="text-sm opacity-70">不满足本地导出条件时将直接拒绝服务。</p>
                </div>
                <span v-if="pending" class="loading loading-spinner loading-md" />
            </div>

            <div v-if="report" class="space-y-3">
                <div class="badge" :class="report.status === 'deny' ? 'badge-error' : report.status === 'limited' ? 'badge-warning' : 'badge-success'">
                    {{ report.status === 'deny' ? '不可导出' : report.status === 'limited' ? '受限导出' : '可导出' }}
                </div>

                <ul class="grid gap-2 text-sm">
                    <li>平台：{{ report.platform }}</li>
                    <li>Worker：{{ report.supportsWorker ? '可用' : '不可用' }}</li>
                    <li>OfflineAudio：{{ report.supportsOfflineAudio ? '可用' : '不可用' }}</li>
                    <li>视频编码：{{ report.supportsVideoEncoding ? '可用' : '不可用' }}</li>
                    <li>文件输出：{{ report.supportsFilesystemSave ? '可用' : '不可用' }}</li>
                    <li>最大宽度：{{ report.maxWidth }}</li>
                    <li>最大帧率：{{ report.maxFps }}</li>
                </ul>

                <div>
                    <h3 class="font-medium">编码器</h3>
                    <div class="mt-2 flex flex-wrap gap-2">
                        <span
                            v-for="codec in report.codecs"
                            :key="codec.codec"
                            class="badge"
                            :class="codec.supported ? 'badge-success' : 'badge-ghost'"
                        >
                            {{ codec.codec.toUpperCase() }} · {{ codec.supported ? '支持' : '不可用' }}
                        </span>
                    </div>
                </div>

                <div v-if="report.issues.length > 0" class="alert" :class="report.status === 'deny' ? 'alert-error' : 'alert-warning'">
                    <div>
                        <div class="font-medium">检查结果</div>
                        <ul class="mt-1 list-disc pl-5 text-sm">
                            <li v-for="issue in report.issues" :key="issue.code">
                                {{ issue.message }}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div v-else class="text-sm opacity-70">
                尚未执行能力检查。
            </div>
        </div>
    </section>
</template>
