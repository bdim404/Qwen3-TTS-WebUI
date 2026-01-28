import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export interface VoiceData {
  speaker?: string
  instruct?: string
  voice_cache_id?: number
  ref_text?: string
}

export interface VoiceLibrary {
  id: number
  user_id: number
  name: string
  description?: string
  voice_type: 'custom_voice' | 'voice_design' | 'voice_clone'
  voice_data: VoiceData
  tags?: string[]
  preview_audio_path?: string
  created_at: string
  last_used_at?: string
  usage_count: number
}

export interface VoiceLibraryWithReferences extends VoiceLibrary {
  reference_count: number
  referenced_characters?: string[]
}

export interface VoiceLibraryList {
  items: VoiceLibrary[]
  total: number
}

export interface VoiceLibraryCreate {
  name: string
  description?: string
  voice_type: 'custom_voice' | 'voice_design' | 'voice_clone'
  voice_data: VoiceData
  tags?: string[]
}

export interface VoiceLibraryUpdate {
  name?: string
  description?: string
  voice_type?: 'custom_voice' | 'voice_design' | 'voice_clone'
  voice_data?: VoiceData
  tags?: string[]
}

export interface VoiceTags {
  predefined: string[]
  user_custom: string[]
}

export const getVoices = async (params?: {
  skip?: number
  limit?: number
  tags?: string
}): Promise<VoiceLibraryList> => {
  const response = await apiClient.get('/voice-library', { params })
  return response.data
}

export const getVoiceById = async (id: number): Promise<VoiceLibrary> => {
  const response = await apiClient.get(`/voice-library/${id}`)
  return response.data
}

export const createVoice = async (data: VoiceLibraryCreate): Promise<VoiceLibrary> => {
  const response = await apiClient.post('/voice-library', data)
  return response.data
}

export const updateVoice = async (id: number, data: VoiceLibraryUpdate): Promise<VoiceLibrary> => {
  const response = await apiClient.patch(`/voice-library/${id}`, data)
  return response.data
}

export const deleteVoice = async (id: number): Promise<void> => {
  await apiClient.delete(`/voice-library/${id}`)
}

export const getVoiceReferences = async (id: number): Promise<VoiceLibraryWithReferences> => {
  const response = await apiClient.get(`/voice-library/${id}/references`)
  return response.data
}

export const regeneratePreview = async (id: number, language: string = 'zh'): Promise<VoiceLibrary> => {
  const response = await apiClient.post(`/voice-library/${id}/regenerate-preview`, null, {
    params: { language }
  })
  return response.data
}

export const getPreviewAudioUrl = (id: number): string => {
  return `${import.meta.env.VITE_API_URL}/voice-library/${id}/preview/audio`
}

export const getVoiceTags = async (): Promise<VoiceTags> => {
  const response = await apiClient.get('/voice-library/tags')
  return response.data
}
