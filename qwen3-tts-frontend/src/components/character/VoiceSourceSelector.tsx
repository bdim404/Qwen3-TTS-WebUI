import React, { useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useVoiceLibrary } from '@/contexts/VoiceLibraryContext'
import { useApp } from '@/contexts/AppContext'

interface VoiceSourceSelectorProps {
  voiceSourceType: 'library' | 'preset'
  voiceLibraryId?: number
  presetSpeaker?: string
  onVoiceSourceTypeChange: (type: 'library' | 'preset') => void
  onVoiceLibraryIdChange: (id: number | undefined) => void
  onPresetSpeakerChange: (speaker: string | undefined) => void
}

export const VoiceSourceSelector: React.FC<VoiceSourceSelectorProps> = ({
  voiceSourceType,
  voiceLibraryId,
  presetSpeaker,
  onVoiceSourceTypeChange,
  onVoiceLibraryIdChange,
  onPresetSpeakerChange
}) => {
  const { voices, loadVoices } = useVoiceLibrary()
  const { speakers } = useApp()

  useEffect(() => {
    loadVoices(1)
  }, [loadVoices])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>音色来源</Label>
        <RadioGroup value={voiceSourceType} onValueChange={(value) => onVoiceSourceTypeChange(value as any)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="library" id="library" />
            <Label htmlFor="library" className="font-normal cursor-pointer">
              从音色库选择
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="preset" id="preset" />
            <Label htmlFor="preset" className="font-normal cursor-pointer">
              使用预设音色
            </Label>
          </div>
        </RadioGroup>
      </div>

      {voiceSourceType === 'library' && (
        <div className="space-y-2">
          <Label>选择音色库</Label>
          <Select
            value={voiceLibraryId?.toString() || ''}
            onValueChange={(value) => onVoiceLibraryIdChange(value ? parseInt(value) : undefined)}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择音色库" />
            </SelectTrigger>
            <SelectContent>
              {voices.map((voice) => (
                <SelectItem key={voice.id} value={voice.id.toString()}>
                  {voice.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {voiceSourceType === 'preset' && (
        <div className="space-y-2">
          <Label>选择预设音色</Label>
          <Select
            value={presetSpeaker || ''}
            onValueChange={onPresetSpeakerChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择预设音色" />
            </SelectTrigger>
            <SelectContent>
              {speakers.map((speaker) => (
                <SelectItem key={speaker.name} value={speaker.name}>
                  {speaker.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
