import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
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

const apiKeySchema = z.object({
  api_key: z.string().min(1, '请输入 API 密钥'),
})

type ApiKeyFormValues = z.infer<typeof apiKeySchema>

export default function Settings() {
  const { user } = useAuth()
  const { preferences, hasAliyunKey, updatePreferences, refetchPreferences } = useUserPreferences()
  const [showApiKey, setShowApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      api_key: '',
    },
  })

  const handleBackendChange = async (value: string) => {
    try {
      await updatePreferences({ default_backend: value as 'local' | 'aliyun' })
      toast.success(`已切换到${value === 'local' ? '本地' : '阿里云'}模式`)
    } catch (error) {
      toast.error('保存失败，请重试')
    }
  }

  const handleUpdateKey = async (data: ApiKeyFormValues) => {
    try {
      setIsLoading(true)
      await authApi.setAliyunKey(data.api_key)
      await refetchPreferences()
      form.reset()
      toast.success('API 密钥已更新并验证成功')
    } catch (error: any) {
      toast.error(error.message || 'API 密钥验证失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyKey = async () => {
    try {
      setIsLoading(true)
      const result = await authApi.verifyAliyunKey()
      if (result.valid) {
        toast.success('API 密钥验证成功')
      } else {
        toast.error(result.message || 'API 密钥无效')
      }
      await refetchPreferences()
    } catch (error: any) {
      toast.error(error.message || '验证失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteKey = async () => {
    if (!confirm('确定要删除阿里云 API 密钥吗？删除后将自动切换到本地模式。')) {
      return
    }

    try {
      setIsLoading(true)
      await authApi.deleteAliyunKey()
      await refetchPreferences()
      toast.success('API 密钥已删除，已切换到本地模式')
    } catch (error: any) {
      toast.error(error.message || '删除失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async (data: PasswordChangeRequest) => {
    try {
      setIsPasswordLoading(true)
      await authApi.changePassword(data)
      toast.success('密码修改成功')
      setShowPasswordDialog(false)
    } catch (error: any) {
      toast.error(error.message || '密码修改失败')
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

      <main className="flex-1 overflow-y-auto container mx-auto p-6 max-w-[800px]">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">设置</h1>
            <p className="text-muted-foreground mt-2">管理您的账户设置和偏好</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>后端偏好</CardTitle>
              <CardDescription>选择默认的 TTS 后端模式</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={preferences.default_backend}
                onValueChange={handleBackendChange}
              >
                <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-accent/50 cursor-pointer">
                  <RadioGroupItem value="local" id="backend-local" />
                  <Label htmlFor="backend-local" className="flex-1 cursor-pointer">
                    <div className="font-medium">本地模型</div>
                    <div className="text-sm text-muted-foreground">免费使用本地 Qwen3-TTS 模型</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-accent/50 cursor-pointer">
                  <RadioGroupItem value="aliyun" id="backend-aliyun" />
                  <Label htmlFor="backend-aliyun" className="flex-1 cursor-pointer">
                    <div className="font-medium">阿里云 API</div>
                    <div className="text-sm text-muted-foreground">使用阿里云 TTS 服务</div>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>阿里云 API 密钥</CardTitle>
              <CardDescription>管理您的阿里云 API 密钥配置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">当前状态:</span>
                {hasAliyunKey ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Check className="h-4 w-4" />
                    已配置并有效
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <X className="h-4 w-4" />
                    未配置
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
                        <FormLabel>API 密钥</FormLabel>
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

                  <div className="flex gap-2">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? '更新中...' : hasAliyunKey ? '更新密钥' : '添加密钥'}
                    </Button>
                    {hasAliyunKey && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleVerifyKey}
                          disabled={isLoading}
                        >
                          验证密钥
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleDeleteKey}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除密钥
                        </Button>
                      </>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>账户信息</CardTitle>
              <CardDescription>您的账户基本信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>用户名</Label>
                <Input value={user.username} disabled />
              </div>
              <div className="grid gap-2">
                <Label>邮箱</Label>
                <Input value={user.email} disabled />
              </div>
              <div>
                <Button onClick={() => setShowPasswordDialog(true)}>修改密码</Button>
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
