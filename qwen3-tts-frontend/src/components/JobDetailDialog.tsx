import { memo } from 'react'
import { useTranslation } from 'react-i18next'
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

const formatTimestamp = (timestamp: string, locale: string) => {
  return new Date(timestamp).toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const JobDetailDialog = memo(({ job, open, onOpenChange }: JobDetailDialogProps) => {
  const { t, i18n } = useTranslation(['job', 'common'])

  if (!job) return null

  const jobTypeLabel = {
    custom_voice: t('job:typeCustomVoice'),
    voice_design: t('job:typeVoiceDesign'),
    voice_clone: t('job:typeVoiceClone'),
  }

  const getLanguageDisplay = (lang: string | undefined) => {
    if (!lang || lang === 'Auto') return t('job:autoDetect')
    return lang
  }

  const formatBooleanDisplay = (value: boolean | undefined) => {
    return value ? t('common:yes') : t('common:no')
  }

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
              {formatTimestamp(job.created_at, i18n.language)}
            </span>
          </div>
          <DialogDescription>{t('job:detailsDescription')}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">{t('job:basicInfo')}</h3>
              <div className="space-y-1.5 text-sm bg-muted/30 p-3 rounded-lg">
                {job.type === 'custom_voice' && job.parameters?.speaker && (
                  <div>
                    <span className="text-muted-foreground">{t('job:speaker')}</span>
                    <span>{job.parameters.speaker}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">{t('job:language')}</span>
                  <span>{getLanguageDisplay(job.parameters?.language)}</span>
                </div>
                {job.type === 'voice_clone' && (
                  <>
                    <div>
                      <span className="text-muted-foreground">{t('job:fastMode')}</span>
                      <span>{formatBooleanDisplay(job.parameters?.x_vector_only_mode)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('job:useCache')}</span>
                      <span>{formatBooleanDisplay(job.parameters?.use_cache)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">{t('job:synthesisText')}</h3>
              <div className="text-sm bg-muted/30 p-3 rounded-lg border">
                {job.parameters?.text || <span className="text-muted-foreground">{t('job:notSet')}</span>}
              </div>
            </div>

            {job.type === 'voice_design' && job.parameters?.instruct && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">{t('job:voiceDescription')}</h3>
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
                  <h3 className="font-semibold text-sm">{t('job:emotionGuidance')}</h3>
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
                  <h3 className="font-semibold text-sm">{t('job:referenceText')}</h3>
                  <div className="text-sm bg-muted/30 p-3 rounded-lg border">
                    {job.parameters?.ref_text || <span className="text-muted-foreground">{t('job:notProvided')}</span>}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold hover:text-foreground transition-colors w-full">
                {t('job:advancedParameters')}
                <ChevronDown className="w-4 h-4 transition-transform ui-expanded:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="space-y-1.5 text-sm bg-muted/30 p-3 rounded-lg border">
                  {job.parameters?.max_new_tokens !== undefined && (
                    <div>
                      <span className="text-muted-foreground">{t('job:maxNewTokens')}</span>
                      <span>{job.parameters.max_new_tokens}</span>
                    </div>
                  )}
                  {job.parameters?.temperature !== undefined && (
                    <div>
                      <span className="text-muted-foreground">{t('job:temperature')}</span>
                      <span>{job.parameters.temperature}</span>
                    </div>
                  )}
                  {job.parameters?.top_k !== undefined && (
                    <div>
                      <span className="text-muted-foreground">{t('job:topK')}</span>
                      <span>{job.parameters.top_k}</span>
                    </div>
                  )}
                  {job.parameters?.top_p !== undefined && (
                    <div>
                      <span className="text-muted-foreground">{t('job:topP')}</span>
                      <span>{job.parameters.top_p}</span>
                    </div>
                  )}
                  {job.parameters?.repetition_penalty !== undefined && (
                    <div>
                      <span className="text-muted-foreground">{t('job:repetitionPenalty')}</span>
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
                    <h3 className="font-semibold text-sm text-destructive mb-1">{t('job:errorMessage')}</h3>
                    <p className="text-sm text-destructive">{job.error_message}</p>
                  </div>
                </div>
              </>
            )}

            {canPlay && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">{t('job:audioPlayback')}</h3>
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
