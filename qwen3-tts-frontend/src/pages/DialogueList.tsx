import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDialogue } from '@/contexts/DialogueContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search } from 'lucide-react';

export default function DialogueList() {
  const navigate = useNavigate();
  const { dialogues, isLoading, loadDialogues, createNewDialogue, deleteDialogueData, duplicateDialogueData } = useDialogue();
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadDialogues();
  }, [loadDialogues]);

  const handleCreate = async () => {
    try {
      const id = await createNewDialogue('新对话');
      navigate(`/dialogues/${id}`);
    } catch (error) {
      console.error('创建对话失败:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('确定要删除这个对话吗？')) {
      try {
        await deleteDialogueData(id);
      } catch (error) {
        console.error('删除对话失败:', error);
      }
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      const newId = await duplicateDialogueData(id);
      navigate(`/dialogues/${newId}`);
    } catch (error) {
      console.error('复制对话失败:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-500';
      case 'generating':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'partial':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return '草稿';
      case 'generating':
        return '生成中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      case 'partial':
        return '部分完成';
      default:
        return status;
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">对话管理</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新建对话
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索对话..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dialogues.map((dialogue) => (
            <Card key={dialogue.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader onClick={() => navigate(`/dialogues/${dialogue.id}`)}>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{dialogue.title}</CardTitle>
                  <Badge className={getStatusColor(dialogue.status)}>{getStatusText(dialogue.status)}</Badge>
                </div>
              </CardHeader>
              <CardContent onClick={() => navigate(`/dialogues/${dialogue.id}`)}>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>总行数:</span>
                    <span className="font-medium">{dialogue.total_lines}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>已完成:</span>
                    <span className="font-medium text-green-600">{dialogue.success_count}</span>
                  </div>
                  {dialogue.failed_count > 0 && (
                    <div className="flex justify-between">
                      <span>失败:</span>
                      <span className="font-medium text-red-600">{dialogue.failed_count}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>创建时间:</span>
                    <span>{new Date(dialogue.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate(dialogue.id);
                    }}
                  >
                    复制
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(dialogue.id);
                    }}
                  >
                    删除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && dialogues.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">还没有对话，点击"新建对话"开始</p>
        </div>
      )}
    </div>
  );
}
