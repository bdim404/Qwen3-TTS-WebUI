import { useRef, useState, useEffect, useCallback, memo } from 'react'
import { useTranslation } from 'react-i18next'
import AudioPlayerLib from 'react-h5-audio-player'
import 'react-h5-audio-player/lib/styles.css'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import apiClient from '@/lib/api'
import styles from './AudioPlayer.module.css'

interface AudioPlayerProps {
  audioUrl: string
  jobId: number
}

const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

const AudioPlayer = memo(({ audioUrl, jobId }: AudioPlayerProps) => {
  const { t } = useTranslation('common')
  const [blobUrl, setBlobUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [useMobileMode, setUseMobileMode] = useState(false)
  const previousAudioUrlRef = useRef<string>('')

  useEffect(() => {
    setUseMobileMode(isMobileDevice())
  }, [])

  useEffect(() => {
    if (!audioUrl || audioUrl === previousAudioUrlRef.current) return

    if (useMobileMode) {
      const token = localStorage.getItem('token')
      const separator = audioUrl.includes('?') ? '&' : '?'
      const urlWithToken = token ? `${audioUrl}${separator}token=${token}` : audioUrl
      setBlobUrl(urlWithToken)
      previousAudioUrlRef.current = audioUrl
      setIsLoading(false)
      return
    }

    let active = true
    const prevBlobUrl = blobUrl

    const fetchAudio = async () => {
      setIsLoading(true)
      setLoadError(null)

      if (prevBlobUrl) {
        URL.revokeObjectURL(prevBlobUrl)
      }

      try {
        const response = await apiClient.get(audioUrl, { responseType: 'blob' })
        if (active) {
          const url = URL.createObjectURL(response.data)
          setBlobUrl(url)
          previousAudioUrlRef.current = audioUrl
        }
      } catch (error) {
        console.error("Failed to load audio:", error)
        if (active) {
          setLoadError(t('failedToLoadAudio'))
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    fetchAudio()

    return () => {
      active = false
    }
  }, [audioUrl, useMobileMode])

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [])

  const handleDownload = useCallback(() => {
    if (useMobileMode) {
      window.open(blobUrl || audioUrl, '_blank')
    } else {
      const link = document.createElement('a')
      link.href = blobUrl || audioUrl
      link.download = `tts-${jobId}-${Date.now()}.wav`
      link.click()
    }
  }, [blobUrl, audioUrl, jobId, useMobileMode])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 border rounded-lg">
        <span className="text-sm text-muted-foreground">{t('loadingAudio')}</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center p-4 border rounded-lg">
        <span className="text-sm text-destructive">{loadError}</span>
      </div>
    )
  }

  if (!blobUrl) {
    return null
  }

  return (
    <div className={styles.audioPlayerWrapper}>
      <AudioPlayerLib
        src={blobUrl}
        layout="horizontal"
        customAdditionalControls={[
          <Button
            key="download"
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className={styles.downloadButton}
          >
            <Download className="h-4 w-4" />
          </Button>
        ]}
        customVolumeControls={[]}
        showJumpControls={false}
        volume={1}
        preload="metadata"
        autoPlayAfterSrcChange={false}
      />
    </div>
  )
})

AudioPlayer.displayName = 'AudioPlayer'

export { AudioPlayer }
