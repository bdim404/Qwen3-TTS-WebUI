import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { Copy, Loader2, Mic, Palette, Square, Trash2, Upload, User, Wand2 } from 'lucide-react'
import { api, type Mode, type Status, type Voice } from '../api.ts'
import { startRecording, toWav } from '../audio.ts'
import { useI18n } from '../i18n.tsx'
import type { FormState } from '../App.tsx'
import ParamsPanel from './Params.tsx'

type Props = {
  form: FormState
  setForm: Dispatch<SetStateAction<FormState>>
  status: Status
  voices: Voice[]
  busy: boolean
  onGenerate: () => void
  onDeleteVoice: (id: string) => void
  onError: (message: string) => void
}

const TABS: { mode: Mode; icon: typeof User }[] = [
  { mode: 'custom-voice', icon: User },
  { mode: 'voice-design', icon: Palette },
  { mode: 'voice-clone', icon: Copy },
]

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Presets({ items, onPick }: { items: { label: string }[]; onPick: (index: number) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <button key={item.label} type="button" className="chip" onClick={() => onPick(i)}>
          {item.label}
        </button>
      ))}
    </div>
  )
}

function useElapsed(active: boolean) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!active) return
    setSeconds(0)
    const start = Date.now()
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 500)
    return () => clearInterval(timer)
  }, [active])
  return seconds
}

