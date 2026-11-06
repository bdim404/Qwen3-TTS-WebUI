import { useState } from 'react'
import { Bookmark, Download, RotateCcw, Trash2 } from 'lucide-react'
import { api, type HistoryItem } from '../api.ts'
import { useI18n } from '../i18n.tsx'

type Props = {
  items: HistoryItem[]
  latestId: string | null
  onReuse: (item: HistoryItem) => void
  onDelete: (id: string) => void
  onSaveVoice: (item: HistoryItem, name: string) => Promise<boolean>
}

function Entry({ item, latest, onReuse, onDelete, onSaveVoice }: Omit<Props, 'items' | 'latestId'> & { item: HistoryItem; latest: boolean }) {
  const { t, lang } = useI18n()
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  const detail = item.mode === 'custom-voice' ? [item.speaker, item.instruct].filter(Boolean).join(' · ') : item.mode === 'voice-design' ? item.instruct : item.voice || t('history.uploadedRef')

  const save = async () => {
    if (!name.trim()) return
    if (await onSaveVoice(item, name.trim())) {
      setNaming(false)
      setSaved(true)
      setName('')
    }
  }

  return (
    <li className={`space-y-2 rounded-lg border bg-card p-3 ${latest ? 'border-primary/60 ring-2 ring-primary/15' : 'border-border'}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{t(`modes.${item.mode}`)}</span>
        <span>{new Date(item.created_at * 1000).toLocaleString(lang)}</span>
        <span className="ml-auto tabular-nums">{item.duration.toFixed(1)}s</span>
      </div>
      <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm">{item.text}</p>
      {detail && <p className="line-clamp-1 text-xs text-muted-foreground" title={detail}>{detail}</p>}
      <audio controls preload={latest ? 'auto' : 'none'} autoPlay={latest} src={api.historyAudio(item.id)} />
      {naming ? (
        <div className="flex gap-2">
          <input
            className="input py-1"
            autoFocus
            maxLength={100}
            placeholder={t('history.voiceName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <button className="btn-primary py-1" onClick={save} disabled={!name.trim()}>{t('history.save')}</button>
          <button className="btn-ghost py-1" onClick={() => setNaming(false)}>{t('history.cancel')}</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          <button className="btn-ghost py-1 text-xs" onClick={() => onReuse(item)}>
            <RotateCcw size={14} /> {t('history.reuse')}
          </button>
          <a className="btn-ghost py-1 text-xs" href={api.historyAudio(item.id)} download>
            <Download size={14} /> {t('history.download')}
          </a>
          <button className="btn-ghost py-1 text-xs" onClick={() => setNaming(true)} disabled={saved}>
            <Bookmark size={14} /> {saved ? t('history.saved') : t('history.saveVoice')}
          </button>
          <button
            className="btn-ghost ml-auto py-1 text-xs hover:text-danger"
            onClick={() => confirm(t('history.confirmDelete')) && onDelete(item.id)}
            title={t('history.delete')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </li>
  )
}

export default function History({ items, latestId, ...handlers }: Props) {
  const { t } = useI18n()
  return (
    <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
      <h2 className="mb-3 flex items-baseline gap-2 font-semibold">
        {t('history.title')}
        <span className="text-xs font-normal text-muted-foreground">{items.length || ''}</span>
      </h2>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t('history.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <Entry key={item.id} item={item} latest={item.id === latestId} {...handlers} />
          ))}
        </ul>
      )}
    </aside>
  )
}
