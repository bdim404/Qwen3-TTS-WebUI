import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Trash2, Cpu, Cloud } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { voiceDesignApi } from '@/lib/api'
import type { VoiceDesign } from '@/types/voice-design'

export default function VoiceManagement() {
  const { t } = useTranslation(['voice', 'common'])
  const [voices, setVoices] = useState<VoiceDesign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<VoiceDesign | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const load = async () => {
    try {
      setIsLoading(true)
      const res = await voiceDesignApi.list()
      setVoices(res.designs)
    } catch {
      toast.error(t('voice:loadFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setIsDeleting(true)
      await voiceDesignApi.delete(deleteTarget.id)
      toast.success(t('voice:voiceDeleted'))
      setDeleteTarget(null)
      await load()
    } catch {
      toast.error(t('voice:deleteFailed'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 max-w-[800px]">
        <Card>
          <CardHeader>
            <CardTitle>{t('voice:myVoices')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">{t('common:loading')}</div>
            ) : voices.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">{t('voice:noVoices')}</div>
            ) : (
              <div className="divide-y">
                {voices.map((voice) => (
                  <div key={voice.id} className="flex items-start justify-between py-4 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{voice.name}</span>
                        <Badge variant="outline" className="shrink-0 gap-1">
                          {voice.backend_type === 'local'
                            ? <><Cpu className="h-3 w-3" />{t('voice:local')}</>
                            : <><Cloud className="h-3 w-3" />{t('voice:aliyun')}</>
                          }
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{voice.instruct}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('voice:createdAt')}: {new Date(voice.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(voice)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('voice:deleteVoice')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('voice:deleteConfirmDesc', { name: deleteTarget?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? t('voice:deleting') : t('common:delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
