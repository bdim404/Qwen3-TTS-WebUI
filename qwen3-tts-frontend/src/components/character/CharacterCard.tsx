import React from 'react'
import { Edit, Trash2, Library, Disc } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { Character } from '@/lib/api/characters'
import * as LucideIcons from 'lucide-react'

interface CharacterCardProps {
  character: Character
  onEdit: (character: Character) => void
  onDelete: (character: Character) => void
}

export const CharacterCard: React.FC<CharacterCardProps> = ({ character, onEdit, onDelete }) => {
  const getAvatarContent = () => {
    if (character.avatar_type === 'icon' && character.avatar_data) {
      const IconComponent = (LucideIcons as any)[character.avatar_data]
      if (IconComponent) {
        return <IconComponent className="h-5 w-5" />
      }
    }
    if (character.avatar_type === 'initial') {
      return character.name.charAt(0).toUpperCase()
    }
    return character.name.charAt(0).toUpperCase()
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar style={{ backgroundColor: character.color }} className="h-12 w-12">
            <AvatarFallback style={{ backgroundColor: character.color, color: '#fff' }}>
              {getAvatarContent()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{character.name}</h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {character.voice_source_type === 'library' ? (
                <>
                  <Library className="h-3 w-3" />
                  <span className="truncate">{character.voice_library_name || '音色库'}</span>
                </>
              ) : (
                <>
                  <Disc className="h-3 w-3" />
                  <span className="truncate">{character.preset_speaker || '预设音色'}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      {character.description && (
        <CardContent className="pb-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{character.description}</p>
        </CardContent>
      )}

      {character.tags && character.tags.length > 0 && (
        <CardContent className="pb-3 pt-0">
          <div className="flex flex-wrap gap-1">
            {character.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {character.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{character.tags.length - 3}
              </Badge>
            )}
          </div>
        </CardContent>
      )}

      <CardFooter className="pt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onEdit(character)}
        >
          <Edit className="h-4 w-4 mr-1" />
          编辑
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(character)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}
