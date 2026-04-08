import type { CapabilityIssue, CodecSupport, ExportCapabilityReport } from '../../shared/types/alignment'
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'

function parseMajorVersion(value: string): number {
    const match = value.match(/(\d{2,})/)
    return match ? Number(match[1]) : 0
}

async function canWriteWithFilesystem(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
        return 'showSaveFilePicker' in window || 'download' in document.createElement('a')
    }

    try {
        await Filesystem.stat({
            directory: Directory.Cache,
            path: '',
        })
        return true
    }
    catch {
        return false
    }
}

export function useCapabilityGate() {
    const evaluate = async (): Promise<ExportCapabilityReport> => {
        const issues: CapabilityIssue[] = []
        const platform = Capacitor.getPlatform()
        const workerSupported = typeof Worker !== 'undefined'
        const offlineAudioSupported = typeof OfflineAudioContext !== 'undefined'
        const filesystemSupported = await canWriteWithFilesystem()
        const userAgent = navigator.userAgent
        const chromeMajor = /Chrome\/(\d+)/.exec(userAgent)?.[1]
        const safariMajor = /Version\/(\d+)/.exec(userAgent)?.[1]
        const mp4InputSupported = typeof File !== 'undefined' && typeof Blob !== 'undefined'

        if (!workerSupported) {
            issues.push({ code: 'worker-unavailable', message: '当前环境不支持后台 Worker，无法安全导出。', fatal: true })
        }
        if (!offlineAudioSupported) {
            issues.push({ code: 'offline-audio-unavailable', message: '当前环境不支持离线音频渲染。', fatal: true })
        }
        if (!filesystemSupported) {
            issues.push({ code: 'file-save-unavailable', message: '当前环境无法写出导出文件。', fatal: true })
        }
        if (!mp4InputSupported) {
            issues.push({ code: 'mp4-input-unavailable', message: '当前环境缺少基础文件处理能力，无法执行视频直通封装。', fatal: true })
        }

        if (platform === 'web') {
            if (chromeMajor && Number(chromeMajor) < 121) {
                issues.push({ code: 'chrome-too-old', message: 'Chrome 版本过旧，低于已验证基线。', fatal: true })
            }
            if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent) && parseMajorVersion(safariMajor || '0') < 18) {
                issues.push({ code: 'safari-too-old', message: 'Safari 版本过旧，低于已验证基线。', fatal: true })
            }
        }

        if (platform === 'ios') {
            if (parseMajorVersion(userAgent) < 18) {
                issues.push({ code: 'ios-too-old', message: 'iOS 版本过旧，当前版本不提供导出服务。', fatal: true })
            }
        }

        if (platform === 'android' && chromeMajor && Number(chromeMajor) < 121) {
            issues.push({ code: 'android-webview-too-old', message: 'Android System WebView 版本过旧。', fatal: true })
        }

        const videoEncodingSupported = typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined'

        const codecs: CodecSupport[] = [
            { codec: 'video-remux', supported: mp4InputSupported, reason: mp4InputSupported ? undefined : '当前环境无法处理 MP4 输入。' },
            { codec: 'audio-aac', supported: true },
        ]
        const fatalIssues = issues.filter(issue => issue.fatal)

        return {
            status: fatalIssues.length > 0 ? 'deny' : 'allow',
            platform,
            issues,
            codecs,
            maxWidth: 0,
            maxFps: 0,
            supportsFilesystemSave: filesystemSupported,
            supportsWorker: workerSupported,
            supportsOfflineAudio: offlineAudioSupported,
            supportsVideoEncoding: videoEncodingSupported,
        }
    }

    return {
        evaluate,
    }
}
