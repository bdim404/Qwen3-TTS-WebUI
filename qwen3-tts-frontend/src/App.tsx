import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AppProvider } from '@/contexts/AppContext'
import { JobProvider } from '@/contexts/JobContext'
import { HistoryProvider } from '@/contexts/HistoryContext'
import { VoiceLibraryProvider } from '@/contexts/VoiceLibraryContext'
import { CharacterProvider } from '@/contexts/CharacterContext'
import ErrorBoundary from '@/components/ErrorBoundary'
import LoadingScreen from '@/components/LoadingScreen'
import { SuperAdminRoute } from '@/components/SuperAdminRoute'

const Login = lazy(() => import('@/pages/Login'))
const Home = lazy(() => import('@/pages/Home'))
const UserManagement = lazy(() => import('@/pages/UserManagement'))
const VoiceLibrary = lazy(() => import('@/pages/VoiceLibrary'))
const Characters = lazy(() => import('@/pages/Characters'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <Toaster position="top-right" />
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppProvider>
                        <HistoryProvider>
                          <JobProvider>
                            <Home />
                          </JobProvider>
                        </HistoryProvider>
                      </AppProvider>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <SuperAdminRoute>
                      <UserManagement />
                    </SuperAdminRoute>
                  }
                />
                <Route
                  path="/voice-library"
                  element={
                    <ProtectedRoute>
                      <VoiceLibraryProvider>
                        <VoiceLibrary />
                      </VoiceLibraryProvider>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/characters"
                  element={
                    <ProtectedRoute>
                      <AppProvider>
                        <VoiceLibraryProvider>
                          <CharacterProvider>
                            <Characters />
                          </CharacterProvider>
                        </VoiceLibraryProvider>
                      </AppProvider>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  )
}

export default App
