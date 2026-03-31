export function useMediaProbe() {
    const probeFile = async (file: File): Promise<MediaProbeResult> => {
        const mimeType = file.type || 'application/octet-stream'
        const objectUrl = URL.createObjectURL(file)

        try {
            if (mimeType.startsWith('video/')) {
                const video = document.createElement('video')
                video.preload = 'metadata'
                video.src = objectUrl

                await new Promise<void>((resolve, reject) => {
                    video.onloadedmetadata = () => resolve()
                    video.onerror = () => reject(new Error(`无法读取视频元数据: ${file.name}`))
                })

                return {
                    durationSec: Number(video.duration || 0),
                    hasAudio: true,
                    hasVideo: true,
                    width: video.videoWidth,
                    height: video.videoHeight,
                    mimeType,
                    fileName: file.name,
                    fileSize: file.size,
                    mediaKind: 'video',
                }
            }

            if (mimeType.startsWith('audio/')) {
                const audio = document.createElement('audio')
                audio.preload = 'metadata'
                audio.src = objectUrl

                await new Promise<void>((resolve, reject) => {
                    audio.onloadedmetadata = () => resolve()
                    audio.onerror = () => reject(new Error(`无法读取音频元数据: ${file.name}`))
                })

                return {
                    durationSec: Number(audio.duration || 0),
                    hasAudio: true,
                    hasVideo: false,
                    mimeType,
                    fileName: file.name,
                    fileSize: file.size,
                    mediaKind: 'audio',
                }
            }

            throw new Error(`不支持的文件类型: ${mimeType}`)
        }
        finally {
            URL.revokeObjectURL(objectUrl)
        }
    }

    return {
        probeFile,
    }
}
