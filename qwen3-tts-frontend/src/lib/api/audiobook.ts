import apiClient from '@/lib/api'

export interface AudiobookProject {
  id: number
  user_id: number
  title: string
  source_type: string
  status: string
  llm_model?: string
  error_message?: string
  created_at: string
  updated_at: string
}

export interface AudiobookCharacter {
  id: number
  project_id: number
  name: string
  description?: string
  instruct?: string
  voice_design_id?: number
}

export interface AudiobookProjectDetail extends AudiobookProject {
  characters: AudiobookCharacter[]
}

export interface AudiobookSegment {
  id: number
  project_id: number
  chapter_index: number
  segment_index: number
  character_id: number
  character_name?: string
  text: string
  audio_path?: string
  status: string
}

export interface LLMConfig {
  base_url?: string
  model?: string
  has_key: boolean
}

export const audiobookApi = {
  createProject: async (data: {
    title: string
    source_type: string
    source_text?: string
  }): Promise<AudiobookProject> => {
    const response = await apiClient.post<AudiobookProject>('/audiobook/projects', data)
    return response.data
  },

  uploadEpub: async (title: string, file: File): Promise<AudiobookProject> => {
    const formData = new FormData()
    formData.append('title', title)
    formData.append('file', file)
    const response = await apiClient.post<AudiobookProject>(
      '/audiobook/projects/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return response.data
  },

  listProjects: async (): Promise<AudiobookProject[]> => {
    const response = await apiClient.get<AudiobookProject[]>('/audiobook/projects')
    return response.data
  },

  getProject: async (id: number): Promise<AudiobookProjectDetail> => {
    const response = await apiClient.get<AudiobookProjectDetail>(`/audiobook/projects/${id}`)
    return response.data
  },

  analyze: async (id: number): Promise<void> => {
    await apiClient.post(`/audiobook/projects/${id}/analyze`)
  },

  updateCharacterVoice: async (projectId: number, charId: number, voiceDesignId: number): Promise<AudiobookCharacter> => {
    const response = await apiClient.put<AudiobookCharacter>(
      `/audiobook/projects/${projectId}/characters/${charId}`,
      { voice_design_id: voiceDesignId }
    )
    return response.data
  },

  generate: async (id: number): Promise<void> => {
    await apiClient.post(`/audiobook/projects/${id}/generate`)
  },

  getSegments: async (id: number, chapter?: number): Promise<AudiobookSegment[]> => {
    const params = chapter !== undefined ? { chapter } : {}
    const response = await apiClient.get<AudiobookSegment[]>(
      `/audiobook/projects/${id}/segments`,
      { params }
    )
    return response.data
  },

  getDownloadUrl: (id: number, chapter?: number): string => {
    const chapterParam = chapter !== undefined ? `?chapter=${chapter}` : ''
    return `/audiobook/projects/${id}/download${chapterParam}`
  },

  getSegmentAudioUrl: (projectId: number, segmentId: number): string => {
    return `/audiobook/projects/${projectId}/segments/${segmentId}/audio`
  },

  deleteProject: async (id: number): Promise<void> => {
    await apiClient.delete(`/audiobook/projects/${id}`)
  },

  getLLMConfig: async (): Promise<LLMConfig> => {
    const response = await apiClient.get<LLMConfig>('/auth/llm-config')
    return response.data
  },

  setLLMConfig: async (config: { base_url: string; api_key: string; model: string }): Promise<void> => {
    await apiClient.put('/auth/llm-config', config)
  },

  deleteLLMConfig: async (): Promise<void> => {
    await apiClient.delete('/auth/llm-config')
  },
}
