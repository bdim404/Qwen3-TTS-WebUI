import { useState, useEffect } from 'react';
import { useDialogue } from '@/contexts/DialogueContext';
import { useCharacter } from '@/contexts/CharacterContext';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import DialogueLineRow from './DialogueLineRow';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function DialogueTable() {
  const { lines, addLine } = useDialogue();
  const { characters, loadCharacters } = useCharacter();
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  const handleAddLine = async () => {
    if (characters.length === 0) {
      alert('请先创建角色');
      return;
    }
    try {
      await addLine({
        character_id: characters[0].id,
        text: '新对话',
      });
    } catch (error) {
      console.error('添加对话行失败:', error);
    }
  };

  useKeyboardShortcuts(
    [
      {
        key: 'Enter',
        handler: handleAddLine,
      },
    ],
    true
  );

  return (
    <div className="p-6">
      <div className="mb-4">
        <Button onClick={handleAddLine}>
          <Plus className="mr-2 h-4 w-4" />
          添加对话行 (Enter)
        </Button>
      </div>

      <div className="space-y-2">
        {lines.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>还没有对话行，点击"添加对话行"或按 Enter 键开始</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">
                    序号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-48">
                    角色
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    文本
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-32">
                    状态
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-32">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {lines.map((line) => (
                  <DialogueLineRow
                    key={line.id}
                    line={line}
                    isSelected={selectedLineId === line.id}
                    onSelect={() => setSelectedLineId(line.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
