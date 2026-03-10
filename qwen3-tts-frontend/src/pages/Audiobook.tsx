import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Book, Plus, Trash2, RefreshCw, Download, ChevronDown, ChevronUp, Play, Square, Pencil, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Navbar } from '@/components/Navbar'
import { AudioPlayer } from '@/components/AudioPlayer'
import { audiobookApi, type AudiobookProject, type AudiobookProjectDetail, type AudiobookCharacter, type AudiobookSegment } from '@/lib/api/audiobook'
import apiClient, { formatApiError } from '@/lib/api'

function LazyAudioPlayer({ audioUrl, jobId }: { audioUrl: string; jobId: number }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { rootMargin: '120px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref}>{visible && <AudioPlayer audioUrl={audioUrl} jobId={jobId} />}</div>
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待分析',
  analyzing: '分析中',
  characters_ready: '角色待确认',
  parsing: '解析章节',
  ready: '待生成',
  generating: '生成中',
  done: '已完成',
  error: '出错',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'secondary',
  analyzing: 'default',
  characters_ready: 'default',
  parsing: 'default',
  ready: 'default',
  generating: 'default',
  done: 'outline',
  error: 'destructive',
}

const STEP_HINTS: Record<string, string> = {
  pending: '第 1 步：点击「分析」，LLM 将自动提取角色列表',
  analyzing: '第 1 步：LLM 正在提取角色，请稍候...',
  characters_ready: '第 2 步：确认角色信息，可编辑后点击「确认角色 · 识别章节」',
  ready: '第 3 步：逐章解析剧本（LLM），解析完的章节可立即生成音频',
  generating: '第 4 步：正在合成音频，已完成片段可立即播放',
}

function SequentialPlayer({
  segments,
  projectId,
  onPlayingChange,
}: {
  segments: AudiobookSegment[]
  projectId: number
  onPlayingChange: (segmentId: number | null) => void
}) {
  const [displayIndex, setDisplayIndex] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(new Audio())
  const blobUrlsRef = useRef<Record<number, string>>({})
  const currentIndexRef = useRef<number | null>(null)
  const doneSegments = segments.filter(s => s.status === 'done')

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      audio.pause()
      audio.src = ''
      Object.values(blobUrlsRef.current).forEach(url => URL.revokeObjectURL(url))
    }
  }, [])

  const stop = useCallback(() => {
    audioRef.current.pause()
    audioRef.current.src = ''
    currentIndexRef.current = null
    setDisplayIndex(null)
    setIsLoading(false)
    onPlayingChange(null)
  }, [onPlayingChange])

  const playSegment = useCallback(async (index: number) => {
    if (index >= doneSegments.length) {
      currentIndexRef.current = null
      setDisplayIndex(null)
      onPlayingChange(null)
      return
    }
    const seg = doneSegments[index]
    currentIndexRef.current = index
    setDisplayIndex(index)
    onPlayingChange(seg.id)
    setIsLoading(true)

    try {
      if (!blobUrlsRef.current[seg.id]) {
        const response = await apiClient.get(
          audiobookApi.getSegmentAudioUrl(projectId, seg.id),
          { responseType: 'blob' }
        )
        blobUrlsRef.current[seg.id] = URL.createObjectURL(response.data)
      }
      const audio = audioRef.current
      audio.src = blobUrlsRef.current[seg.id]
      await audio.play()
    } catch {
      playSegment(index + 1)
    } finally {
      setIsLoading(false)
    }
  }, [doneSegments, projectId, onPlayingChange])

  useEffect(() => {
    const audio = audioRef.current
    const handleEnded = () => {
      if (currentIndexRef.current !== null) {
        playSegment(currentIndexRef.current + 1)
      }
    }
    audio.addEventListener('ended', handleEnded)
    return () => audio.removeEventListener('ended', handleEnded)
  }, [playSegment])

  if (doneSegments.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      {displayIndex !== null ? (
        <>
          <Button size="sm" variant="outline" onClick={stop}>
            <Square className="h-3 w-3 mr-1 fill-current" />停止
          </Button>
          <span className="text-xs text-muted-foreground">
            {isLoading ? '加载中...' : `第 ${displayIndex + 1} / ${doneSegments.length} 段`}
          </span>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={() => playSegment(0)}>
          <Play className="h-3 w-3 mr-1" />顺序播放（{doneSegments.length} 段）
        </Button>
      )}
    </div>
  )
}

