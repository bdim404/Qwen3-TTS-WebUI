import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import VoiceForm from './VoiceForm'
import type { VoiceLibrary, VoiceLibraryCreate, VoiceLibraryUpdate } from '@/lib/api/voices'
import { useVoiceLibrary } from '@/contexts/VoiceLibraryContext'

interface VoiceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  voice?: VoiceLibrary
}

const VoiceFormDialog: React.FC<VoiceFormDialogProps> = ({ open, onOpenChange, voice }) => {
  const { createVoice, updateVoice } = useVoiceLibrary()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formKey, setFormKey] = useState(0)

  const handleSubmit = async (data: VoiceLibraryCreate | VoiceLibraryUpdate) => {
    setIsSubmitting(true)
    try {
      if (voice) {
        await updateVoice(voice.id, data as VoiceLibraryUpdate)
        toast.success('音色库已更新')
      } else {
        await createVoice(data as VoiceLibraryCreate)
        toast.success('音色库已创建并生成预览音频')
      }
      onOpenChange(false)
      setFormKey(prev => prev + 1)
    } catch (error: any) {
      toast.error(error.message || (voice ? '更新音色库失败' : '创建音色库失败'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{voice ? '编辑音色库' : '创建音色库'}</DialogTitle>
          <DialogDescription>
            {voice ? '修改音色库信息' : '创建新的音色库并生成预览音频'}
          </DialogDescription>
        </DialogHeader>

        <VoiceForm key={formKey} voice={voice} onSubmit={handleSubmit} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            取消
          </Button>
          <Button type="submit" form="voice-form" disabled={isSubmitting}>
            {isSubmitting ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default VoiceFormDialog