export default function Generator({ form, setForm, status, voices, busy, onGenerate, onDeleteVoice, onError }: Props) {
  const { t, dict } = useI18n()
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))
  const elapsed = useElapsed(busy)
  const stopRef = useRef<(() => Promise<Blob>) | null>(null)
  const [recording, setRecording] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const voice = voices.find((v) => v.id === form.voiceId)

  const setRef = async (blob: Blob, name: string) => {
    try {
      const { blob: wav, duration } = await toWav(blob)
      if (duration > 60) return onError(t('errors.refTooLong'))
      if (duration < 1) return onError(t('errors.refTooShort'))
      setForm((f) => {
        if (f.ref) URL.revokeObjectURL(f.ref.url)
        return { ...f, ref: { blob: wav, url: URL.createObjectURL(wav), name, duration } }
      })
    } catch {
      onError(t('errors.decode'))
    }
  }

  const toggleRecording = async () => {
    if (stopRef.current) {
      const blob = await stopRef.current()
      stopRef.current = null
      setRecording(false)
      await setRef(blob, t('clone.recording'))
      return
    }
    try {
      stopRef.current = await startRecording()
      setRecording(true)
    } catch {
      onError(t('errors.mic'))
    }
  }

  const busyText = (() => {
    const s = status.busy
    if (s?.startsWith('downloading:')) return t('busy.downloading', { name: s.slice(12) })
    if (s?.startsWith('loading:')) return t('busy.loading', { name: s.slice(8) })
    return t('busy.generating')
  })()

  const languageSelect = (
    <Field label={t('language')}>
      <select className="input" value={form.language} onChange={(e) => set({ language: e.target.value })}>
        {status.languages.map((code) => (
          <option key={code} value={code}>{(dict.languages as Record<string, string>)[code] ?? code}</option>
        ))}
      </select>
    </Field>
  )

  const canSubmit =
    !busy &&
    form.text.trim().length > 0 &&
    (form.mode !== 'voice-design' || form.designInstruct.trim().length > 0) &&
    (form.mode !== 'voice-clone' || !!form.voiceId || !!form.ref)

  return (
    <section className="h-fit space-y-5 rounded-xl border border-border bg-card p-4 shadow-sm md:p-6">
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {TABS.map(({ mode, icon: Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => set({ mode })}
            className={`btn flex-col gap-0.5 px-1 py-1.5 text-xs sm:flex-row sm:gap-1.5 sm:text-sm ${form.mode === mode ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Icon size={16} /> <span className="truncate">{t(`modes.${mode}`)}</span>
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{t(`modeHints.${form.mode}`)}</p>

      {form.mode === 'custom-voice' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('speaker')}>
              <select className="input" value={form.speaker} onChange={(e) => set({ speaker: e.target.value })}>
                {status.speakers.map((name) => (
                  <option key={name} value={name}>
                    {name} · {(dict.speakers as Record<string, string>)[name] ?? ''}
                  </option>
                ))}
              </select>
            </Field>
            {languageSelect}
          </div>
          <Field label={t('instruct')}>
            <textarea className="input min-h-[64px]" value={form.instruct} placeholder={t('instructPlaceholder')} onChange={(e) => set({ instruct: e.target.value })} />
            <Presets items={dict.presetInstructs} onPick={(i) => set({ instruct: dict.presetInstructs[i].instruct, text: dict.presetInstructs[i].text })} />
          </Field>
        </>
      )}

      {form.mode === 'voice-design' && (
        <>
          <Field label={t('design.instruct')}>
            <textarea className="input min-h-[88px]" value={form.designInstruct} placeholder={t('design.placeholder')} onChange={(e) => set({ designInstruct: e.target.value })} />
            <Presets items={dict.presetVoiceDesigns} onPick={(i) => set({ designInstruct: dict.presetVoiceDesigns[i].instruct, text: dict.presetVoiceDesigns[i].text })} />
          </Field>
          {languageSelect}
        </>
      )}

      {form.mode === 'voice-clone' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('clone.voice')}>
              <select className="input" value={form.voiceId} onChange={(e) => set({ voiceId: e.target.value })}>
                <option value="">{t('clone.newReference')}</option>
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </Field>
            {languageSelect}
          </div>

          {voice ? (
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <audio controls preload="none" src={api.voiceAudio(voice.id)} />
                <button
                  type="button"
                  className="btn-ghost hover:text-danger"
                  title={t('clone.deleteVoice')}
                  onClick={() => confirm(t('clone.confirmDeleteVoice', { name: voice.name })) && onDeleteVoice(voice.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">{voice.instruct || voice.ref_text || t('clone.noTranscript')}</p>
            </div>
          ) : (
            <>
              <Field label={t('clone.refAudio')} hint={t('clone.refAudioHint')}>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setRef(file, file.name)
                      e.target.value = ''
                    }}
                  />
                  <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()} disabled={recording}>
                    <Upload size={16} /> {t('clone.upload')}
                  </button>
                  <button type="button" className={recording ? 'btn-primary' : 'btn-outline'} onClick={toggleRecording}>
                    {recording ? <Square size={16} /> : <Mic size={16} />} {recording ? t('clone.stop') : t('clone.record')}
                  </button>
                </div>
                {form.ref && (
                  <div className="mt-2 space-y-1">
                    <audio controls src={form.ref.url} />
                    <p className="text-xs text-muted-foreground">{form.ref.name} · {form.ref.duration.toFixed(1)}s</p>
                  </div>
                )}
              </Field>
              <Field label={t('clone.refText')} hint={t('clone.refTextHint')}>
                <textarea className="input min-h-[64px]" value={form.refText} placeholder={t('clone.refTextPlaceholder')} onChange={(e) => set({ refText: e.target.value })} />
                <Presets items={dict.presetRefTexts} onPick={(i) => set({ refText: dict.presetRefTexts[i].text })} />
              </Field>
              <Field label={t('clone.saveAs')}>
                <input className="input" value={form.saveAs} maxLength={100} placeholder={t('clone.saveAsPlaceholder')} onChange={(e) => set({ saveAs: e.target.value })} />
              </Field>
            </>
          )}
        </>
      )}

      <Field label={t('text')}>
        <textarea
          className="input min-h-[120px]"
          value={form.text}
          maxLength={status.max_text_length}
          placeholder={t('textPlaceholder')}
          onChange={(e) => set({ text: e.target.value })}
        />
        <div className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
          {form.text.length} / {status.max_text_length}
        </div>
      </Field>

      <ParamsPanel value={form.params} onChange={(params) => set({ params })} />

      <button type="button" className="btn-primary w-full py-2.5" disabled={!canSubmit} onClick={onGenerate}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
        {busy ? `${busyText} ${elapsed}s` : t('generate')}
      </button>
      {!status.loaded_models.length && !busy && <p className="text-center text-xs text-muted-foreground">{t('firstRunHint')}</p>}
    </section>
  )
}
