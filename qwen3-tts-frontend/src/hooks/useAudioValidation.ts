import { MAX_FILE_SIZE, MIN_AUDIO_DURATION } from '@/lib/constants'

interface ValidationResult {
  valid: boolean
  error?: string
  duration?: number
}

export function useAudioValidation() {
  const validateAudioFile = async (file: File): Promise<ValidationResult> => {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: '文件大小不能超过 10MB' }
    }

    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3']
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: '只支持 WAV 和 MP3 格式' }
    }

    try {
      const duration = await getAudioDuration(file)
      if (duration < MIN_AUDIO_DURATION) {
        return { valid: false, error: `音频时长必须大于 ${MIN_AUDIO_DURATION} 秒` }
      }
      return { valid: true, duration }
    } catch {
      return { valid: false, error: '无法读取音频文件元数据' }
    }
  }

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      audio.onloadedmetadata = () => {
        resolve(audio.duration)
        URL.revokeObjectURL(audio.src)
      }
      audio.onerror = () => reject(new Error('无法读取音频'))
      audio.src = URL.createObjectURL(file)
    })
  }

  return { validateAudioFile }
}
