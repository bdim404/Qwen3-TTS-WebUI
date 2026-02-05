import { useState, useRef, lazy, Suspense, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Navbar } from '@/components/Navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User, Palette, Copy } from 'lucide-react'
import type { CustomVoiceFormHandle } from '@/components/tts/CustomVoiceForm'
import type { VoiceDesignFormHandle } from '@/components/tts/VoiceDesignForm'
import { HistorySidebar } from '@/components/HistorySidebar'
import { OnboardingDialog } from '@/components/OnboardingDialog'
import FormSkeleton from '@/components/FormSkeleton'
import { useUserPreferences } from '@/contexts/UserPreferencesContext'

const CustomVoiceForm = lazy(() => import('@/components/tts/CustomVoiceForm'))
const VoiceDesignForm = lazy(() => import('@/components/tts/VoiceDesignForm'))
const VoiceCloneForm = lazy(() => import('@/components/tts/VoiceCloneForm'))

function Home() {
  const { t } = useTranslation('nav')
  const [currentTab, setCurrentTab] = useState('custom-voice')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const { preferences } = useUserPreferences()

  const customVoiceFormRef = useRef<CustomVoiceFormHandle>(null)
  const voiceDesignFormRef = useRef<VoiceDesignFormHandle>(null)

  useEffect(() => {
    if (preferences && !preferences.onboarding_completed) {
      setShowOnboarding(true)
    }
  }, [preferences])


  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">
      <OnboardingDialog
        open={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
      />

      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex overflow-hidden">
        <HistorySidebar
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
        />

        <main className="flex-1 overflow-y-auto flex items-start md:items-center justify-center">
          <div className="w-full container mx-auto p-3 md:p-6 max-w-[800px] md:max-w-[700px]">
            <Tabs value={currentTab} onValueChange={setCurrentTab}>
              <TabsList className="grid w-full grid-cols-3 h-9 mb-3">
                <TabsTrigger value="custom-voice" variant="default">
                  <User className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">{t('customVoiceTab')}</span>
                </TabsTrigger>
                <TabsTrigger value="voice-design" variant="secondary">
                  <Palette className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">{t('voiceDesignTab')}</span>
                </TabsTrigger>
                <TabsTrigger value="voice-clone" variant="outline">
                  <Copy className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">{t('voiceCloneTab')}</span>
                </TabsTrigger>
              </TabsList>

              <Card>
                <CardContent className="pt-6 px-3 md:px-6 pb-6">
                  <TabsContent value="custom-voice" className="mt-0">
                    <Suspense fallback={<FormSkeleton />}>
                      <CustomVoiceForm ref={customVoiceFormRef} />
                    </Suspense>
                  </TabsContent>

                  <TabsContent value="voice-design" className="mt-0">
                    <Suspense fallback={<FormSkeleton />}>
                      <VoiceDesignForm ref={voiceDesignFormRef} />
                    </Suspense>
                  </TabsContent>

                  <TabsContent value="voice-clone" className="mt-0">
                    <Suspense fallback={<FormSkeleton />}>
                      <VoiceCloneForm />
                    </Suspense>
                  </TabsContent>
                </CardContent>
              </Card>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Home
