import { Menu, LogOut, Users, KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { authApi } from '@/lib/api'
import { ChangePasswordDialog } from '@/components/users/ChangePasswordDialog'
import type { PasswordChangeRequest } from '@/types/auth'

interface NavbarProps {
  onToggleSidebar?: () => void
}

export function Navbar({ onToggleSidebar }: NavbarProps) {
  const { logout, user } = useAuth()
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const handlePasswordChange = async (data: PasswordChangeRequest) => {
    try {
      setIsChangingPassword(true)
      await authApi.changePassword(data)
      toast.success('密码修改成功')
      setPasswordDialogOpen(false)
    } catch (error: any) {
      toast.error(error.message || '密码修改失败')
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <>
      <nav className="h-16 border-b bg-background flex items-center px-4 gap-4">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        <div className="flex-1">
          <Link to="/">
            <h1 className="text-sm md:text-xl font-bold cursor-pointer hover:opacity-80 transition-opacity">
              Qwen3-TTS-WebUI
            </h1>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {user?.is_superuser && (
            <Link to="/users">
              <Button variant="ghost" size="icon">
                <Users className="h-5 w-5" />
              </Button>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPasswordDialogOpen(true)}
          >
            <KeyRound className="h-5 w-5" />
          </Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={logout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </nav>

      <ChangePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        onSubmit={handlePasswordChange}
        isLoading={isChangingPassword}
      />
    </>
  )
}
