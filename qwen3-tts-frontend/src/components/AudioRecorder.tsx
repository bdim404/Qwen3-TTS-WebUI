import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, Trash2, RotateCcw, FileAudio } from 'lucide-react'
import { toast } from 'sonner'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useAudioValidation } from '@/hooks/useAudioValidation'

interface AudioRecorderProps {
  onChange: (file: File | null) => void
}

export function AudioRecorder({ onChange }: AudioRecorderProps) {
  const {
    isRecording,
    recordingDuration,
    audioBlob,
    error: recorderError,
    isSupported,
    startRecording,
    stopRecording,
    clearRecording,
  } = useAudioRecorder()

  const { validateAudioFile } = useAudioValidation()
  const [audioInfo, setAudioInfo] = useState<{ duration: number; size: number } | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (recorderError) {
      toast.error(recorderError)
    }
  }, [recorderError])

  useEffect(() => {
    if (audioBlob) {
      handleValidateRecording(audioBlob)
    }
  }, [audioBlob])

  const handleValidateRecording = async (blob: Blob) => {
    const file = new File([blob], 'recording.wav', { type: 'audio/wav' })

    const result = await validateAudioFile(file)

    console.log('录音验证结果:', {
      valid: result.valid,
      duration: result.duration,
      recordingDuration: recordingDuration,
      error: result.error
    })

    if (result.valid && result.duration) {
      onChange(file)
      setAudioInfo({ duration: result.duration, size: file.size })
      setValidationError(null)
    } else {
      setValidationError(result.error || '录音验证失败')
      clearRecording()
      onChange(null)
    }
  }

  const handleMouseDown = () => {
    if (!isRecording && !audioBlob) {
      startRecording()
    }
  }

  const handleMouseUp = () => {
    if (isRecording) {
      stopRecording()
    }
  }

  const handleReset = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    clearRecording()
    setAudioInfo(null)
    setValidationError(null)
    onChange(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' && !isRecording && !audioBlob) {
      e.preventDefault()
      startRecording()
    }
  }

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === ' ' && isRecording) {
      e.preventDefault()
      stopRecording()
    }
  }

  if (!isSupported) {
    return (
      <div className="p-4 border rounded bg-muted text-muted-foreground text-sm">
        您的浏览器不支持录音功能
      </div>
    )
  }

  if (audioBlob && audioInfo) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-3 border rounded">
          <FileAudio className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">录制完成</p>
            <p className="text-xs text-muted-foreground">
              {(audioInfo.size / 1024 / 1024).toFixed(2)} MB · {audioInfo.duration.toFixed(1)} 秒
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleReset}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={isRecording ? 'default' : 'outline'}
        className={`w-full h-24 select-none ${isRecording ? 'animate-pulse' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      >
        <div className="flex flex-col items-center gap-2">
          <Mic className="h-8 w-8" />
          {isRecording ? (
            <>
              <span className="text-lg font-semibold">{recordingDuration.toFixed(1)}s</span>
              <span className="text-xs">松开完成</span>
            </>
          ) : (
            <span>按住录音</span>
          )}
        </div>
      </Button>

      {validationError && (
        <div className="flex items-center justify-between p-2 border border-destructive rounded bg-destructive/10">
          <p className="text-sm text-destructive">{validationError}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
