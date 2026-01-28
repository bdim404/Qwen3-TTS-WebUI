import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDialogue } from '@/contexts/DialogueContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';
import DialogueTable from '@/components/dialogue/DialogueTable';
import { useDebounce } from '@/hooks/useDebounce';

export default function DialogueEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentDialogue, loadDialogue, updateDialogueData, isSaving } = useDialogue();
  const [title, setTitle] = useState('');
  const debouncedTitle = useDebounce(title, 300);

  useEffect(() => {
    if (id) {
      loadDialogue(parseInt(id));
    }
  }, [id, loadDialogue]);

  useEffect(() => {
    if (currentDialogue) {
      setTitle(currentDialogue.title);
    }
  }, [currentDialogue]);

  useEffect(() => {
    if (debouncedTitle && currentDialogue && debouncedTitle !== currentDialogue.title) {
      updateDialogueData(currentDialogue.id, { title: debouncedTitle });
    }
  }, [debouncedTitle, currentDialogue, updateDialogueData]);

  if (!currentDialogue) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dialogues')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-semibold border-none focus-visible:ring-0"
            placeholder="对话标题"
          />
          <div className="flex items-center gap-2 ml-auto">
            {isSaving ? (
              <span className="text-sm text-gray-500">保存中...</span>
            ) : (
              <span className="text-sm text-green-600">已保存</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <DialogueTable />
      </div>
    </div>
  );
}
