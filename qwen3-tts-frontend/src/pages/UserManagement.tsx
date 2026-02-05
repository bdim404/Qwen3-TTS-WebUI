import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UserTable } from '@/components/users/UserTable'
import { UserDialog } from '@/components/users/UserDialog'
import { DeleteUserDialog } from '@/components/users/DeleteUserDialog'
import { userApi } from '@/lib/api'
import type { User } from '@/types/auth'
import type { UserCreateRequest, UserUpdateRequest } from '@/types/user'

export default function UserManagement() {
  const { t } = useTranslation(['user', 'common'])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      const response = await userApi.listUsers()
      setUsers(response.users)
    } catch (error: any) {
      toast.error(error.message || t('user:loadUsersFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleCreateUser = () => {
    setSelectedUser(null)
    setUserDialogOpen(true)
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setUserDialogOpen(true)
  }

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user)
    setDeleteDialogOpen(true)
  }

  const handleUserSubmit = async (data: UserCreateRequest | UserUpdateRequest) => {
    try {
      setIsSubmitting(true)
      if (selectedUser) {
        const updateData: UserUpdateRequest = { ...data }
        if (!updateData.password) {
          delete updateData.password
        }
        await userApi.updateUser(selectedUser.id, updateData)
        toast.success(t('user:userUpdateSuccess'))
      } else {
        await userApi.createUser(data as UserCreateRequest)
        toast.success(t('user:userCreateSuccess'))
      }
      setUserDialogOpen(false)
      await loadUsers()
    } catch (error: any) {
      toast.error(error.message || t('user:operationFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedUser) return

    try {
      setIsSubmitting(true)
      await userApi.deleteUser(selectedUser.id)
      toast.success(t('user:userDeleteSuccess'))
      setDeleteDialogOpen(false)
      await loadUsers()
    } catch (error: any) {
      toast.error(error.message || t('user:deleteFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>{t('user:userManagement')}</CardTitle>
            <Button onClick={handleCreateUser} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              {t('user:createUser')}
            </Button>
          </CardHeader>
          <CardContent>
            <UserTable
              users={users}
              isLoading={isLoading}
              onEdit={handleEditUser}
              onDelete={handleDeleteUser}
            />
          </CardContent>
        </Card>
      </div>

      <UserDialog
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        user={selectedUser}
        onSubmit={handleUserSubmit}
        isLoading={isSubmitting}
      />

      <DeleteUserDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        user={selectedUser}
        onConfirm={handleDeleteConfirm}
        isLoading={isSubmitting}
      />
    </div>
  )
}
