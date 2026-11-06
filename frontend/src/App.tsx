import { useCallback, useEffect, useState } from 'react'
import { AudioLines, LogOut, Moon, Sun, X } from 'lucide-react'
import { api, ApiError, DEFAULT_PARAMS, type HistoryItem, type Mode, type Params, type Status, type Voice } from './api.ts'
import { LOCALES, useI18n } from './i18n.tsx'
import Generator from './components/Generator.tsx'
import History from './components/History.tsx'
import Login from './components/Login.tsx'

export type RefAudio = { blob: Blob; url: string; name: string; duration: number }

export type FormState = {
  mode: Mode
  text: string
  language: string
  speaker: string
  instruct: string
  designInstruct: string
  voiceId: string
  ref: RefAudio | null
  refText: string
  saveAs: string
  params: Params
}

const INITIAL_FORM: FormState = {
  mode: 'custom-voice',
  text: '',
  language: 'Auto',
  speaker: 'Vivian',
  instruct: '',
  designInstruct: '',
  voiceId: '',
  ref: null,
  refText: '',
  saveAs: '',
  params: DEFAULT_PARAMS,
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {}
    setDark(next)
  }
  return (
    <button className="btn-ghost" onClick={toggle} aria-label="theme">
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

export default function App() {
  const { t, lang, setLang } = useI18n()
  const [status, setStatus] = useState<Status | null>(null)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [voices, setVoices] = useState<Voice[]>([])
  const [latestId, setLatestId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = useCallback(() => api.status().then(setStatus).catch((e) => setError(e.message)), [])
  const authed = !!status && (!status.auth_required || status.authenticated)

  const fail = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) loadStatus()
    else setError(e instanceof Error ? e.message : String(e))
  }, [loadStatus])

  const loadVoices = useCallback(() => api.voices().then(setVoices).catch(fail), [fail])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (!authed) return
    api.history().then(setHistory).catch(fail)
    loadVoices()
  }, [authed, fail, loadVoices])

  useEffect(() => {
    if (!busy) return
    const timer = setInterval(() => api.status().then(setStatus).catch(() => {}), 1000)
    return () => clearInterval(timer)
  }, [busy])

  const generate = async () => {
    setError(null)
    const { mode, text, language, params } = form
    if (mode === 'voice-clone' && !form.voiceId && !form.ref) {
      setError(t('errors.refRequired'))
      return
    }
    setBusy(true)
    try {
      let item: HistoryItem
      if (mode === 'custom-voice') {
        item = await api.customVoice({ text, language, params, speaker: form.speaker, instruct: form.instruct })
      } else if (mode === 'voice-design') {
        item = await api.voiceDesign({ text, language, params, instruct: form.designInstruct })
      } else if (form.voiceId) {
        item = await api.voiceClone({ text, language, params, voice_id: form.voiceId })
      } else {
        item = await api.voiceClone({ text, language, params, ref_audio: form.ref!.blob, ref_text: form.refText, save_as: form.saveAs })
        if (form.saveAs.trim()) {
          setForm((f) => ({ ...f, saveAs: '' }))
          loadVoices()
        }
      }
      setHistory((h) => [item, ...h])
      setLatestId(item.id)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
      api.status().then(setStatus).catch(() => {})
    }
  }

  const reuse = (item: HistoryItem) => {
    setForm((f) => ({
      ...f,
      mode: item.mode,
      text: item.text,
      language: item.language,
      params: { ...DEFAULT_PARAMS, ...item.params },
      ...(item.mode === 'custom-voice' && { speaker: item.speaker ?? f.speaker, instruct: item.instruct ?? '' }),
      ...(item.mode === 'voice-design' && { designInstruct: item.instruct ?? '' }),
      ...(item.mode === 'voice-clone' && item.voice_id && voices.some((v) => v.id === item.voice_id) && { voiceId: item.voice_id }),
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const removeHistory = async (id: string) => {
    try {
      await api.deleteHistory(id)
      setHistory((h) => h.filter((i) => i.id !== id))
    } catch (e) {
      fail(e)
    }
  }

  const saveVoice = async (item: HistoryItem, name: string) => {
    try {
      const voice = await api.createVoice({ name, history_id: item.id })
      setVoices((v) => [voice, ...v])
      return true
    } catch (e) {
      fail(e)
      return false
    }
  }

  const removeVoice = async (id: string) => {
    try {
      await api.deleteVoice(id)
      setVoices((v) => v.filter((i) => i.id !== id))
      setForm((f) => (f.voiceId === id ? { ...f, voiceId: '' } : f))
    } catch (e) {
      fail(e)
    }
  }

  const logout = async () => {
    await api.logout().catch(() => {})
    loadStatus()
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <AudioLines className="shrink-0 text-primary" size={22} />
          <h1 className="truncate font-semibold">Qwen3-TTS WebUI</h1>
          {status && authed && (
            <span className="hidden rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:inline">
              {status.device} · {status.model_size}
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <select className="input w-auto py-1 pr-8" value={lang} onChange={(e) => setLang(e.target.value)}>
              {Object.entries(LOCALES).map(([code, { label }]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
            <ThemeToggle />
            {status?.auth_required && status.authenticated && (
              <button className="btn-ghost" onClick={logout} title={t('logout')}>
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-4 max-w-6xl px-4">
          <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            <span className="flex-1 whitespace-pre-wrap break-words">{error}</span>
            <button onClick={() => setError(null)}><X size={16} /></button>
          </div>
        </div>
      )}

      {status && !authed && <Login onSuccess={loadStatus} />}

      {status && authed && (
        <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Generator
            form={form}
            setForm={setForm}
            status={status}
            voices={voices}
            busy={busy}
            onGenerate={generate}
            onDeleteVoice={removeVoice}
            onError={setError}
          />
          <History
            items={history}
            latestId={latestId}
            onReuse={reuse}
            onDelete={removeHistory}
            onSaveVoice={saveVoice}
          />
        </main>
      )}
    </div>
  )
}
