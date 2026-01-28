import React, { createContext, useContext, useState, useCallback } from 'react'
import * as voiceApi from '@/lib/api/voices'

interface VoiceLibraryState {
  voices: voiceApi.VoiceLibrary[]
  total: number
  currentPage: number
  pageSize: number
  isLoading: boolean
  error: string | null
  availableTags: voiceApi.VoiceTags
}

interface VoiceLibraryContextValue extends VoiceLibraryState {
  loadVoices: (page?: number, tags?: string) => Promise<void>
  createVoice: (data: voiceApi.VoiceLibraryCreate) => Promise<voiceApi.VoiceLibrary>
  updateVoice: (id: number, data: voiceApi.VoiceLibraryUpdate) => Promise<voiceApi.VoiceLibrary>
  deleteVoice: (id: number) => Promise<void>
  previewVoice: (id: number, language?: string) => Promise<voiceApi.VoiceLibrary>
  loadTags: () => Promise<void>
  getVoiceReferences: (id: number) => Promise<voiceApi.VoiceLibraryWithReferences>
}

const VoiceLibraryContext = createContext<VoiceLibraryContextValue | undefined>(undefined)

export const VoiceLibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<VoiceLibraryState>({
    voices: [],
    total: 0,
    currentPage: 1,
    pageSize: 20,
    isLoading: false,
    error: null,
    availableTags: { predefined: [], user_custom: [] }
  })

  const loadVoices = useCallback(async (page: number = 1, tags?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const skip = (page - 1) * state.pageSize
      const result = await voiceApi.getVoices({
        skip,
        limit: state.pageSize,
        tags
      })
      setState(prev => ({
        ...prev,
        voices: result.items,
        total: result.total,
        currentPage: page,
        isLoading: false
      }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.detail || '加载音色库失败'
      }))
    }
  }, [state.pageSize])

  const createVoice = useCallback(async (data: voiceApi.VoiceLibraryCreate) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const newVoice = await voiceApi.createVoice(data)
      await loadVoices(state.currentPage)
      return newVoice
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.detail || '创建音色库失败'
      }))
      throw error
    }
  }, [loadVoices, state.currentPage])

  const updateVoice = useCallback(async (id: number, data: voiceApi.VoiceLibraryUpdate) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const updatedVoice = await voiceApi.updateVoice(id, data)
      await loadVoices(state.currentPage)
      return updatedVoice
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.detail || '更新音色库失败'
      }))
      throw error
    }
  }, [loadVoices, state.currentPage])

  const deleteVoice = useCallback(async (id: number) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      await voiceApi.deleteVoice(id)
      await loadVoices(state.currentPage)
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.detail || '删除音色库失败'
      }))
      throw error
    }
  }, [loadVoices, state.currentPage])

  const previewVoice = useCallback(async (id: number, language: string = 'zh') => {
    try {
      return await voiceApi.regeneratePreview(id, language)
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || '生成预览失败')
    }
  }, [])

  const loadTags = useCallback(async () => {
    try {
      const tags = await voiceApi.getVoiceTags()
      setState(prev => ({ ...prev, availableTags: tags }))
    } catch (error: any) {
      console.error('Failed to load tags:', error)
    }
  }, [])

  const getVoiceReferences = useCallback(async (id: number) => {
    try {
      return await voiceApi.getVoiceReferences(id)
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || '获取引用信息失败')
    }
  }, [])

  return (
    <VoiceLibraryContext.Provider
      value={{
        ...state,
        loadVoices,
        createVoice,
        updateVoice,
        deleteVoice,
        previewVoice,
        loadTags,
        getVoiceReferences
      }}
    >
      {children}
    </VoiceLibraryContext.Provider>
  )
}

export const useVoiceLibrary = () => {
  const context = useContext(VoiceLibraryContext)
  if (context === undefined) {
    throw new Error('useVoiceLibrary must be used within a VoiceLibraryProvider')
  }
  return context
}
