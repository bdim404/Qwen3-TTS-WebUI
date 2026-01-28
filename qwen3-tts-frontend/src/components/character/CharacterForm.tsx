import React, { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { AvatarPicker } from './AvatarPicker'
import { ColorPicker } from './ColorPicker'
import { VoiceSourceSelector } from './VoiceSourceSelector'
import type { Character, CreateCharacterRequest, UpdateCharacterRequest } from '@/lib/api/characters'

interface CharacterFormProps {
  character?: Character
  onSubmit: (data: CreateCharacterRequest | UpdateCharacterRequest) => Promise<void>
  onCancel: () => void
}

export const CharacterForm: React.FC<CharacterFormProps> = ({ character, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: character?.name || '',
    description: character?.description || '',
    voiceSourceType: character?.voice_source_type || 'preset' as 'library' | 'preset',
    voiceLibraryId: character?.voice_library_id,
    presetSpeaker: character?.preset_speaker || 'Xiaoli',
    defaultInstruct: character?.default_instruct || '',
    avatarType: character?.avatar_type || 'initial' as 'icon' | 'upload' | 'initial',
    avatarData: character?.avatar_data || '',
    color: character?.color || '#3B82F6'
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const submitData: CreateCharacterRequest = {
        name: formData.name,
        description: formData.description || undefined,
        voice_source_type: formData.voiceSourceType,
        voice_library_id: formData.voiceSourceType === 'library' ? formData.voiceLibraryId : undefined,
        preset_speaker: formData.voiceSourceType === 'preset' ? formData.presetSpeaker : undefined,
        default_instruct: formData.defaultInstruct || undefined,
        avatar_type: formData.avatarType,
        avatar_data: formData.avatarData || undefined,
        color: formData.color
      }

      await onSubmit(submitData)
    } catch (error) {
      console.error('提交失败:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">角色名称 *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="输入角色名称"
          required
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">角色描述</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="输入角色描述（可选）"
          rows={3}
        />
      </div>

      <VoiceSourceSelector
        voiceSourceType={formData.voiceSourceType}
        voiceLibraryId={formData.voiceLibraryId}
        presetSpeaker={formData.presetSpeaker}
        onVoiceSourceTypeChange={(type) => setFormData({ ...formData, voiceSourceType: type })}
        onVoiceLibraryIdChange={(id) => setFormData({ ...formData, voiceLibraryId: id })}
        onPresetSpeakerChange={(speaker) => setFormData({ ...formData, presetSpeaker: speaker || undefined })}
      />

      <div className="space-y-2">
        <Label htmlFor="defaultInstruct">默认控制指令</Label>
        <Textarea
          id="defaultInstruct"
          value={formData.defaultInstruct}
          onChange={(e) => setFormData({ ...formData, defaultInstruct: e.target.value })}
          placeholder="输入默认的 TTS 控制指令（可选）"
          rows={3}
        />
      </div>

      <AvatarPicker
        avatarType={formData.avatarType}
        avatarData={formData.avatarData}
        onAvatarTypeChange={(type) => setFormData({ ...formData, avatarType: type })}
        onAvatarDataChange={(data) => setFormData({ ...formData, avatarData: data })}
      />

      <ColorPicker
        color={formData.color}
        onColorChange={(color) => setFormData({ ...formData, color })}
      />

      <div className="flex gap-2 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={isSubmitting || !formData.name}>
          {isSubmitting ? '保存中...' : character ? '更新角色' : '创建角色'}
        </Button>
      </div>
    </form>
  )
}
