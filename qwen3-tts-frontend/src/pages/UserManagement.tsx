import { useState, useEffect } from 'react'
import { toast } from 'sonner'
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
      toast.error(error.message || '加载用户列表失败')
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
        toast.success('用户更新成功')
      } else {
        await userApi.createUser(data as UserCreateRequest)
        toast.success('用户创建成功')
      }
      setUserDialogOpen(false)
      await loadUsers()
    } catch (error: any) {
      toast.error(error.message || '操作失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedUser) return

    try {
      setIsSubmitting(true)
      await userApi.deleteUser(selectedUser.id)
      toast.success('用户删除成功')
      setDeleteDialogOpen(false)
      await loadUsers()
    } catch (error: any) {
      toast.error(error.message || '删除失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>用户管理</CardTitle>
            <Button onClick={handleCreateUser}>
              <Plus className="h-4 w-4 mr-2" />
              创建用户
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
