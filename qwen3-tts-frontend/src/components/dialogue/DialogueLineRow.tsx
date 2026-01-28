import { useState, useEffect } from 'react';
import { useDialogue } from '@/contexts/DialogueContext';
import { useCharacter } from '@/contexts/CharacterContext';
import type { DialogueLineWithCharacter } from '@/lib/api/dialogues';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Copy } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import CharacterAvatar from '@/components/character/CharacterAvatar';

interface DialogueLineRowProps {
  line: DialogueLineWithCharacter;
  isSelected: boolean;
  onSelect: () => void;
}

export default function DialogueLineRow({ line, isSelected, onSelect }: DialogueLineRowProps) {
  const { updateLine, deleteLine, addLine } = useDialogue();
  const { characters } = useCharacter();
  const [text, setText] = useState(line.text);
  const [characterId, setCharacterId] = useState(line.character_id);
  const debouncedText = useDebounce(text, 300);

  useEffect(() => {
    if (debouncedText !== line.text) {
      updateLine(line.id, { text: debouncedText });
    }
  }, [debouncedText]);

  useEffect(() => {
    if (characterId !== line.character_id) {
      updateLine(line.id, { character_id: characterId });
    }
  }, [characterId]);

  const handleDelete = async () => {
    if (confirm('确定要删除这一行吗？')) {
      try {
        await deleteLine(line.id);
      } catch (error) {
        console.error('删除对话行失败:', error);
      }
    }
  };

  const handleDuplicate = async () => {
    try {
      await addLine({
        character_id: line.character_id,
        text: line.text,
        instruct_override: line.instruct_override,
        tts_params_override: line.tts_params_override,
      });
    } catch (error) {
      console.error('复制对话行失败:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-500';
      case 'processing':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '待生成';
      case 'processing':
        return '生成中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      default:
        return status;
    }
  };

  const selectedCharacter = characters.find((c) => c.id === characterId);

  return (
    <tr className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`} onClick={onSelect}>
      <td className="px-4 py-3 text-sm text-gray-900">{line.order + 1}</td>
      <td className="px-4 py-3">
        <Select value={characterId.toString()} onValueChange={(value) => setCharacterId(parseInt(value))}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {selectedCharacter && (
                <div className="flex items-center gap-2">
                  <CharacterAvatar character={selectedCharacter} size="sm" />
                  <span>{selectedCharacter.name}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {characters.map((character) => (
              <SelectItem key={character.id} value={character.id.toString()}>
                <div className="flex items-center gap-2">
                  <CharacterAvatar character={character} size="sm" />
                  <span>{character.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="输入对话内容..."
          className="min-h-[60px] resize-none"
          maxLength={2000}
        />
        <div className="text-xs text-gray-500 mt-1">{text.length}/2000</div>
      </td>
      <td className="px-4 py-3">
        <Badge className={getStatusColor(line.status)}>{getStatusText(line.status)}</Badge>
        {line.error_message && (
          <div className="text-xs text-red-600 mt-1">{line.error_message}</div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={handleDuplicate}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
