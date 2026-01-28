import React from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  color: string
  onColorChange: (color: string) => void
}

const PRESET_COLORS = [
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#8B5CF6',
  '#F59E0B',
  '#EC4899',
  '#FBBF24',
  '#06B6D4',
  '#6366F1',
  '#F43F5E',
  '#14B8A6',
  '#A855F7'
]

export const ColorPicker: React.FC<ColorPickerProps> = ({ color, onColorChange }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>预设颜色</Label>
        <div className="grid grid-cols-6 gap-2">
          {PRESET_COLORS.map((presetColor) => (
            <button
              key={presetColor}
              type="button"
              onClick={() => onColorChange(presetColor)}
              className={cn(
                'w-10 h-10 rounded-md border-2 transition-all',
                color === presetColor ? 'border-primary scale-110' : 'border-transparent hover:scale-105'
              )}
              style={{ backgroundColor: presetColor }}
              title={presetColor}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="custom-color">自定义颜色</Label>
        <div className="flex gap-2">
          <Input
            id="custom-color"
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="w-20 h-10 p-1 cursor-pointer"
          />
          <Input
            type="text"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            pattern="^#[0-9A-Fa-f]{6}$"
            placeholder="#000000"
            className="flex-1"
          />
        </div>
      </div>
    </div>
  )
}
