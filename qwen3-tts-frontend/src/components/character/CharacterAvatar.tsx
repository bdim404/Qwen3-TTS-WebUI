import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import * as LucideIcons from 'lucide-react';

interface CharacterAvatarProps {
  character: {
    name: string;
    avatar_type: string;
    avatar_data?: string;
    color: string;
  };
  size?: 'sm' | 'md' | 'lg';
}

export default function CharacterAvatar({ character, size = 'md' }: CharacterAvatarProps) {
  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-lg',
  };

  const renderAvatar = () => {
    if (character.avatar_type === 'icon' && character.avatar_data) {
      const IconComponent = (LucideIcons as any)[character.avatar_data];
      if (IconComponent) {
        return (
          <Avatar className={sizeClasses[size]} style={{ backgroundColor: character.color }}>
            <AvatarFallback style={{ backgroundColor: character.color, color: 'white' }}>
              <IconComponent className={size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-5 w-5' : 'h-8 w-8'} />
            </AvatarFallback>
          </Avatar>
        );
      }
    }

    if (character.avatar_type === 'upload' && character.avatar_data) {
      return (
        <Avatar className={sizeClasses[size]}>
          <img src={character.avatar_data} alt={character.name} className="object-cover" />
        </Avatar>
      );
    }

    const initial = character.name.charAt(0).toUpperCase();
    return (
      <Avatar className={sizeClasses[size]}>
        <AvatarFallback style={{ backgroundColor: character.color, color: 'white' }}>{initial}</AvatarFallback>
      </Avatar>
    );
  };

  return renderAvatar();
}
