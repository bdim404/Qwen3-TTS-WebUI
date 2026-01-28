import React, { createContext, useContext, useState, useCallback } from 'react'
import * as characterApi from '@/lib/api/characters'
import type { Character, CreateCharacterRequest, UpdateCharacterRequest } from '@/lib/api/characters'

interface CharacterState {
  characters: Character[]
  total: number
  currentPage: number
  pageSize: number
  isLoading: boolean
  error: string | null
}

interface CharacterContextValue extends CharacterState {
  loadCharacters: (page?: number) => Promise<void>
  createCharacter: (data: CreateCharacterRequest) => Promise<number>
  updateCharacter: (id: number, data: UpdateCharacterRequest) => Promise<void>
  deleteCharacter: (id: number) => Promise<void>
  setPageSize: (size: number) => void
}

const CharacterContext = createContext<CharacterContextValue | undefined>(undefined)

export const CharacterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CharacterState>({
    characters: [],
    total: 0,
    currentPage: 1,
    pageSize: 50,
    isLoading: false,
    error: null
  })

  const loadCharacters = useCallback(async (page?: number) => {
    const targetPage = page ?? state.currentPage
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const skip = (targetPage - 1) * state.pageSize
      const response = await characterApi.getCharacters({
        skip,
        limit: state.pageSize
      })

      setState(prev => ({
        ...prev,
        characters: response.items,
        total: response.total,
        currentPage: targetPage,
        isLoading: false
      }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || '加载角色列表失败',
        isLoading: false
      }))
    }
  }, [state.currentPage, state.pageSize])

  const createCharacter = useCallback(async (data: CreateCharacterRequest): Promise<number> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const newCharacter = await characterApi.createCharacter(data)
      await loadCharacters(1)
      setState(prev => ({ ...prev, isLoading: false }))
      return newCharacter.id
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || '创建角色失败',
        isLoading: false
      }))
      throw error
    }
  }, [loadCharacters])

  const updateCharacter = useCallback(async (id: number, data: UpdateCharacterRequest) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      await characterApi.updateCharacter(id, data)
      await loadCharacters()
      setState(prev => ({ ...prev, isLoading: false }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || '更新角色失败',
        isLoading: false
      }))
      throw error
    }
  }, [loadCharacters])

  const deleteCharacter = useCallback(async (id: number) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      await characterApi.deleteCharacter(id)
      await loadCharacters()
      setState(prev => ({ ...prev, isLoading: false }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || '删除角色失败',
        isLoading: false
      }))
      throw error
    }
  }, [loadCharacters])

  const setPageSize = useCallback((size: number) => {
    setState(prev => ({ ...prev, pageSize: size }))
  }, [])

  const value: CharacterContextValue = {
    ...state,
    loadCharacters,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    setPageSize
  }

  return (
    <CharacterContext.Provider value={value}>
      {children}
    </CharacterContext.Provider>
  )
}

export const useCharacter = () => {
  const context = useContext(CharacterContext)
  if (context === undefined) {
    throw new Error('useCharacter must be used within a CharacterProvider')
  }
  return context
}
