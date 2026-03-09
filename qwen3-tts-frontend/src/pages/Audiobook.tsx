import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Book, Plus, Trash2, RefreshCw, Download, ChevronDown, ChevronUp, Play, Square, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Navbar } from '@/components/Navbar'
import { AudioPlayer } from '@/components/AudioPlayer'
import { audiobookApi, type AudiobookProject, type AudiobookProjectDetail, type AudiobookCharacter, type AudiobookSegment } from '@/lib/api/audiobook'
import apiClient, { formatApiError } from '@/lib/api'

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
  characters_ready: '第 2 步：确认角色信息，可编辑后点击「确认角色 · 解析章节」',
  parsing: '第 3 步：LLM 正在解析章节脚本，请稍候...',
  ready: '第 4 步：按章节逐章生成音频，或一次性生成全书',
  generating: '第 5 步：正在合成音频，已完成片段可立即播放',
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
        <Input type="file" accept=".epub" onChange={e => setEpubFile(e.target.files?.[0] || null)} />
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

  useEffect(() => {
    if (!isPolling) return
    if (['analyzing', 'parsing', 'generating'].includes(project.status)) return
    if (!segments.some(s => s.status === 'generating')) setIsPolling(false)
  }, [isPolling, project.status, segments])

  useEffect(() => {
    const shouldPoll = isPolling || ['analyzing', 'parsing', 'generating'].includes(project.status)
    if (!shouldPoll) return
    const id = setInterval(() => { onRefresh(); fetchSegments() }, 1500)
    return () => clearInterval(id)
  }, [isPolling, project.status, onRefresh, fetchSegments])

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
      await audiobookApi.analyze(project.id)
      toast.success('分析已开始')
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
    setIsPolling(true)
    try {
      await audiobookApi.confirmCharacters(project.id)
      toast.success('章节解析已开始')
      onRefresh()
    } catch (e: any) {
      setIsPolling(false)
      toast.error(formatApiError(e))
    } finally {
      setLoadingAction(false)
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
  const isActive = ['analyzing', 'parsing', 'generating'].includes(status)
  const doneCount = segments.filter(s => s.status === 'done').length
  const totalCount = segments.length
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const chapterMap = new Map<number, AudiobookSegment[]>()
  segments.forEach(s => {
    const arr = chapterMap.get(s.chapter_index) ?? []
    arr.push(s)
    chapterMap.set(s.chapter_index, arr)
  })
  const chapters = Array.from(chapterMap.entries()).sort(([a], [b]) => a - b)

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Book className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-medium truncate">{project.title}</span>
          <Badge variant={(STATUS_COLORS[status] || 'secondary') as any} className="shrink-0">
            {STATUS_LABELS[status] || status}
          </Badge>
        </div>
        <div className="flex gap-1 shrink-0">
          {!isActive && (
            <Button
              size="sm"
              variant={status === 'pending' ? 'default' : 'outline'}
              onClick={handleAnalyze}
              disabled={loadingAction}
            >
              {status === 'pending' ? '分析' : '重新分析'}
            </Button>
          )}
          {status === 'ready' && (
            <Button size="sm" onClick={() => handleGenerate()} disabled={loadingAction}>
              生成全书
            </Button>
          )}
          {status === 'done' && (
            <Button size="sm" variant="outline" onClick={() => handleDownload()} disabled={loadingAction}>
              <Download className="h-3 w-3 mr-1" />下载全书
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {STEP_HINTS[status] && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2 border-l-2 border-primary/40">
          {STEP_HINTS[status]}
        </div>
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

      {expanded && (
        <div className="space-y-4 pt-2 border-t">
          {detail && detail.characters.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                角色列表（{detail.characters.length} 个）
              </div>
              <div className="space-y-1.5">
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
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium shrink-0 w-20 truncate">{char.name}</span>
                        <span className="text-xs text-muted-foreground truncate mx-2 flex-1">{char.instruct}</span>
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
              </div>
              {status === 'characters_ready' && (
                <Button
                  className="w-full mt-3"
                  onClick={handleConfirm}
                  disabled={loadingAction || editingCharId !== null}
                >
                  {loadingAction ? '解析中...' : '确认角色 · 解析章节'}
                </Button>
              )}
            </div>
          )}

          {status === 'ready' && chapters.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                按章节生成（共 {chapters.length} 章）
              </div>
              <div className="space-y-1">
                {chapters.map(([chIdx, chSegs]) => {
                  const chDone = chSegs.filter(s => s.status === 'done').length
                  const chTotal = chSegs.length
                  const chGenerating = chSegs.some(s => s.status === 'generating')
                  const chAllDone = chDone === chTotal && chTotal > 0
                  return (
                    <div key={chIdx} className="flex items-center justify-between border rounded px-2 py-1.5 text-sm">
                      <span className="text-xs text-muted-foreground shrink-0">第 {chIdx + 1} 章</span>
                      <span className="text-xs text-muted-foreground mx-2 flex-1">{chDone}/{chTotal} 段</span>
                      <div className="flex gap-1 shrink-0">
                        {chGenerating ? (
                          <Badge variant="secondary" className="text-xs">生成中...</Badge>
                        ) : chAllDone ? (
                          <>
                            <Badge variant="outline" className="text-xs">已完成</Badge>
                            <Button
                              size="sm" variant="ghost" className="h-5 w-5 p-0"
                              onClick={() => handleDownload(chIdx)}
                              title="下载此章"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm" variant="outline" className="h-6 text-xs px-2"
                            disabled={loadingAction}
                            onClick={() => handleGenerate(chIdx)}
                          >
                            生成此章
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {doneCount > 0 && (
                <div className="mt-2">
                  <SequentialPlayer segments={segments} projectId={project.id} onPlayingChange={setSequentialPlayingId} />
                </div>
              )}
            </div>
          )}

          {['generating', 'done'].includes(status) && segments.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-muted-foreground">
                  片段列表（{segments.length} 条）
                </div>
                <SequentialPlayer segments={segments} projectId={project.id} onPlayingChange={setSequentialPlayingId} />
              </div>
              <div className="space-y-2">
                {segments.slice(0, 50).map(seg => (
                  <div
                    key={seg.id}
                    className={`border rounded px-2 py-2 space-y-2 transition-colors ${sequentialPlayingId === seg.id ? 'border-primary/50 bg-primary/5' : ''}`}
                  >
                    <div className="flex items-start gap-2 text-xs">
                      <Badge variant="outline" className="shrink-0 text-xs mt-0.5">{seg.character_name || '?'}</Badge>
                      <span className="text-muted-foreground flex-1 min-w-0 break-words leading-relaxed">{seg.text}</span>
                      {seg.status !== 'done' && (
                        <Badge
                          variant={seg.status === 'error' ? 'destructive' : 'secondary'}
                          className="shrink-0 text-xs mt-0.5"
                        >
                          {seg.status === 'generating' ? '生成中' : seg.status === 'error' ? '出错' : '待生成'}
                        </Badge>
                      )}
                    </div>
                    {seg.status === 'done' && (
                      <AudioPlayer
                        audioUrl={audiobookApi.getSegmentAudioUrl(project.id, seg.id)}
                        jobId={seg.id}
                      />
                    )}
                  </div>
                ))}
                {segments.length > 50 && (
                  <div className="text-xs text-muted-foreground text-center py-1">
                    仅显示前 50 条，共 {segments.length} 条
                  </div>
                )}
              </div>
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">有声书生成</h1>
          <div className="flex gap-2">
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
