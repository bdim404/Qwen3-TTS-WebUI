import { memo } from 'react'
import type { Job } from '@/types/job'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AudioPlayer } from '@/components/AudioPlayer'
import { ChevronDown, AlertCircle } from 'lucide-react'
import { jobApi } from '@/lib/api'

interface JobDetailDialogProps {
  job: Job | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const jobTypeBadgeVariant = {
  custom_voice: 'default' as const,
  voice_design: 'secondary' as const,
  voice_clone: 'outline' as const,
}

const jobTypeLabel = {
  custom_voice: '自定义音色',
  voice_design: '音色设计',
  voice_clone: '声音克隆',
}

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getLanguageDisplay = (lang: string | undefined) => {
  if (!lang || lang === 'Auto') return '自动检测'
  return lang
}

const formatBooleanDisplay = (value: boolean | undefined) => {
  return value ? '是' : '否'
}

const JobDetailDialog = memo(({ job, open, onOpenChange }: JobDetailDialogProps) => {
  if (!job) return null

  const canPlay = job.status === 'completed'
  const audioUrl = canPlay ? jobApi.getAudioUrl(job.id, job.audio_url) : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] bg-background">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2">
              <Badge variant={jobTypeBadgeVariant[job.type]}>
                {jobTypeLabel[job.type]}
              </Badge>
              <span className="text-sm text-muted-foreground">#{job.id}</span>
            </DialogTitle>
            <span className="text-sm text-muted-foreground">
              {formatTimestamp(job.created_at)}
            </span>
          </div>
          <DialogDescription>查看任务的详细参数和生成结果</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">基本信息</h3>
              <div className="space-y-1.5 text-sm bg-muted/30 p-3 rounded-lg">
                {job.type === 'custom_voice' && job.parameters?.speaker && (
                  <div>
                    <span className="text-muted-foreground">发音人: </span>
                    <span>{job.parameters.speaker}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">语言: </span>
                  <span>{getLanguageDisplay(job.parameters?.language)}</span>
                </div>
                {job.type === 'voice_clone' && (
                  <>
                    <div>
                      <span className="text-muted-foreground">快速模式: </span>
                      <span>{formatBooleanDisplay(job.parameters?.x_vector_only_mode)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">使用缓存: </span>
                      <span>{formatBooleanDisplay(job.parameters?.use_cache)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">合成文本</h3>
              <div className="text-sm bg-muted/30 p-3 rounded-lg border">
                {job.parameters?.text || <span className="text-muted-foreground">未设置</span>}
              </div>
            </div>

            {job.type === 'voice_design' && job.parameters?.instruct && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">音色描述</h3>
                  <div className="text-sm bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    {job.parameters.instruct}
                  </div>
                </div>
              </>
            )}

            {job.type === 'custom_voice' && job.parameters?.instruct && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">情绪指导</h3>
                  <div className="text-sm bg-muted/30 p-3 rounded-lg border">
                    {job.parameters.instruct}
                  </div>
                </div>
              </>
            )}

            {job.type === 'voice_clone' && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">参考文本</h3>
                  <div className="text-sm bg-muted/30 p-3 rounded-lg border">
                    {job.parameters?.ref_text || <span className="text-muted-foreground">未提供</span>}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold hover:text-foreground transition-colors w-full">
                高级参数
                <ChevronDown className="w-4 h-4 transition-transform ui-expanded:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="space-y-1.5 text-sm bg-muted/30 p-3 rounded-lg border">
                  {job.parameters?.max_new_tokens !== undefined && (
                    <div>
                      <span className="text-muted-foreground">最大生成长度: </span>
                      <span>{job.parameters.max_new_tokens}</span>
                    </div>
                  )}
                  {job.parameters?.temperature !== undefined && (
                    <div>
                      <span className="text-muted-foreground">温度: </span>
                      <span>{job.parameters.temperature}</span>
                    </div>
                  )}
                  {job.parameters?.top_k !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Top K: </span>
                      <span>{job.parameters.top_k}</span>
                    </div>
                  )}
                  {job.parameters?.top_p !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Top P: </span>
                      <span>{job.parameters.top_p}</span>
                    </div>
                  )}
                  {job.parameters?.repetition_penalty !== undefined && (
                    <div>
                      <span className="text-muted-foreground">重复惩罚: </span>
                      <span>{job.parameters.repetition_penalty}</span>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {job.status === 'failed' && job.error_message && (
              <>
                <Separator />
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-semibold text-sm text-destructive mb-1">错误信息</h3>
                    <p className="text-sm text-destructive">{job.error_message}</p>
                  </div>
                </div>
              </>
            )}

            {canPlay && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">音频播放</h3>
                  <AudioPlayer audioUrl={audioUrl} jobId={job.id} />
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
})

JobDetailDialog.displayName = 'JobDetailDialog'

export { JobDetailDialog }
