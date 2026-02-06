import { Menu, LogOut, Users, Settings, Globe } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { useUserPreferences } from '@/contexts/UserPreferencesContext'

interface NavbarProps {
  onToggleSidebar?: () => void
}

export function Navbar({ onToggleSidebar }: NavbarProps) {
  const { logout, user } = useAuth()
  const { changeLanguage } = useUserPreferences()
  const { t, i18n } = useTranslation(['nav', 'constants'])

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
          <img src="/qwen.svg" alt="Qwen" className="h-6 w-6" />
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Globe className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => changeLanguage('zh-CN')}>
              {t('constants:uiLanguages.zh-CN')} {i18n.language === 'zh-CN' && '✓'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeLanguage('zh-TW')}>
              {t('constants:uiLanguages.zh-TW')} {i18n.language === 'zh-TW' && '✓'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeLanguage('en-US')}>
              {t('constants:uiLanguages.en-US')} {i18n.language === 'en-US' && '✓'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeLanguage('ja-JP')}>
              {t('constants:uiLanguages.ja-JP')} {i18n.language === 'ja-JP' && '✓'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeLanguage('ko-KR')}>
              {t('constants:uiLanguages.ko-KR')} {i18n.language === 'ko-KR' && '✓'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </nav>
  )
}
