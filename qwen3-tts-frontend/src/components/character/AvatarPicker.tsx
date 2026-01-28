import React from 'react'
import { User, UserCircle, Users, Bot, Mic, MessageSquare } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface AvatarPickerProps {
  avatarType: 'icon' | 'upload' | 'initial'
  avatarData?: string
  onAvatarTypeChange: (type: 'icon' | 'upload' | 'initial') => void
  onAvatarDataChange: (data: string) => void
}

const ICON_OPTIONS = [
  { value: 'User', label: '用户', Icon: User },
  { value: 'UserCircle', label: '用户圆圈', Icon: UserCircle },
  { value: 'Users', label: '多用户', Icon: Users },
  { value: 'Bot', label: '机器人', Icon: Bot },
  { value: 'Mic', label: '麦克风', Icon: Mic },
  { value: 'MessageSquare', label: '消息', Icon: MessageSquare }
]

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
  avatarType,
  avatarData,
  onAvatarTypeChange,
  onAvatarDataChange
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>头像类型</Label>
        <RadioGroup value={avatarType} onValueChange={(value) => onAvatarTypeChange(value as any)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="icon" id="icon" />
            <Label htmlFor="icon" className="font-normal cursor-pointer">
              图标
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="initial" id="initial" />
            <Label htmlFor="initial" className="font-normal cursor-pointer">
              首字母
            </Label>
          </div>
        </RadioGroup>
      </div>

      {avatarType === 'icon' && (
        <div className="space-y-2">
          <Label>选择图标</Label>
          <Select value={avatarData || 'User'} onValueChange={onAvatarDataChange}>
            <SelectTrigger>
              <SelectValue placeholder="选择图标" />
            </SelectTrigger>
            <SelectContent>
              {ICON_OPTIONS.map(({ value, label, Icon }) => (
                <SelectItem key={value} value={value}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {avatarType === 'initial' && (
        <div className="text-sm text-muted-foreground">
          将自动使用角色名称的首字母作为头像
        </div>
      )}
    </div>
  )
}
