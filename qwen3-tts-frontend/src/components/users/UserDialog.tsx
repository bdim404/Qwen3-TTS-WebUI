import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { User } from '@/types/auth'

const createUserFormSchema = (t: (key: string) => string) => z.object({
  username: z.string().min(3, t('user:validation.usernameMinLength')).max(20, t('user:validation.usernameMaxLength')),
  email: z.string().email(t('user:validation.emailInvalid')),
  password: z.string().optional(),
  is_active: z.boolean(),
  is_superuser: z.boolean(),
  can_use_local_model: z.boolean(),
})

interface UserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: User | null
  onSubmit: (data: any) => Promise<void>
  isLoading: boolean
}

export function UserDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
  isLoading,
}: UserDialogProps) {
  const { t } = useTranslation(['user', 'common'])
  const isEditing = !!user

  const userFormSchema = createUserFormSchema(t)
  type UserFormValues = z.infer<typeof userFormSchema>

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      is_active: true,
      is_superuser: false,
      can_use_local_model: false,
    },
  })

  useEffect(() => {
    if (user) {
      form.reset({
        username: user.username,
        email: user.email,
        password: '',
        is_active: user.is_active,
        is_superuser: user.is_superuser,
        can_use_local_model: user.can_use_local_model,
      })
    } else {
      form.reset({
        username: '',
        email: '',
        password: '',
        is_active: true,
        is_superuser: false,
        can_use_local_model: false,
      })
    }
  }, [user, form])

  const handleSubmit = async (data: UserFormValues) => {
    await onSubmit(data)
    form.reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('user:editUserDialog') : t('user:createUserDialog')}</DialogTitle>
          <DialogDescription>
            {isEditing ? t('user:editUserDescription') : t('user:createUserDescription')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('user:username')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('user:email')}</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isEditing ? t('user:passwordOptional') : t('user:password')}
                  </FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{t('user:isActive')}</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_superuser"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{t('user:isSuperuser')}</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="can_use_local_model"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{t('user:canUseLocalModel')}</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      {t('user:canUseLocalModelDescription')}
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                {t('common:cancel')}
              </Button>
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? t('user:saving') : t('common:save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
