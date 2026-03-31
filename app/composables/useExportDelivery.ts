import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            const result = String(reader.result || '')
            reader.onload = null
            reader.onerror = null
            resolve(result.includes(',') ? result.split(',').at(-1) || '' : result)
        }
        reader.onerror = () => {
            const error = reader.error || new Error('无法读取 Blob')
            reader.onload = null
            reader.onerror = null
            reject(error)
        }
        reader.readAsDataURL(blob)
    })
}

export function useExportDelivery() {
    const deliver = async (blob: Blob, fileName: string): Promise<{ objectUrl?: string, savedPath?: string }> => {
        if (!Capacitor.isNativePlatform()) {
            const objectUrl = URL.createObjectURL(blob)
            return { objectUrl }
        }

        let base64 = await blobToBase64(blob)
        const saved = await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Documents,
        })
        base64 = ''

        await Share.share({
            title: 'TemotoAlign 导出完成',
            text: fileName,
            url: saved.uri,
            dialogTitle: '分享导出视频',
        })

        return {
            savedPath: saved.uri,
        }
    }

    return {
        deliver,
    }
}
