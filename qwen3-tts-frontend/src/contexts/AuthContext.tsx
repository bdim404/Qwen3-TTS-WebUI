import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { authApi } from '@/lib/api'
import type { User, LoginRequest, AuthState } from '@/types/auth'

interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('auth')
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token')
        if (storedToken) {
          setToken(storedToken)
          const currentUser = await authApi.getCurrentUser()
          setUser(currentUser)
        }
      } catch (error) {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [])

  const login = async (credentials: LoginRequest) => {
    try {
      const response = await authApi.login(credentials)
      const newToken = response.access_token

      localStorage.setItem('token', newToken)
      setToken(newToken)

      const currentUser = await authApi.getCurrentUser()
      setUser(currentUser)

      toast.success(t('loginSuccess'))
      navigate('/')
    } catch (error: any) {
      const message = error.response?.data?.detail || t('loginFailedCheckCredentials')
      toast.error(message)
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    toast.success(t('logoutSuccess'))
    navigate('/login')
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
