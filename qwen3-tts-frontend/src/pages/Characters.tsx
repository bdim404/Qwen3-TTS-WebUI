import React, { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useCharacter } from '@/contexts/CharacterContext'
import { CharacterCard } from '@/components/character/CharacterCard'
import { CharacterFormDialog } from '@/components/character/CharacterFormDialog'
import type { Character, CreateCharacterRequest, UpdateCharacterRequest } from '@/lib/api/characters'
import { toast } from 'sonner'
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
import { Navbar } from '@/components/Navbar'

export const Characters: React.FC = () => {
  const { characters, isLoading, error, loadCharacters, createCharacter, updateCharacter, deleteCharacter } = useCharacter()
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<Character | undefined>()
  const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null)

  useEffect(() => {
    loadCharacters()
  }, [loadCharacters])

  const handleCreate = () => {
    setEditingCharacter(undefined)
    setIsFormDialogOpen(true)
  }

  const handleEdit = (character: Character) => {
    setEditingCharacter(character)
    setIsFormDialogOpen(true)
  }

  const handleSubmit = async (data: CreateCharacterRequest | UpdateCharacterRequest) => {
    try {
      if (editingCharacter) {
        await updateCharacter(editingCharacter.id, data as UpdateCharacterRequest)
        toast.success('角色更新成功')
      } else {
        await createCharacter(data as CreateCharacterRequest)
        toast.success('角色创建成功')
      }
    } catch (error: any) {
      toast.error(error.message || '操作失败')
      throw error
    }
  }

  const handleDeleteClick = (character: Character) => {
    setCharacterToDelete(character)
  }

  const handleDeleteConfirm = async () => {
    if (!characterToDelete) return

    try {
      await deleteCharacter(characterToDelete.id)
      toast.success('角色删除成功')
      setCharacterToDelete(null)
    } catch (error: any) {
      toast.error(error.message || '删除失败')
    }
  }

  if (isLoading && characters.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-8 px-4">
          <div className="text-center">
            <p className="text-muted-foreground">加载角色列表...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">角色管理</h1>
          <p className="text-muted-foreground mt-1">
            创建和管理对话角色，设置音色和外观
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          创建角色
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {characters.length === 0 && !isLoading && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">还没有创建任何角色</p>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            创建第一个角色
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {characters.map((character) => (
          <CharacterCard
            key={character.id}
            character={character}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
          />
        ))}
      </div>

      <CharacterFormDialog
        open={isFormDialogOpen}
        character={editingCharacter}
        onOpenChange={setIsFormDialogOpen}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!characterToDelete} onOpenChange={() => setCharacterToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除角色 "{characterToDelete?.name}" 吗？此操作无法撤销。
              {characterToDelete && (
                <div className="mt-2 text-sm text-muted-foreground">
                  如果该角色正在被对话使用，将无法删除。
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  )
}

export default Characters
