import { useRef, useState, useEffect, useCallback, memo } from 'react'
import { useTranslation } from 'react-i18next'
import WaveformPlayer from '@arraypress/waveform-player'
import '@arraypress/waveform-player/dist/waveform-player.css'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import apiClient from '@/lib/api'
import styles from './AudioPlayer.module.css'

interface AudioPlayerProps {
  audioUrl: string
  jobId: number
  text?: string
}

const AudioPlayer = memo(({ audioUrl, jobId, text }: AudioPlayerProps) => {
  const { t } = useTranslation('common')
  const [blobUrl, setBlobUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const previousAudioUrlRef = useRef<string>('')
  const containerRef = useRef<HTMLDivElement>(null)
  const playerInstanceRef = useRef<WaveformPlayer | null>(null)

  useEffect(() => {
    if (!audioUrl || audioUrl === previousAudioUrlRef.current) return

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
  }, [audioUrl, blobUrl, t])

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current || !blobUrl) return

    const truncateText = (str: string, maxLength: number = 30) => {
      if (!str) return ''
      return str.length > maxLength ? str.substring(0, maxLength) + '...' : str
    }

    const player = new WaveformPlayer(containerRef.current, {
      url: blobUrl,
      waveformStyle: 'mirror',
      height: 60,
      barWidth: 3,
      barSpacing: 1,
      samples: 200,
      showTime: true,
      showPlaybackSpeed: false,
      autoplay: false,
      enableMediaSession: true,
      title: text ? truncateText(text) : undefined,
    })

    playerInstanceRef.current = player

    setTimeout(() => {
      if (containerRef.current) {
        const buttons = containerRef.current.querySelectorAll('button')
        buttons.forEach(btn => {
          if (!btn.hasAttribute('type')) {
            btn.setAttribute('type', 'button')
          }
        })
      }
    }, 0)

    return () => {
      if (playerInstanceRef.current) {
        playerInstanceRef.current.destroy()
        playerInstanceRef.current = null
      }
    }
  }, [blobUrl, text])

  const handleDownload = useCallback(() => {
    const link = document.createElement('a')
    link.href = blobUrl || audioUrl
    link.download = `tts-${jobId}-${Date.now()}.wav`
    link.click()
  }, [blobUrl, audioUrl, jobId])

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
      <div ref={containerRef} className={styles.waveformContainer} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleDownload}
        className={styles.downloadButton}
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  )
})

AudioPlayer.displayName = 'AudioPlayer'

export { AudioPlayer }
