import React, { useEffect, useState } from 'react'
import { Plus, Search, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import VoiceCard from '@/components/voice-library/VoiceCard'
import VoiceFormDialog from '@/components/voice-library/VoiceFormDialog'
import DeleteConfirmDialog from '@/components/voice-library/DeleteConfirmDialog'
import { useVoiceLibrary } from '@/contexts/VoiceLibraryContext'
import type { VoiceLibrary as VoiceLibraryType } from '@/lib/api/voices'
import { Navbar } from '@/components/Navbar'

const VoiceLibrary: React.FC = () => {
  const { voices, total, currentPage, pageSize, isLoading, loadVoices, previewVoice } = useVoiceLibrary()
  const [searchTags, setSearchTags] = useState('')
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<VoiceLibraryType | null>(null)
  const [isRegenerating, setIsRegenerating] = useState<number | null>(null)

  useEffect(() => {
    loadVoices()
  }, [loadVoices])

  const handleSearch = () => {
    loadVoices(1, searchTags || undefined)
  }

  const handleEdit = (voice: VoiceLibraryType) => {
    setSelectedVoice(voice)
    setIsFormDialogOpen(true)
  }

  const handleDelete = (voice: VoiceLibraryType) => {
    setSelectedVoice(voice)
    setIsDeleteDialogOpen(true)
  }

  const handleRegeneratePreview = async (voice: VoiceLibraryType) => {
    setIsRegenerating(voice.id)
    try {
      await previewVoice(voice.id)
      toast.success('预览音频已重新生成')
      loadVoices(currentPage, searchTags || undefined)
    } catch (error: any) {
      toast.error(error.message || '重新生成预览音频失败')
    } finally {
      setIsRegenerating(null)
    }
  }

  const handlePageChange = (page: number) => {
    loadVoices(page, searchTags || undefined)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">音色库管理</h1>
          <p className="text-muted-foreground mt-1">创建和管理您的音色库</p>
        </div>
        <Button onClick={() => {
          setSelectedVoice(null)
          setIsFormDialogOpen(true)
        }}>
          <Plus className="h-4 w-4 mr-2" />
          创建音色库
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="按标签搜索..."
            value={searchTags}
            onChange={(e) => setSearchTags(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button variant="outline" onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            搜索
          </Button>
        </div>
        <Button variant="outline" onClick={() => loadVoices(currentPage)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {isLoading && voices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : voices.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">暂无音色库</p>
          <Button onClick={() => setIsFormDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            创建第一个音色库
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {voices.map((voice) => (
              <VoiceCard
                key={voice.id}
                voice={voice}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRegeneratePreview={handleRegeneratePreview}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
              >
                上一页
              </Button>

              <div className="text-sm text-muted-foreground">
                第 {currentPage} / {totalPages} 页 (共 {total} 个)
              </div>

              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || isLoading}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      )}

      <VoiceFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        voice={selectedVoice || undefined}
      />

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        voice={selectedVoice}
      />
      </div>
    </div>
  )
}

export default VoiceLibrary
