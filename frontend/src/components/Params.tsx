import { RotateCcw } from 'lucide-react'
import { DEFAULT_PARAMS, type Params } from '../api.ts'
import { useI18n } from '../i18n.tsx'

const FIELDS: { key: keyof Params; min: number; max: number; step: number }[] = [
  { key: 'max_new_tokens', min: 128, max: 8192, step: 128 },
  { key: 'temperature', min: 0.1, max: 2, step: 0.05 },
  { key: 'top_k', min: 1, max: 100, step: 1 },
  { key: 'top_p', min: 0, max: 1, step: 0.05 },
  { key: 'repetition_penalty', min: 1, max: 2, step: 0.01 },
]

export default function ParamsPanel({ value, onChange }: { value: Params; onChange: (p: Params) => void }) {
  const { t } = useI18n()
  return (
    <details className="group rounded-md border border-border">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm text-muted-foreground">{t('params.title')}</summary>
      <div className="space-y-3 border-t border-border p-3">
        {FIELDS.map(({ key, min, max, step }) => (
          <label key={key} className="block" title={t(`params.${key}.hint`)}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{t(`params.${key}.label`)}</span>
              <span className="tabular-nums text-muted-foreground">{value[key]}</span>
            </div>
            <input
              type="range"
              className="w-full accent-[hsl(var(--primary))]"
              min={min}
              max={max}
              step={step}
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">{t(`params.${key}.hint`)}</p>
          </label>
        ))}
        <button type="button" className="btn-ghost" onClick={() => onChange(DEFAULT_PARAMS)}>
          <RotateCcw size={14} /> {t('params.reset')}
        </button>
      </div>
    </details>
  )
}
