import { memo, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Shuffle } from 'lucide-react'

interface Preset {
  label: string
  [key: string]: any
}

interface PresetSelectorProps<T extends Preset> {
  presets: readonly T[]
  onSelect: (preset: T) => void
}

const PresetSelectorInner = <T extends Preset>({ presets, onSelect }: PresetSelectorProps<T>) => {
  const presetButtons = useMemo(() => {
    return presets.map((preset, index) => (
      <Button
        key={`${preset.label}-${index}`}
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onSelect(preset)}
        className="text-xs md:text-sm px-2 h-6 md:h-7"
      >
        {preset.label}
      </Button>
    ))
  }, [presets, onSelect])

  const handleRandomSelect = () => {
    const randomIndex = Math.floor(Math.random() * presets.length)
    onSelect(presets[randomIndex])
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex flex-wrap gap-1 flex-1">
        {presetButtons}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleRandomSelect}
        className="h-6 md:h-7 px-2 flex-shrink-0"
        title="随机选择"
      >
        <Shuffle className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export const PresetSelector = memo(PresetSelectorInner) as typeof PresetSelectorInner
