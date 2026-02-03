import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api'
import { useUserPreferences } from '@/contexts/UserPreferencesContext'

const apiKeySchema = z.object({
  api_key: z.string().min(1, '请输入 API 密钥'),
})

type ApiKeyFormValues = z.infer<typeof apiKeySchema>

interface OnboardingDialogProps {
  open: boolean
  onComplete: () => void
}

export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const [step, setStep] = useState(1)
  const [selectedBackend, setSelectedBackend] = useState<'local' | 'aliyun'>('aliyun')
  const [isLoading, setIsLoading] = useState(false)
  const { updatePreferences, refetchPreferences, isBackendAvailable } = useUserPreferences()

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      api_key: '',
    },
  })

  const handleSkip = async () => {
    try {
      await updatePreferences({
        default_backend: 'local',
        onboarding_completed: true,
      })
      toast.success('已跳过配置，默认使用本地模式')
      onComplete()
    } catch (error) {
      toast.error('操作失败，请重试')
    }
  }

  const handleNextStep = () => {
    if (selectedBackend === 'local') {
      handleComplete('local')
    } else {
      setStep(2)
    }
  }

  const handleComplete = async (backend: 'local' | 'aliyun') => {
    try {
      setIsLoading(true)
      await updatePreferences({
        default_backend: backend,
        onboarding_completed: true,
      })
      toast.success(`配置完成，默认使用${backend === 'local' ? '本地' : '阿里云'}模式`)
      onComplete()
    } catch (error) {
      toast.error('保存配置失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyAndComplete = async (data: ApiKeyFormValues) => {
    try {
      setIsLoading(true)
      await authApi.setAliyunKey(data.api_key)
      await refetchPreferences()
      await handleComplete('aliyun')
    } catch (error: any) {
      toast.error(error.message || 'API 密钥验证失败，请检查后重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? '欢迎使用 Qwen3 TTS' : '配置阿里云 API 密钥'}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? '请选择您的 TTS 后端模式，后续可在设置中修改'
              : '请输入您的阿里云 API 密钥，系统将验证其有效性'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <>
            <div className="space-y-4 py-4">
              <RadioGroup value={selectedBackend} onValueChange={(v) => setSelectedBackend(v as 'local' | 'aliyun')}>
                <div className={`flex items-center space-x-3 border rounded-lg p-4 ${isBackendAvailable('local') ? 'hover:bg-accent/50 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                  <RadioGroupItem value="local" id="local" disabled={!isBackendAvailable('local')} />
                  <Label htmlFor="local" className={`flex-1 ${isBackendAvailable('local') ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                    <div className="font-medium">本地模型</div>
                    <div className="text-sm text-muted-foreground">
                      {isBackendAvailable('local') ? '免费使用本地 Qwen3-TTS 模型' : '无本地模型权限，请联系管理员'}
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-accent/50 cursor-pointer">
                  <RadioGroupItem value="aliyun" id="aliyun" />
                  <Label htmlFor="aliyun" className="flex-1 cursor-pointer">
                    <div className="font-medium">阿里云 API<span className="ml-2 text-xs text-primary">(推荐)</span></div>
                    <div className="text-sm text-muted-foreground">需要配置 API 密钥，按量计费</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <DialogFooter>
              {isBackendAvailable('local') && (
                <Button type="button" variant="outline" onClick={handleSkip}>
                  跳过配置
                </Button>
              )}
              <Button type="button" onClick={handleNextStep}>
                下一步
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleVerifyAndComplete)} className="space-y-4">
              <FormField
                control={form.control}
                name="api_key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API 密钥</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="sk-xxxxxxxxxxxxxxxx"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-sm text-muted-foreground mt-2">
                      <a
                        href="https://help.aliyun.com/zh/model-studio/qwen-tts-realtime?spm=a2ty_o06.30285417.0.0.2994c921szHZj2"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        如何获取 API 密钥？
                      </a>
                    </p>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={isLoading}
                >
                  返回
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? '验证中...' : '验证并完成'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