function LogStream({ projectId, chapterId, active }: { projectId: number; chapterId?: number; active: boolean }) {
  const [lines, setLines] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    if (!active) return
    setLines([])
    setDone(false)

    const token = localStorage.getItem('token')
    const apiBase = (import.meta.env.VITE_API_URL as string) || ''
    const controller = new AbortController()

    const chapterParam = chapterId !== undefined ? `?chapter_id=${chapterId}` : ''
    fetch(`${apiBase}/audiobook/projects/${projectId}/logs${chapterParam}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    }).then(async res => {
      const reader = res.body?.getReader()
      if (!reader) return
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.done) {
              setDone(true)
            } else if (typeof msg.index === 'number') {
              setLines(prev => {
                const next = [...prev]
                next[msg.index] = msg.line
                return next
              })
            }
          } catch {}
        }
      }
    }).catch(() => {})

    return () => controller.abort()
  }, [projectId, chapterId, active])

  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  if (lines.length === 0) return null

  return (
    <div ref={containerRef} className="rounded border border-green-900/40 bg-black/90 text-green-400 font-mono text-xs p-3 max-h-52 overflow-y-auto leading-relaxed">
      {lines.map((line, i) => (
        <div key={i} className="whitespace-pre-wrap">{line}</div>
      ))}
      {!done && (
        <span className="inline-block w-2 h-3 bg-green-400 animate-pulse ml-0.5 align-middle" />
      )}
    </div>
  )
}

function LLMConfigPanel({ onSaved }: { onSaved?: () => void }) {
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [loading, setLoading] = useState(false)
  const [existing, setExisting] = useState<{ base_url?: string; model?: string; has_key: boolean } | null>(null)

  useEffect(() => {
    audiobookApi.getLLMConfig().then(setExisting).catch(() => {})
  }, [])

  const handleSave = async () => {
    if (!baseUrl || !apiKey || !model) {
      toast.error('请填写完整的 LLM 配置')
      return
    }
    setLoading(true)
    try {
      await audiobookApi.setLLMConfig({ base_url: baseUrl, api_key: apiKey, model })
      toast.success('LLM 配置已保存')
      setApiKey('')
      const updated = await audiobookApi.getLLMConfig()
      setExisting(updated)
      onSaved?.()
    } catch (e: any) {
      toast.error(formatApiError(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="font-medium text-sm">LLM 配置</div>
      {existing && (
        <div className="text-xs text-muted-foreground">
          当前: {existing.base_url || '未设置'} / {existing.model || '未设置'} / {existing.has_key ? '已配置密钥' : '未配置密钥'}
        </div>
      )}
      <Input placeholder="Base URL (e.g. https://api.openai.com/v1)" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
      <Input placeholder="API Key" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} />
      <Input placeholder="Model (e.g. gpt-4o)" value={model} onChange={e => setModel(e.target.value)} />
      <Button size="sm" onClick={handleSave} disabled={loading}>{loading ? '保存中...' : '保存配置'}</Button>
    </div>
  )
}

function CreateProjectPanel({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [sourceType, setSourceType] = useState<'text' | 'epub'>('text')
  const [text, setText] = useState('')
  const [epubFile, setEpubFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!title) { toast.error('请输入书名'); return }
    if (sourceType === 'text' && !text) { toast.error('请输入文本内容'); return }
    if (sourceType === 'epub' && !epubFile) { toast.error('请选择 epub 文件'); return }
    setLoading(true)
    try {
      if (sourceType === 'text') {
        await audiobookApi.createProject({ title, source_type: 'text', source_text: text })
      } else {
        await audiobookApi.uploadEpub(title, epubFile!)
      }
      toast.success('项目已创建')
      setTitle(''); setText(''); setEpubFile(null)
      onCreated()
    } catch (e: any) {
      toast.error(formatApiError(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="font-medium text-sm">新建有声书项目</div>
      <Input placeholder="书名" value={title} onChange={e => setTitle(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" variant={sourceType === 'text' ? 'default' : 'outline'} onClick={() => setSourceType('text')}>粘贴文本</Button>
        <Button size="sm" variant={sourceType === 'epub' ? 'default' : 'outline'} onClick={() => setSourceType('epub')}>上传 epub</Button>
      </div>
      {sourceType === 'text' && (
        <Textarea placeholder="粘贴小说文本..." rows={6} value={text} onChange={e => setText(e.target.value)} />
      )}
      {sourceType === 'epub' && (
        <Input type="file" accept=".epub" onChange={e => {
          const file = e.target.files?.[0] || null
          setEpubFile(file)
          if (file && !title) {
            setTitle(file.name.replace(/\.epub$/i, ''))
          }
        }} />
      )}
      <Button size="sm" onClick={handleCreate} disabled={loading}>{loading ? '创建中...' : '创建项目'}</Button>
    </div>
  )
}

function ProjectCard({ project, onRefresh }: { project: AudiobookProject; onRefresh: () => void }) {
  const [detail, setDetail] = useState<AudiobookProjectDetail | null>(null)
  const [segments, setSegments] = useState<AudiobookSegment[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loadingAction, setLoadingAction] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [editingCharId, setEditingCharId] = useState<number | null>(null)
  const [editFields, setEditFields] = useState({ name: '', description: '', instruct: '' })
  const [sequentialPlayingId, setSequentialPlayingId] = useState<number | null>(null)
  const [turbo, setTurbo] = useState(false)
  const [charsCollapsed, setCharsCollapsed] = useState(false)
  const [chaptersCollapsed, setChaptersCollapsed] = useState(false)
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set())
  const prevStatusRef = useRef(project.status)
  const autoExpandedRef = useRef(new Set<string>())

  const fetchDetail = useCallback(async () => {
    try { setDetail(await audiobookApi.getProject(project.id)) } catch {}
  }, [project.id])

  const fetchSegments = useCallback(async () => {
    try { setSegments(await audiobookApi.getSegments(project.id)) } catch {}
  }, [project.id])

  useEffect(() => {
    if (expanded) { fetchDetail(); fetchSegments() }
  }, [expanded, fetchDetail, fetchSegments])

  useEffect(() => {
    const s = project.status
    if (['characters_ready', 'ready', 'generating'].includes(s) && !autoExpandedRef.current.has(s)) {
      autoExpandedRef.current.add(s)
      setExpanded(true)
      fetchDetail()
      fetchSegments()
    }
    if (['done', 'error'].includes(s)) setIsPolling(false)
  }, [project.status, fetchDetail, fetchSegments])

  useEffect(() => {
    if (prevStatusRef.current === 'generating' && project.status === 'done') {
      toast.success(`「${project.title}」音频全部生成完成！`)
    }
    prevStatusRef.current = project.status
  }, [project.status, project.title])

  const hasParsingChapter = detail?.chapters.some(c => c.status === 'parsing') ?? false

  useEffect(() => {
    if (!isPolling) return
    if (['analyzing', 'generating'].includes(project.status)) return
    if (hasParsingChapter) return
    if (!segments.some(s => s.status === 'generating')) setIsPolling(false)
  }, [isPolling, project.status, segments, hasParsingChapter])

  useEffect(() => {
    const shouldPoll = isPolling || ['analyzing', 'generating'].includes(project.status) || hasParsingChapter
    if (!shouldPoll) return
    const id = setInterval(() => { onRefresh(); fetchSegments(); fetchDetail() }, 1500)
    return () => clearInterval(id)
  }, [isPolling, project.status, hasParsingChapter, onRefresh, fetchSegments, fetchDetail])

  useEffect(() => {
    if (!detail || segments.length === 0) return
    const generatingChapterIds = detail.chapters
      .filter(ch => segments.some(s => s.chapter_index === ch.chapter_index && s.status === 'generating'))
      .map(ch => ch.id)
    if (generatingChapterIds.length === 0) return
    setExpandedChapters(prev => {
      const next = new Set(prev)
      generatingChapterIds.forEach(id => next.add(id))
      return next.size === prev.size ? prev : next
    })
  }, [segments, detail])

  const handleAnalyze = async () => {
    const s = project.status
    if (['characters_ready', 'ready', 'done'].includes(s)) {
      if (!confirm('重新分析将清除所有角色和章节数据，确定继续？')) return
    }
    autoExpandedRef.current.clear()
    setEditingCharId(null)
    setLoadingAction(true)
    setIsPolling(true)
    try {
      await audiobookApi.analyze(project.id, { turbo })
      toast.success(turbo ? '分析已开始（极速模式）' : '分析已开始')
      onRefresh()
    } catch (e: any) {
      setIsPolling(false)
      toast.error(formatApiError(e))
    } finally {
      setLoadingAction(false)
    }
  }

  const handleConfirm = async () => {
    setLoadingAction(true)
    try {
      await audiobookApi.confirmCharacters(project.id)
      toast.success('章节已识别')
      onRefresh()
      fetchDetail()
    } catch (e: any) {
      toast.error(formatApiError(e))
    } finally {
      setLoadingAction(false)
    }
  }

  const handleParseChapter = async (chapterId: number, title?: string) => {
    try {
      await audiobookApi.parseChapter(project.id, chapterId)
      toast.success(title ? `「${title}」解析已开始` : '章节解析已开始')
      fetchDetail()
    } catch (e: any) {
      toast.error(formatApiError(e))
    }
  }

  const handleGenerate = async (chapterIndex?: number) => {
    setLoadingAction(true)
    setIsPolling(true)
    try {
      await audiobookApi.generate(project.id, chapterIndex)
      toast.success(chapterIndex !== undefined ? `第 ${chapterIndex + 1} 章生成已开始` : '全书生成已开始')
      onRefresh()
      fetchSegments()
    } catch (e: any) {
      setIsPolling(false)
      toast.error(formatApiError(e))
    } finally {
      setLoadingAction(false)
    }
  }

  const handleProcessAll = async () => {
    if (!detail) return
    setLoadingAction(true)
    setIsPolling(true)
    try {
      const pending = detail.chapters.filter(c => c.status === 'pending' || c.status === 'error')
      const ready = detail.chapters.filter(c => c.status === 'ready')
      await Promise.all([
        ...pending.map(c => audiobookApi.parseChapter(project.id, c.id)),
        ...ready.map(c => audiobookApi.generate(project.id, c.chapter_index)),
      ])
      toast.success('全部任务已触发')
      onRefresh()
      fetchDetail()
      fetchSegments()
    } catch (e: any) {
      setIsPolling(false)
      toast.error(formatApiError(e))
    } finally {
      setLoadingAction(false)
    }
  }

  const handleDownload = async (chapterIndex?: number) => {
    setLoadingAction(true)
    try {
      const response = await apiClient.get(`/audiobook/projects/${project.id}/download`, {
        responseType: 'blob',
        params: chapterIndex !== undefined ? { chapter: chapterIndex } : {},
      })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = chapterIndex !== undefined
        ? `${project.title}_ch${chapterIndex + 1}.mp3`
        : `${project.title}.mp3`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error(formatApiError(e))
    } finally {
      setLoadingAction(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`确认删除项目「${project.title}」及所有音频？`)) return
    try {
      await audiobookApi.deleteProject(project.id)
      toast.success('项目已删除')
      onRefresh()
    } catch (e: any) {
      toast.error(formatApiError(e))
    }
  }

  const startEditChar = (char: AudiobookCharacter) => {
    setEditingCharId(char.id)
    setEditFields({ name: char.name, description: char.description || '', instruct: char.instruct || '' })
  }

  const saveEditChar = async (char: AudiobookCharacter) => {
    try {
      await audiobookApi.updateCharacter(project.id, char.id, {
        name: editFields.name || char.name,
        description: editFields.description,
        instruct: editFields.instruct,
      })
      setEditingCharId(null)
      await fetchDetail()
      toast.success('角色已保存')
    } catch (e: any) {
      toast.error(formatApiError(e))
    }
  }

  const status = project.status
  const isActive = ['analyzing', 'generating'].includes(status)
  const doneCount = segments.filter(s => s.status === 'done').length
  const totalCount = segments.length
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <Book className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <span className="font-medium break-words">{project.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant={(STATUS_COLORS[status] || 'secondary') as any}>
            {STATUS_LABELS[status] || status}
          </Badge>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {STEP_HINTS[status] && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2 border-l-2 border-primary/40">
          {STEP_HINTS[status]}
        </div>
      )}

      {status === 'analyzing' && (
        <LogStream projectId={project.id} active={status === 'analyzing'} />
      )}

      {project.error_message && (
        <div className="text-xs text-destructive bg-destructive/10 rounded p-2">{project.error_message}</div>
      )}

      {totalCount > 0 && doneCount > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{doneCount} / {totalCount} 片段完成</div>
          <Progress value={progress} />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 border-t">
        <div className="flex items-center gap-1 flex-wrap">
          {!isActive && (
            <>
              <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={turbo}
                  onChange={e => setTurbo(e.target.checked)}
                />
                极速
              </label>
              <Button
                size="sm"
                variant={status === 'pending' ? 'default' : 'outline'}
                className="h-7 text-xs px-2"
                onClick={handleAnalyze}
                disabled={loadingAction}
              >
                {status === 'pending' ? '分析' : '重新分析'}
              </Button>
            </>
          )}
          {status === 'ready' && (
            <Button size="sm" className="h-7 text-xs px-2" onClick={() => handleGenerate()} disabled={loadingAction}>
              生成全书
            </Button>
          )}
          {status === 'done' && (
            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => handleDownload()} disabled={loadingAction}>
              <Download className="h-3 w-3 mr-1" />下载全书
            </Button>
          )}
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {expanded && (
        <div className="space-y-3 pt-2 border-t">
          {detail && detail.characters.length > 0 && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
              <button
                className="flex items-center gap-1 text-xs font-medium text-blue-400/80 mb-2 hover:text-blue-300 transition-colors w-full text-left"
                onClick={() => setCharsCollapsed(v => !v)}
              >
                {charsCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                角色列表（{detail.characters.length} 个）
              </button>
              {!charsCollapsed && <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {detail.characters.map(char => (
                  <div key={char.id} className="border rounded px-3 py-2">
                    {editingCharId === char.id ? (
                      <div className="space-y-2">
                        <Input
                          className="h-7 text-sm"
                          value={editFields.name}
                          onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))}
                          placeholder="角色名"
                        />
                        <Input
                          className="h-7 text-sm"
                          value={editFields.instruct}
                          onChange={e => setEditFields(f => ({ ...f, instruct: e.target.value }))}
                          placeholder="音色描述（用于 TTS）"
                        />
                        <Input
                          className="h-7 text-sm"
                          value={editFields.description}
                          onChange={e => setEditFields(f => ({ ...f, description: e.target.value }))}
                          placeholder="角色描述"
                        />
                        <div className="flex gap-1">
                          <Button size="sm" className="h-6 text-xs px-2" onClick={() => saveEditChar(char)}>
                            <Check className="h-3 w-3 mr-1" />保存
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingCharId(null)}>
                            <X className="h-3 w-3 mr-1" />取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-sm">
                        <span className="font-medium shrink-0 truncate">{char.name}</span>
                        <span className="text-xs text-muted-foreground truncate sm:mx-2 sm:flex-1">{char.instruct}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {char.voice_design_id
                            ? <Badge variant="outline" className="text-xs">音色 #{char.voice_design_id}</Badge>
                            : <Badge variant="secondary" className="text-xs">未分配</Badge>
                          }
                          {status === 'characters_ready' && (
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditChar(char)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>}
              {status === 'characters_ready' && (
                <Button
                  className="w-full mt-3"
                  onClick={handleConfirm}
                  disabled={loadingAction || editingCharId !== null}
                >
                  {loadingAction ? '识别中...' : '确认角色 · 识别章节'}
                </Button>
              )}
            </div>
          )}

          {detail && detail.chapters.length > 0 && ['ready', 'generating', 'done'].includes(status) && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-2">
                <button
                  className="flex items-center gap-1 text-xs font-medium text-emerald-400/80 hover:text-emerald-300 transition-colors text-left"
                  onClick={() => setChaptersCollapsed(v => !v)}
                >
                  {chaptersCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                  章节列表（共 {detail.chapters.length} 章）
                </button>
                {detail.chapters.some(c => ['pending', 'error', 'ready'].includes(c.status)) && (
                  <Button
                    size="sm"
                    className="h-6 text-xs px-2 self-start sm:self-auto"
                    disabled={loadingAction}
                    onClick={handleProcessAll}
                  >
                    {loadingAction ? <Loader2 className="h-3 w-3 animate-spin" /> : '一键全部处理'}
                  </Button>
                )}
              </div>
              {!chaptersCollapsed && <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {detail.chapters.map(ch => {
                  const chSegs = segments.filter(s => s.chapter_index === ch.chapter_index)
                  const chDone = chSegs.filter(s => s.status === 'done').length
                  const chTotal = chSegs.length
                  const chGenerating = chSegs.some(s => s.status === 'generating')
                  const chAllDone = chTotal > 0 && chDone === chTotal
                  const chTitle = ch.title || `第 ${ch.chapter_index + 1} 章`
                  const chExpanded = expandedChapters.has(ch.id)
                  const toggleChExpand = () => setExpandedChapters(prev => {
                    const next = new Set(prev)
                    if (next.has(ch.id)) next.delete(ch.id)
                    else next.add(ch.id)
                    return next
                  })
                  return (
                    <div key={ch.id} className="border rounded px-3 py-2 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-medium break-words flex-1">{chTitle}</span>
                        {chSegs.length > 0 && (
                          <button onClick={toggleChExpand} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
                            {chExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {ch.status === 'pending' && (
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => handleParseChapter(ch.id, ch.title)}>
                            解析此章
                          </Button>
                        )}
                        {ch.status === 'parsing' && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>解析中</span>
                          </div>
                        )}
                        {ch.status === 'ready' && !chGenerating && !chAllDone && (
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2" disabled={loadingAction} onClick={() => {
                            setExpandedChapters(prev => { const n = new Set(prev); n.add(ch.id); return n })
                            handleGenerate(ch.chapter_index)
                          }}>
                            生成此章
                          </Button>
                        )}
                        {ch.status === 'ready' && chGenerating && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>{chDone}/{chTotal} 段</span>
                          </div>
                        )}
                        {ch.status === 'ready' && chAllDone && (
                          <>
                            <Badge variant="outline" className="text-xs">已完成 {chDone} 段</Badge>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDownload(ch.chapter_index)} title="下载此章">
                              <Download className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {ch.status === 'error' && (
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-destructive border-destructive/40" onClick={() => handleParseChapter(ch.id, ch.title)}>
                            重新解析
                          </Button>
                        )}
                      </div>
                      {ch.status === 'parsing' && (
                        <LogStream projectId={project.id} chapterId={ch.id} active={ch.status === 'parsing'} />
                      )}
                      {chExpanded && chSegs.length > 0 && (
                        <div className="pt-2 border-t divide-y divide-border/50">
                          {chSegs.map(seg => (
                            <div key={seg.id} className={`py-2 space-y-1.5 ${sequentialPlayingId === seg.id ? 'bg-primary/5 px-1 rounded' : ''}`}>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs shrink-0">{seg.character_name || '?'}</Badge>
                                {seg.status === 'generating' && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                {seg.status === 'error' && <Badge variant="destructive" className="text-xs">出错</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground break-words leading-relaxed">{seg.text}</p>
                              {seg.status === 'done' && (
                                <LazyAudioPlayer audioUrl={audiobookApi.getSegmentAudioUrl(project.id, seg.id)} jobId={seg.id} />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>}
              {!chaptersCollapsed && doneCount > 0 && (
                <div className="mt-2">
                  <SequentialPlayer segments={segments} projectId={project.id} onPlayingChange={setSequentialPlayingId} />
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

export default function Audiobook() {
  const [projects, setProjects] = useState<AudiobookProject[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showLLM, setShowLLM] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchProjects = useCallback(async () => {
    try {
      const list = await audiobookApi.listProjects()
      setProjects(list)
    } catch (e: any) {
      toast.error(formatApiError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-bold">有声书生成</h1>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setShowLLM(!showLLM)}>LLM 配置</Button>
            <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
              <Plus className="h-4 w-4 mr-1" />新建项目
            </Button>
            <Button size="icon" variant="ghost" onClick={fetchProjects}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showLLM && <LLMConfigPanel onSaved={() => setShowLLM(false)} />}
        {showCreate && <CreateProjectPanel onCreated={() => { setShowCreate(false); fetchProjects() }} />}

        {loading ? (
          <div className="text-center text-muted-foreground py-12">加载中...</div>
        ) : projects.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <Book className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>暂无有声书项目</p>
            <p className="text-sm mt-1">点击「新建项目」开始创建</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map(p => (
              <ProjectCard key={p.id} project={p} onRefresh={fetchProjects} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
