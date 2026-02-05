import { useTranslation } from 'react-i18next'
import { Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { User } from '@/types/auth'

interface UserTableProps {
  users: User[]
  isLoading: boolean
  onEdit: (user: User) => void
  onDelete: (user: User) => void
}

export function UserTable({ users, isLoading, onEdit, onDelete }: UserTableProps) {
  const { t, i18n } = useTranslation(['user', 'common'])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">{t('common:loading')}</div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">{t('user:noUsers')}</div>
      </div>
    )
  }

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="border-b">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">{t('user:username')}</th>
              <th className="px-4 py-3 font-medium">{t('user:email')}</th>
              <th className="px-4 py-3 font-medium">{t('common:status')}</th>
              <th className="px-4 py-3 font-medium">{t('user:role')}</th>
              <th className="px-4 py-3 font-medium">{t('common:actions')}</th>
              <th className="px-4 py-3 font-medium">{t('user:createdAt')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('common:actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b hover:bg-muted/50">
                <td className="px-4 py-3">{user.id}</td>
                <td className="px-4 py-3">{user.username}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge variant={user.is_active ? 'default' : 'secondary'}>
                    {user.is_active ? t('user:active') : t('user:inactive')}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={user.is_superuser ? 'destructive' : 'outline'}>
                    {user.is_superuser ? t('user:superuser') : t('user:normalUser')}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {(user.is_superuser || user.can_use_local_model) && (
                    <Badge variant="secondary">{t('user:localModelPermission')}</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {new Date(user.created_at).toLocaleString(i18n.language)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(user)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(user)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-4">
        {users.map((user) => (
          <div key={user.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">{user.username}</div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(user)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(user)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID:</span>
                <span>{user.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('user:email')}:</span>
                <span className="truncate ml-2">{user.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t('common:status')}:</span>
                <Badge variant={user.is_active ? 'default' : 'secondary'}>
                  {user.is_active ? t('user:active') : t('user:inactive')}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t('user:role')}:</span>
                <Badge variant={user.is_superuser ? 'destructive' : 'outline'}>
                  {user.is_superuser ? t('user:superuser') : t('user:normalUser')}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t('common:actions')}:</span>
                {(user.is_superuser || user.can_use_local_model) ? (
                  <Badge variant="secondary">{t('user:localModelPermission')}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">{t('user:noPermission')}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('user:createdAt')}:</span>
                <span className="text-xs">{new Date(user.created_at).toLocaleString(i18n.language)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
