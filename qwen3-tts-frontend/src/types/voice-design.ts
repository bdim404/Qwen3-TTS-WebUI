export interface VoiceDesign {
  id: number
  user_id: number
  name: string
  backend_type: 'local' | 'aliyun'
  instruct: string
  aliyun_voice_id?: string
  meta_data?: Record<string, any>
  preview_text?: string
  created_at: string
  last_used: string
  use_count: number
}

export interface VoiceDesignCreate {
  name: string
  instruct: string
  backend_type: 'local' | 'aliyun'
  aliyun_voice_id?: string
  meta_data?: Record<string, any>
  preview_text?: string
}

export interface VoiceDesignListResponse {
  designs: VoiceDesign[]
  total: number
}
