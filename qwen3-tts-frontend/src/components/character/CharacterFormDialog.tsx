import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CharacterForm } from './CharacterForm'
import type { Character, CreateCharacterRequest, UpdateCharacterRequest } from '@/lib/api/characters'

interface CharacterFormDialogProps {
  open: boolean
  character?: Character
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CreateCharacterRequest | UpdateCharacterRequest) => Promise<void>
}

export const CharacterFormDialog: React.FC<CharacterFormDialogProps> = ({
  open,
  character,
  onOpenChange,
  onSubmit
}) => {
  const handleSubmit = async (data: CreateCharacterRequest | UpdateCharacterRequest) => {
    await onSubmit(data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{character ? '编辑角色' : '创建角色'}</DialogTitle>
        </DialogHeader>
        <CharacterForm
          character={character}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
