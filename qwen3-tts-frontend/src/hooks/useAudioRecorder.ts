import { useState, useRef, useCallback } from 'react'

const HIGH_QUALITY_AUDIO_CONSTRAINTS = {
  audio: {
    sampleRate: { ideal: 48000 },
    channelCount: { ideal: 2 },
    echoCancellation: { ideal: false },
    noiseSuppression: { ideal: false },
    autoGainControl: { ideal: false }
  }
}

interface UseAudioRecorderReturn {
  isRecording: boolean
  recordingDuration: number
  audioBlob: Blob | null
  error: string | null
  isSupported: boolean
  startRecording: () => Promise<void>
  stopRecording: () => void
  clearRecording: () => void
}

async function convertToWav(audioBlob: Blob): Promise<Blob> {
  const arrayBuffer = await audioBlob.arrayBuffer()
  const audioContext = new AudioContext()
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

  const numberOfChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const length = audioBuffer.length * numberOfChannels * 2 + 44

  const buffer = new ArrayBuffer(length)
  const view = new DataView(buffer)

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, length - 8, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numberOfChannels * 2, true)
  view.setUint16(32, numberOfChannels * 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, length - 44, true)

  let offset = 44
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = audioBuffer.getChannelData(channel)[i]
      const int16 = Math.max(-1, Math.min(1, sample)) * 0x7fff
      view.setInt16(offset, int16, true)
      offset += 2
    }
  }

  await audioContext.close()
  return new Blob([buffer], { type: 'audio/wav' })
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const isSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('您的浏览器不支持录音功能')
      return
    }

    setError(null)
    audioChunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia(HIGH_QUALITY_AUDIO_CONSTRAINTS)
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/mp4'

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const rawBlob = new Blob(audioChunksRef.current, { type: mimeType })

        try {
          const wavBlob = await convertToWav(rawBlob)
          setAudioBlob(wavBlob)
        } catch (err) {
          setError('音频转换失败')
          setAudioBlob(null)
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }

        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingDuration(0)

      timerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 0.1)
      }, 100)
    } catch (err) {
      if (err instanceof Error && err.name === 'OverconstrainedError') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          streamRef.current = stream
          console.warn('高质量音频约束不支持，使用浏览器默认配置')

          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/mp4'

          const mediaRecorder = new MediaRecorder(stream, {
            mimeType,
            audioBitsPerSecond: 128000
          })
          mediaRecorderRef.current = mediaRecorder

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data)
            }
          }

          mediaRecorder.onstop = async () => {
            const rawBlob = new Blob(audioChunksRef.current, { type: mimeType })

            try {
              const wavBlob = await convertToWav(rawBlob)
              setAudioBlob(wavBlob)
            } catch (err) {
              setError('音频转换失败')
              setAudioBlob(null)
            }

            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop())
              streamRef.current = null
            }

            if (timerRef.current) {
              clearInterval(timerRef.current)
              timerRef.current = null
            }
          }

          mediaRecorder.start()
          setIsRecording(true)
          setRecordingDuration(0)

          timerRef.current = window.setInterval(() => {
            setRecordingDuration(prev => prev + 0.1)
          }, 100)
        } catch (fallbackErr) {
          if (fallbackErr instanceof Error) {
            if (fallbackErr.name === 'NotAllowedError') {
              setError('请允许访问麦克风权限')
            } else if (fallbackErr.name === 'NotFoundError') {
              setError('未检测到麦克风设备')
            } else {
              setError('启动录音失败')
            }
          }
        }
      } else if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('请允许访问麦克风权限')
        } else if (err.name === 'NotFoundError') {
          setError('未检测到麦克风设备')
        } else {
          setError('启动录音失败')
        }
      }
    }
  }, [isSupported])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const clearRecording = useCallback(() => {
    setAudioBlob(null)
    setRecordingDuration(0)
    setError(null)
  }, [])

  return {
    isRecording,
    recordingDuration,
    audioBlob,
    error,
    isSupported,
    startRecording,
    stopRecording,
    clearRecording,
  }
}
