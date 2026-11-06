import { useState, type FormEvent } from 'react'
import { Lock } from 'lucide-react'
import { api } from '../api.ts'
import { useI18n } from '../i18n.tsx'

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(false)
    try {
      await api.login(password)
      onSuccess()
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-24 w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 font-medium">
        <Lock size={18} /> {t('login.title')}
      </div>
      <input
        className="input"
        type="password"
        autoFocus
        placeholder={t('login.password')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm text-danger">{t('login.wrong')}</p>}
      <button className="btn-primary w-full" disabled={loading || !password}>
        {t('login.submit')}
      </button>
    </form>
  )
}
