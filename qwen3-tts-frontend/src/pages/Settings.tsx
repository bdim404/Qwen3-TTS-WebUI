import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Trash2, Check, X } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { ChangePasswordDialog } from '@/components/users/ChangePasswordDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useUserPreferences } from '@/contexts/UserPreferencesContext'
import { authApi } from '@/lib/api'
import type { PasswordChangeRequest } from '@/types/auth'

const createApiKeySchema = (t: (key: string) => string) => z.object({
  api_key: z.string().min(1, t('auth:validation.apiKeyRequired')),
})

export default function Settings() {
  const { t } = useTranslation(['settings', 'auth', 'user', 'common'])
  const { user } = useAuth()
  const { preferences, hasAliyunKey, updatePreferences, refetchPreferences, isBackendAvailable } = useUserPreferences()
  const [showApiKey, setShowApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)

  const apiKeySchema = createApiKeySchema(t)
  type ApiKeyFormValues = z.infer<typeof apiKeySchema>

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      api_key: '',
    },
  })

  const handleBackendChange = async (value: string) => {
    try {
      await updatePreferences({ default_backend: value as 'local' | 'aliyun' })
      toast.success(value === 'local' ? t('settings:switchedToLocal') : t('settings:switchedToAliyun'))
    } catch (error) {
      toast.error(t('settings:saveFailed'))
    }
  }

  const handleUpdateKey = async (data: ApiKeyFormValues) => {
    try {
      setIsLoading(true)
      await authApi.setAliyunKey(data.api_key)
      await refetchPreferences()
      form.reset()
      toast.success(t('settings:apiKeyUpdated'))
    } catch (error: any) {
      toast.error(error.message || t('settings:apiKeyVerifyFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyKey = async () => {
    try {
      setIsLoading(true)
      const result = await authApi.verifyAliyunKey()
      if (result.valid) {
        toast.success(t('settings:apiKeySaved'))
      } else {
        toast.error(result.message || t('settings:apiKeyVerifyFailed'))
      }
      await refetchPreferences()
    } catch (error: any) {
      toast.error(error.message || t('settings:verifyFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteKey = async () => {
    if (!confirm(t('settings:deleteKeyConfirm'))) {
      return
    }

    try {
      setIsLoading(true)
      await authApi.deleteAliyunKey()
      await refetchPreferences()
      toast.success(t('settings:keyDeleted'))
    } catch (error: any) {
      toast.error(error.message || t('settings:deleteFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async (data: PasswordChangeRequest) => {
    try {
      setIsPasswordLoading(true)
      await authApi.changePassword(data)
      toast.success(t('settings:passwordChangeSuccess'))
      setShowPasswordDialog(false)
    } catch (error: any) {
      toast.error(error.message || t('settings:passwordChangeFailed'))
      throw error
    } finally {
      setIsPasswordLoading(false)
    }
  }

  if (!user || !preferences) {
    return null
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 overflow-y-auto container mx-auto p-3 sm:p-6 max-w-[800px]">
        <div className="space-y-3 sm:space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t('settings:title')}</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">{t('settings:description')}</p>
          </div>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">{t('settings:backendPreference')}</CardTitle>
              <CardDescription className="text-sm">{t('settings:backendPreferenceDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <RadioGroup
                value={preferences.default_backend}
                onValueChange={handleBackendChange}
              >
                <div className={`flex items-center space-x-2 sm:space-x-3 border rounded-lg p-3 sm:p-4 ${
                  !isBackendAvailable('local') ? 'opacity-50' : 'hover:bg-accent/50 cursor-pointer'
                }`}>
                  <RadioGroupItem
                    value="local"
                    id="backend-local"
                    disabled={!isBackendAvailable('local')}
                  />
                  <Label htmlFor="backend-local" className="flex-1 cursor-pointer">
                    <div className="font-medium text-sm sm:text-base">{t('settings:localModel')}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      {!isBackendAvailable('local')
                        ? t('settings:localModelNoPermission')
                        : t('settings:localModelDescription')
                      }
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3 border rounded-lg p-3 sm:p-4 hover:bg-accent/50 cursor-pointer">
                  <RadioGroupItem value="aliyun" id="backend-aliyun" />
                  <Label htmlFor="backend-aliyun" className="flex-1 cursor-pointer">
                    <div className="font-medium text-sm sm:text-base">{t('settings:aliyunApi')}</div>
                    <div className="text-xs sm:text-sm text-muted-foreground">{t('settings:aliyunApiDescription')}</div>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">{t('settings:aliyunApiKey')}</CardTitle>
              <CardDescription className="text-sm">{t('settings:apiKeyDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="text-muted-foreground">{t('settings:currentStatus')}</span>
                {hasAliyunKey ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                    {t('settings:configured')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <X className="h-3 w-3 sm:h-4 sm:w-4" />
                    {t('settings:notConfigured')}
                  </span>
                )}
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleUpdateKey)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="api_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm sm:text-base">{t('settings:apiKey')}</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                type={showApiKey ? 'text' : 'password'}
                                placeholder="sk-xxxxxxxxxxxxxxxx"
                                disabled={isLoading}
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full"
                                onClick={() => setShowApiKey(!showApiKey)}
                              >
                                {showApiKey ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={isLoading} className="flex-1 sm:flex-initial">
                      {isLoading ? t('settings:updating') : hasAliyunKey ? t('settings:updateKey') : t('settings:addKey')}
                    </Button>
                    {hasAliyunKey && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleVerifyKey}
                          disabled={isLoading}
                          className="flex-1 sm:flex-initial"
                        >
                          {t('settings:verifyKey')}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleDeleteKey}
                          disabled={isLoading}
                          size="icon"
                          className="sm:w-auto sm:px-4"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden sm:inline sm:ml-2">{t('settings:deleteKey')}</span>
                        </Button>
                      </>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">{t('settings:accountInfo')}</CardTitle>
              <CardDescription className="text-sm">{t('settings:accountInfoDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
              <div className="grid gap-1.5 sm:gap-2">
                <Label className="text-sm sm:text-base">{t('user:username')}</Label>
                <Input value={user.username} disabled />
              </div>
              <div className="grid gap-1.5 sm:gap-2">
                <Label className="text-sm sm:text-base">{t('settings:email')}</Label>
                <Input value={user.email} disabled />
              </div>
              <div>
                <Button onClick={() => setShowPasswordDialog(true)} className="w-full sm:w-auto">{t('settings:changePassword')}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <ChangePasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onSubmit={handleChangePassword}
        isLoading={isPasswordLoading}
      />
    </div>
  )
}
