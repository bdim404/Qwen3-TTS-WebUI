import { memo, useMemo } from 'react'
import { Button } from '@/components/ui/button'

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
        className="text-xs md:text-sm px-2.5 md:px-3 h-7 md:h-8"
      >
        {preset.label}
      </Button>
    ))
  }, [presets, onSelect])

  return (
    <div className="flex flex-wrap gap-1.5 md:gap-2 mt-1.5 md:mt-2">
      {presetButtons}
    </div>
  )
}

export const PresetSelector = memo(PresetSelectorInner) as typeof PresetSelectorInner
