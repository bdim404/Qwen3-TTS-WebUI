import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
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

const createApiKeySchema = (t: (key: string) => string) => z.object({
  api_key: z.string().min(1, t('auth:validation.apiKeyRequired')),
})

interface OnboardingDialogProps {
  open: boolean
  onComplete: () => void
}

export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const { t } = useTranslation(['onboarding', 'auth', 'common'])
  const [step, setStep] = useState(1)
  const [selectedBackend, setSelectedBackend] = useState<'local' | 'aliyun'>('aliyun')
  const [isLoading, setIsLoading] = useState(false)
  const { updatePreferences, refetchPreferences, isBackendAvailable } = useUserPreferences()

  const apiKeySchema = createApiKeySchema(t)
  type ApiKeyFormValues = z.infer<typeof apiKeySchema>

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
      toast.success(t('onboarding:skipSuccess'))
      onComplete()
    } catch (error) {
      toast.error(t('onboarding:operationFailed'))
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
      toast.success(backend === 'local' ? t('onboarding:configComplete') : t('onboarding:configCompleteAliyun'))
      onComplete()
    } catch (error) {
      toast.error(t('onboarding:saveFailed'))
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
      toast.error(error.message || t('onboarding:verifyFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? t('onboarding:welcome') : t('onboarding:configureApiKey')}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? t('onboarding:selectBackendDescription')
              : t('onboarding:enterApiKeyDescription')}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <>
            <div className="space-y-4 py-4">
              <RadioGroup value={selectedBackend} onValueChange={(v) => setSelectedBackend(v as 'local' | 'aliyun')}>
                <div className={`flex items-center space-x-3 border rounded-lg p-4 ${isBackendAvailable('local') ? 'hover:bg-accent/50 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                  <RadioGroupItem value="local" id="local" disabled={!isBackendAvailable('local')} />
                  <Label htmlFor="local" className={`flex-1 ${isBackendAvailable('local') ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                    <div className="font-medium">{t('onboarding:localModel')}</div>
                    <div className="text-sm text-muted-foreground">
                      {isBackendAvailable('local') ? t('onboarding:localModelDescription') : t('onboarding:localModelNoPermission')}
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-accent/50 cursor-pointer">
                  <RadioGroupItem value="aliyun" id="aliyun" />
                  <Label htmlFor="aliyun" className="flex-1 cursor-pointer">
                    <div className="font-medium">{t('onboarding:aliyunApi')}<span className="ml-2 text-xs text-primary">{t('onboarding:aliyunApiRecommended')}</span></div>
                    <div className="text-sm text-muted-foreground">{t('onboarding:aliyunApiDescription')}</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <DialogFooter>
              {isBackendAvailable('local') && (
                <Button type="button" variant="outline" onClick={handleSkip}>
                  {t('onboarding:skipConfig')}
                </Button>
              )}
              <Button type="button" onClick={handleNextStep}>
                {t('onboarding:nextStep')}
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
                    <FormLabel>{t('onboarding:apiKey')}</FormLabel>
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
                        {t('onboarding:howToGetApiKey')}
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
                  {t('onboarding:back')}
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? t('onboarding:verifying') : t('onboarding:verifyAndComplete')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
