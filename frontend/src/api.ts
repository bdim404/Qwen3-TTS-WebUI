export type Mode = 'custom-voice' | 'voice-design' | 'voice-clone'

export type Params = {
  max_new_tokens: number
  temperature: number
  top_k: number
  top_p: number
  repetition_penalty: number
}

export const DEFAULT_PARAMS: Params = {
  max_new_tokens: 2048,
  temperature: 0.9,
  top_k: 50,
  top_p: 1.0,
  repetition_penalty: 1.05,
}

export type Status = {
  auth_required: boolean
  authenticated: boolean
  device: string
  model_size: string
  busy: string | null
  loaded_models: string[]
  languages: string[]
  speakers: string[]
  max_text_length: number
}

export type HistoryItem = {
  id: string
  created_at: number
  duration: number
  mode: Mode
  text: string
  language: string
  speaker?: string
  instruct?: string
  voice?: string | null
  voice_id?: string | null
  ref_text?: string
  params: Params
}

export type Voice = {
  id: string
  created_at: number
  duration: number
  name: string
  ref_text: string
  source: string
  instruct?: string
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init)
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = Array.isArray(body.detail)
        ? body.detail.map((d: { msg: string }) => d.msg).join('; ')
        : String(body.detail ?? message)
    } catch {}
    throw new ApiError(res.status, message)
  }
  return res.json()
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const form = (fields: Record<string, string | Blob | undefined>): RequestInit => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (value instanceof Blob) data.append(key, value, 'audio.wav')
    else data.append(key, value)
  }
  return { method: 'POST', body: data }
}

export const api = {
  status: () => request<Status>('/status'),
  login: (password: string) => request('/login', json({ password })),
  logout: () => request('/logout', { method: 'POST' }),
  customVoice: (body: { text: string; language: string; speaker: string; instruct: string; params: Params }) =>
    request<HistoryItem>('/tts/custom-voice', json(body)),
  voiceDesign: (body: { text: string; language: string; instruct: string; params: Params }) =>
    request<HistoryItem>('/tts/voice-design', json(body)),
  voiceClone: (body: { text: string; language: string; params: Params; voice_id?: string; ref_audio?: Blob; ref_text?: string; save_as?: string }) =>
    request<HistoryItem>('/tts/voice-clone', form({ ...body, params: JSON.stringify(body.params) })),
  history: () => request<HistoryItem[]>('/history'),
  deleteHistory: (id: string) => request(`/history/${id}`, { method: 'DELETE' }),
  historyAudio: (id: string) => `/api/history/${id}/audio`,
  voices: () => request<Voice[]>('/voices'),
  createVoice: (fields: { name: string; ref_text?: string; history_id?: string; ref_audio?: Blob }) =>
    request<Voice>('/voices', form(fields)),
  deleteVoice: (id: string) => request(`/voices/${id}`, { method: 'DELETE' }),
  voiceAudio: (id: string) => `/api/voices/${id}/audio`,
}
