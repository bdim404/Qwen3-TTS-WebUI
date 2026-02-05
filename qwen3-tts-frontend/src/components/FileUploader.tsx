import { useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Upload, X, FileAudio } from 'lucide-react'
import { toast } from 'sonner'
import { useAudioValidation } from '@/hooks/useAudioValidation'

interface AudioInfo {
  duration: number
  size: number
}

interface FileUploaderProps {
  value: File | null
  onChange: (file: File | null) => void
  error?: string
}

export function FileUploader({ value, onChange, error }: FileUploaderProps) {
  const { t } = useTranslation('voice')
  const inputRef = useRef<HTMLInputElement>(null)
  const { validateAudioFile } = useAudioValidation()
  const [isValidating, setIsValidating] = useState(false)
  const [audioInfo, setAudioInfo] = useState<AudioInfo | null>(null)

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsValidating(true)
    const result = await validateAudioFile(file)
    setIsValidating(false)

    if (result.valid && result.duration) {
      onChange(file)
      setAudioInfo({ duration: result.duration, size: file.size })
    } else {
      toast.error(result.error || t('validationFailed'))
      e.target.value = ''
    }
  }

  const handleRemove = () => {
    onChange(null)
    setAudioInfo(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {!value ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={isValidating}
        >
          <Upload className="mr-2 h-4 w-4" />
          {isValidating ? t('validating') : t('selectAudioFile')}
        </Button>
      ) : (
        <div className="flex items-center gap-2 p-3 border rounded">
          <FileAudio className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{value.name}</p>
            {audioInfo && (
              <p className="text-xs text-muted-foreground">
                {(audioInfo.size / 1024 / 1024).toFixed(2)} MB · {audioInfo.duration.toFixed(1)} {t('seconds')}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={handleRemove}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="audio/wav,audio/mp3,audio/mpeg"
        className="hidden"
        onChange={handleFileSelect}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
