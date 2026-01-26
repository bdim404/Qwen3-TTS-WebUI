import { useRef, useState, useEffect, useCallback, memo } from 'react'
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

const AudioPlayer = memo(({ audioUrl, jobId }: AudioPlayerProps) => {
  const [blobUrl, setBlobUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const previousAudioUrlRef = useRef<string>('')
  const playerRef = useRef<any>(null)

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
          setLoadError('Failed to load audio')
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
  }, [audioUrl])

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [])

  const handleDownload = useCallback(() => {
    const link = document.createElement('a')
    link.href = blobUrl || audioUrl
    link.download = `tts-${jobId}-${Date.now()}.wav`
    link.click()
  }, [blobUrl, audioUrl, jobId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 border rounded-lg">
        <span className="text-sm text-muted-foreground">Loading...</span>
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
      />
    </div>
  )
})

AudioPlayer.displayName = 'AudioPlayer'

export { AudioPlayer }
