export interface Language {
  code: string
  name: string
}

export interface Speaker {
  name: string
  description: string
}

export interface CustomVoiceForm {
  text: string
  language: string
  speaker: string
  instruct?: string
  max_new_tokens?: number
  temperature?: number
  top_k?: number
  top_p?: number
  repetition_penalty?: number
  backend?: string
}

export interface VoiceDesignForm {
  text: string
  language: string
  instruct: string
  saved_design_id?: number
  max_new_tokens?: number
  temperature?: number
  top_k?: number
  top_p?: number
  repetition_penalty?: number
  backend?: string
}

export interface VoiceCloneForm {
  text: string
  language?: string
  ref_audio: File | null
  ref_text?: string
  use_cache?: boolean
  x_vector_only_mode?: boolean
  max_new_tokens?: number
  temperature?: number
  top_k?: number
  top_p?: number
  repetition_penalty?: number
  backend?: string
  voice_design_id?: number
}

export type SpeakerSource = 'builtin' | 'saved-design'

export interface UnifiedSpeakerItem {
  id: string
  displayName: string
  description: string
  source: SpeakerSource
  designId?: number
  instruct?: string
  backendType?: 'local' | 'aliyun'
}
