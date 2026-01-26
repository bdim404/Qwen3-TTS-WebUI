import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'
import type { UseFormRegister, FieldValues, Path } from 'react-hook-form'

interface ParamInputProps<T extends FieldValues> {
  name: Path<T>
  label: string
  description: string
  tooltip: string
  register: UseFormRegister<T>
  type?: 'number'
  step?: number
  min?: number
  max?: number
}

export function ParamInput<T extends FieldValues>({
  name,
  label,
  description,
  tooltip,
  register,
  type = 'number',
  step,
  min,
  max,
}: ParamInputProps<T>) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={name}>{label}</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger type="button" asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-sm">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Input
        {...register(name, { valueAsNumber: type === 'number' })}
        type={type}
        step={step}
        min={min}
        max={max}
      />
      <p className="text-xs text-muted-foreground md:hidden">{description}</p>
    </div>
  )
}
