import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { authApi } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import type { UserPreferences } from '@/types/auth'
import i18n from '@/locales'

interface UserPreferencesContextType {
  preferences: UserPreferences | null
  isLoading: boolean
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>
  hasAliyunKey: boolean
  refetchPreferences: () => Promise<void>
  isBackendAvailable: (backend: string) => boolean
  changeLanguage: (lang: 'zh-CN' | 'zh-TW' | 'en-US' | 'ja-JP' | 'ko-KR') => Promise<void>
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined)

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [hasAliyunKey, setHasAliyunKey] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const fetchPreferences = async () => {
    if (!isAuthenticated || !user) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const [prefs, keyVerification] = await Promise.all([
        authApi.getPreferences(),
        authApi.verifyAliyunKey().catch(() => ({ valid: false, message: '' })),
      ])

      setPreferences(prefs)
      setHasAliyunKey(keyVerification.valid)

      if (prefs.language) {
        i18n.changeLanguage(prefs.language)
      }

      const cacheKey = `user_preferences_${user.id}`
      localStorage.setItem(cacheKey, JSON.stringify(prefs))
    } catch (error) {
      const cacheKey = `user_preferences_${user.id}`
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        setPreferences(JSON.parse(cached))
      } else {
        setPreferences({ default_backend: 'aliyun', onboarding_completed: false })
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPreferences()
  }, [isAuthenticated, user?.id])

  const updatePreferences = async (partialPrefs: Partial<UserPreferences>) => {
    if (!preferences || !user) return

    const newPrefs = { ...preferences, ...partialPrefs }

    const cacheKey = `user_preferences_${user.id}`
    localStorage.setItem(cacheKey, JSON.stringify(newPrefs))
    setPreferences(newPrefs)

    try {
      await authApi.updatePreferences(newPrefs)
    } catch (error) {
      localStorage.setItem(cacheKey, JSON.stringify(preferences))
      setPreferences(preferences)
      throw error
    }
  }

  const isBackendAvailable = (backend: string) => {
    if (!preferences?.available_backends) {
      return backend === 'aliyun'
    }
    return preferences.available_backends.includes(backend)
  }

  const changeLanguage = async (lang: 'zh-CN' | 'zh-TW' | 'en-US' | 'ja-JP' | 'ko-KR') => {
    await i18n.changeLanguage(lang)
    await updatePreferences({ language: lang })
  }

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        isLoading,
        updatePreferences,
        hasAliyunKey,
        refetchPreferences: fetchPreferences,
        isBackendAvailable,
        changeLanguage,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  )
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext)
  if (!context) {
    throw new Error('useUserPreferences must be used within UserPreferencesProvider')
  }
  return context
}
