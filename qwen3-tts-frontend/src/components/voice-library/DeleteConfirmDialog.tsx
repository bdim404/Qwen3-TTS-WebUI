import React, { useState, useEffect } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import type { VoiceLibrary, VoiceLibraryWithReferences } from '@/lib/api/voices'
import { useVoiceLibrary } from '@/contexts/VoiceLibraryContext'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  voice: VoiceLibrary | null
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({ open, onOpenChange, voice }) => {
  const { deleteVoice, getVoiceReferences } = useVoiceLibrary()
  const [isDeleting, setIsDeleting] = useState(false)
  const [references, setReferences] = useState<VoiceLibraryWithReferences | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open && voice) {
      setIsLoading(true)
      getVoiceReferences(voice.id)
        .then(setReferences)
        .catch(console.error)
        .finally(() => setIsLoading(false))
    }
  }, [open, voice, getVoiceReferences])

  const handleDelete = async () => {
    if (!voice) return

    setIsDeleting(true)
    try {
      await deleteVoice(voice.id)
      toast.success('音色库已删除')
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || '删除音色库失败')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!voice) return null

  const hasReferences = references && references.reference_count > 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除音色库</AlertDialogTitle>
          <AlertDialogDescription>
            您确定要删除音色库 "{voice.name}" 吗？
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoading ? (
          <div className="py-4">检查引用信息...</div>
        ) : hasReferences ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              该音色正在被 {references!.reference_count} 个角色使用，无法删除。
              <div className="mt-2">
                <strong>使用该音色的角色：</strong>
                <div className="mt-1">{references!.referenced_characters?.join(', ')}</div>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="text-sm text-muted-foreground">
            此操作无法撤销。音色库及其预览音频将被永久删除。
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting || hasReferences}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? '删除中...' : '删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default DeleteConfirmDialog
