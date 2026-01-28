import React, { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import type { VoiceLibrary, VoiceLibraryCreate, VoiceLibraryUpdate } from '@/lib/api/voices'
import { useVoiceLibrary } from '@/contexts/VoiceLibraryContext'

interface VoiceFormProps {
  voice?: VoiceLibrary
  onSubmit: (data: VoiceLibraryCreate | VoiceLibraryUpdate) => Promise<void>
}

const SPEAKERS = [
  'Xiaoli', 'Xiaochun', 'Xiaohan', 'Xiaoqiu', 'Xiaoxuan',
  'Xiaomo', 'Xiaoyan', 'Xiaoyun', 'Xiaorui', 'Xiaoxiao',
  'Zhiyu', 'Zhichen'
]

const VoiceForm: React.FC<VoiceFormProps> = ({ voice, onSubmit }) => {
  const { availableTags, loadTags } = useVoiceLibrary()
  const [formData, setFormData] = useState({
    name: voice?.name || '',
    description: voice?.description || '',
    voice_type: voice?.voice_type || 'custom_voice' as 'custom_voice' | 'voice_design' | 'voice_clone',
    voice_data: voice?.voice_data || { speaker: 'Xiaoli' },
    tags: voice?.tags || [] as string[]
  })
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    loadTags()
  }, [loadTags])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  const handleVoiceTypeChange = (value: string) => {
    const voiceType = value as 'custom_voice' | 'voice_design' | 'voice_clone'
    let voice_data = {}

    switch (voiceType) {
      case 'custom_voice':
        voice_data = { speaker: 'Xiaoli' }
        break
      case 'voice_design':
        voice_data = { instruct: '' }
        break
      case 'voice_clone':
        voice_data = { voice_cache_id: 0, ref_text: '' }
        break
    }

    setFormData(prev => ({ ...prev, voice_type: voiceType, voice_data }))
  }

  const handleVoiceDataChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      voice_data: { ...prev.voice_data, [key]: value }
    }))
  }

  const addTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }))
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }

  return (
    <form id="voice-form" onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">音色名称 *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="输入音色名称"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="voice_type">音色类型 *</Label>
        <Select value={formData.voice_type} onValueChange={handleVoiceTypeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom_voice">预设音色</SelectItem>
            <SelectItem value="voice_design">音色设计</SelectItem>
            <SelectItem value="voice_clone">音色克隆</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.voice_type === 'custom_voice' && (
        <div className="space-y-2">
          <Label htmlFor="speaker">选择说话人 *</Label>
          <Select
            value={formData.voice_data.speaker}
            onValueChange={value => handleVoiceDataChange('speaker', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEAKERS.map(speaker => (
                <SelectItem key={speaker} value={speaker}>
                  {speaker}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {formData.voice_type === 'voice_design' && (
        <div className="space-y-2">
          <Label htmlFor="instruct">音色指令 *</Label>
          <Textarea
            id="instruct"
            value={formData.voice_data.instruct || ''}
            onChange={e => handleVoiceDataChange('instruct', e.target.value)}
            placeholder="描述音色特征，例如：声音特征沉稳、客观、略带叙事感..."
            rows={4}
            required
          />
        </div>
      )}

      {formData.voice_type === 'voice_clone' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="voice_cache_id">音色缓存 ID *</Label>
            <Input
              id="voice_cache_id"
              type="number"
              value={formData.voice_data.voice_cache_id || ''}
              onChange={e => handleVoiceDataChange('voice_cache_id', parseInt(e.target.value))}
              placeholder="输入音色缓存 ID"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ref_text">参考文本 *</Label>
            <Textarea
              id="ref_text"
              value={formData.voice_data.ref_text || ''}
              onChange={e => handleVoiceDataChange('ref_text', e.target.value)}
              placeholder="输入参考音频对应的文本"
              rows={3}
              required
            />
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="description">描述</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="输入音色描述"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>标签</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeTag(tag)}
              />
            </Badge>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag(tagInput)
              }
            }}
            placeholder="输入标签后按回车"
          />
        </div>

        {availableTags && (
          <div className="flex flex-wrap gap-2 mt-2">
            {[...availableTags.predefined, ...availableTags.user_custom].map(tag => (
              <Badge
                key={tag}
                variant="outline"
                className="cursor-pointer hover:bg-secondary"
                onClick={() => addTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </form>
  )
}

export default VoiceForm
