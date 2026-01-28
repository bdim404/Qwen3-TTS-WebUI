import apiClient from '../api'

export interface Character {
  id: number
  user_id: number
  name: string
  description?: string
  voice_source_type: 'library' | 'preset'
  voice_library_id?: number
  preset_speaker?: string
  default_instruct?: string
  avatar_type: 'icon' | 'upload' | 'initial'
  avatar_data?: string
  color: string
  tags?: string[]
  default_tts_params?: Record<string, any>
  created_at: string
  last_used_at?: string
  voice_library_name?: string
  voice_library_data?: Record<string, any>
}

export interface CreateCharacterRequest {
  name: string
  description?: string
  voice_source_type: 'library' | 'preset'
  voice_library_id?: number
  preset_speaker?: string
  default_instruct?: string
  avatar_type: 'icon' | 'upload' | 'initial'
  avatar_data?: string
  color: string
  tags?: string[]
  default_tts_params?: Record<string, any>
}

export interface UpdateCharacterRequest {
  name?: string
  description?: string
  voice_source_type?: 'library' | 'preset'
  voice_library_id?: number
  preset_speaker?: string
  default_instruct?: string
  avatar_type?: 'icon' | 'upload' | 'initial'
  avatar_data?: string
  color?: string
  tags?: string[]
  default_tts_params?: Record<string, any>
}

export interface CharacterListResponse {
  items: Character[]
  total: number
}

export interface GetCharactersParams {
  skip?: number
  limit?: number
  tags?: string
}

export const getCharacters = async (params?: GetCharactersParams): Promise<CharacterListResponse> => {
  const response = await apiClient.get('/characters', { params })
  return response.data
}

export const getCharacterById = async (id: number): Promise<Character> => {
  const response = await apiClient.get(`/characters/${id}`)
  return response.data
}

export const createCharacter = async (data: CreateCharacterRequest): Promise<Character> => {
  const response = await apiClient.post('/characters', data)
  return response.data
}

export const updateCharacter = async (id: number, data: UpdateCharacterRequest): Promise<Character> => {
  const response = await apiClient.patch(`/characters/${id}`, data)
  return response.data
}

export const deleteCharacter = async (id: number): Promise<void> => {
  await apiClient.delete(`/characters/${id}`)
}
