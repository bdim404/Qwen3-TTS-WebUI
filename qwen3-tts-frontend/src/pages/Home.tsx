import { useState, useRef, lazy, Suspense } from 'react'
import { Navbar } from '@/components/Navbar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User, Palette, Copy } from 'lucide-react'
import type { CustomVoiceFormHandle } from '@/components/tts/CustomVoiceForm'
import type { VoiceDesignFormHandle } from '@/components/tts/VoiceDesignForm'
import { HistorySidebar } from '@/components/HistorySidebar'
import FormSkeleton from '@/components/FormSkeleton'
import type { JobType } from '@/types/job'
import { jobApi } from '@/lib/api'
import { toast } from 'sonner'
import { useJobPolling } from '@/hooks/useJobPolling'

const CustomVoiceForm = lazy(() => import('@/components/tts/CustomVoiceForm'))
const VoiceDesignForm = lazy(() => import('@/components/tts/VoiceDesignForm'))
const VoiceCloneForm = lazy(() => import('@/components/tts/VoiceCloneForm'))

function Home() {
  const [currentTab, setCurrentTab] = useState('custom-voice')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { loadCompletedJob } = useJobPolling()

  const customVoiceFormRef = useRef<CustomVoiceFormHandle>(null)
  const voiceDesignFormRef = useRef<VoiceDesignFormHandle>(null)

  const handleLoadParams = async (jobId: number, jobType: JobType) => {
    try {
      const job = await jobApi.getJob(jobId)

      setSidebarOpen(false)

      if (jobType === 'custom_voice') {
        setCurrentTab('custom-voice')
        setTimeout(() => {
          customVoiceFormRef.current?.loadParams(job.parameters)
        }, 100)
      } else if (jobType === 'voice_design') {
        setCurrentTab('voice-design')
        setTimeout(() => {
          voiceDesignFormRef.current?.loadParams(job.parameters)
        }, 100)
      }

      loadCompletedJob(job)
      toast.success('参数已加载到表单')
    } catch (error) {
      toast.error('加载参数失败')
    }
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex overflow-hidden">
        <HistorySidebar
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          onLoadParams={handleLoadParams}
        />

        <main className="flex-1 overflow-y-auto container mx-auto p-3 md:p-6 max-w-[800px] md:max-w-[700px]">
          <Card>
            <CardHeader>
              <Tabs value={currentTab} onValueChange={setCurrentTab}>
                <TabsList className="grid w-full grid-cols-3 h-9">
                  <TabsTrigger value="custom-voice" variant="default">
                    <User className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">自定义</span>
                  </TabsTrigger>
                  <TabsTrigger value="voice-design" variant="secondary">
                    <Palette className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">设计</span>
                  </TabsTrigger>
                  <TabsTrigger value="voice-clone" variant="outline">
                    <Copy className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">克隆</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent className="pt-0 px-3 md:px-6">
              <Tabs value={currentTab}>
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
              </Tabs>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}

export default Home
