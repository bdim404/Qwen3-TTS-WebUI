import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import { ttsApi } from '@/lib/api'
import type { Language, Speaker } from '@/types/tts'

interface AppContextType {
  currentTab: string
  setCurrentTab: (tab: string) => void
  languages: Language[]
  speakers: Speaker[]
  isLoadingConfig: boolean
}

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const CACHE_DURATION = 5 * 60 * 1000

const cache: {
  languages: CacheEntry<Language[]> | null
  speakers: CacheEntry<Speaker[]> | null
} = {
  languages: null,
  speakers: null,
}

const isCacheValid = <T,>(entry: CacheEntry<T> | null): boolean => {
  if (!entry) return false
  return Date.now() - entry.timestamp < CACHE_DURATION
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentTab, setCurrentTabState] = useState('custom-voice')
  const [languages, setLanguages] = useState<Language[]>([])
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [isLoadingConfig, setIsLoadingConfig] = useState(true)

  const setCurrentTab = useCallback((tab: string) => {
    setCurrentTabState(tab)
  }, [])

  useEffect(() => {
    const loadConfig = async () => {
      try {
        let languagesData: Language[]
        let speakersData: Speaker[]

        if (isCacheValid(cache.languages)) {
          languagesData = cache.languages!.data
        } else {
          languagesData = await ttsApi.getLanguages()
          cache.languages = { data: languagesData, timestamp: Date.now() }
        }

        if (isCacheValid(cache.speakers)) {
          speakersData = cache.speakers!.data
        } else {
          speakersData = await ttsApi.getSpeakers()
          cache.speakers = { data: speakersData, timestamp: Date.now() }
        }

        setLanguages(languagesData)
        setSpeakers(speakersData)
      } catch (error) {
        console.error('Failed to load config:', error)
      } finally {
        setIsLoadingConfig(false)
      }
    }

    loadConfig()
  }, [])

  const value = useMemo(
    () => ({
      currentTab,
      setCurrentTab,
      languages,
      speakers,
      isLoadingConfig,
    }),
    [currentTab, setCurrentTab, languages, speakers, isLoadingConfig]
  )

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
