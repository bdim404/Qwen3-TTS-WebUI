import { Menu, LogOut, Users, Settings, AudioLines } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'

interface NavbarProps {
  onToggleSidebar?: () => void
}

export function Navbar({ onToggleSidebar }: NavbarProps) {
  const { logout, user } = useAuth()

  return (
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
        <Link to="/" className="flex items-center gap-2">
          <AudioLines className="h-6 w-6 md:hidden" />
          <h1 className="hidden md:block text-xl font-bold cursor-pointer hover:opacity-80 transition-opacity">
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
        <Link to="/settings">
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </Link>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </nav>
  )
}
