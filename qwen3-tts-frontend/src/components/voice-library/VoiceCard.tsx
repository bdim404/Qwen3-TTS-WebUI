import React, { useState, useRef } from 'react'
import { Play, Pause, Edit, Trash2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { VoiceLibrary } from '@/lib/api/voices'
import { getPreviewAudioUrl } from '@/lib/api/voices'

interface VoiceCardProps {
  voice: VoiceLibrary
  onEdit: (voice: VoiceLibrary) => void
  onDelete: (voice: VoiceLibrary) => void
  onRegeneratePreview: (voice: VoiceLibrary) => void
}

const VoiceCard: React.FC<VoiceCardProps> = ({ voice, onEdit, onDelete, onRegeneratePreview }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handlePlayPause = async () => {
    if (!audioRef.current) {
      const token = localStorage.getItem('token')
      const audioUrl = `${getPreviewAudioUrl(voice.id)}${token ? `?token=${token}` : ''}`
      audioRef.current = new Audio(audioUrl)
      audioRef.current.onended = () => setIsPlaying(false)
    }

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      await audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const getVoiceTypeLabel = (type: string) => {
    switch (type) {
      case 'custom_voice':
        return '预设音色'
      case 'voice_design':
        return '音色设计'
      case 'voice_clone':
        return '音色克隆'
      default:
        return type
    }
  }

  const getVoiceDataDisplay = () => {
    switch (voice.voice_type) {
      case 'custom_voice':
        return voice.voice_data.speaker || ''
      case 'voice_design':
        return voice.voice_data.instruct?.slice(0, 50) + '...' || ''
      case 'voice_clone':
        return `克隆音色 (ID: ${voice.voice_data.voice_cache_id})`
      default:
        return ''
    }
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{voice.name}</CardTitle>
            <CardDescription className="mt-1">
              <Badge variant="outline" className="mr-2">
                {getVoiceTypeLabel(voice.voice_type)}
              </Badge>
              <span className="text-xs text-muted-foreground">{getVoiceDataDisplay()}</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {voice.description && (
          <p className="text-sm text-muted-foreground mb-3">{voice.description}</p>
        )}

        {voice.tags && voice.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {voice.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-3 text-xs text-muted-foreground">
          <div>使用次数: {voice.usage_count}</div>
          <div>创建时间: {new Date(voice.created_at).toLocaleDateString()}</div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between gap-2">
        {voice.preview_audio_path && (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayPause}
            disabled={!voice.preview_audio_path}
          >
            {isPlaying ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            预览
          </Button>
        )}

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRegeneratePreview(voice)}
            title="重新生成预览"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" onClick={() => onEdit(voice)}>
            <Edit className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" onClick={() => onDelete(voice)} className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

export default VoiceCard
