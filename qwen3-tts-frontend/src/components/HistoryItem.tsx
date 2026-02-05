import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Job } from '@/types/job'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2, AlertCircle, Loader2, Clock, Eye } from 'lucide-react'
import { getRelativeTime, cn } from '@/lib/utils'
import { JobDetailDialog } from '@/components/JobDetailDialog'

interface HistoryItemProps {
  job: Job
  onDelete: (id: number) => void
}

const jobTypeBadgeVariant = {
  custom_voice: 'default' as const,
  voice_design: 'secondary' as const,
  voice_clone: 'outline' as const,
}

const HistoryItem = memo(({ job, onDelete }: HistoryItemProps) => {
  const { t } = useTranslation('job')
  const { t: tCommon } = useTranslation('common')
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  const jobTypeLabel = {
    custom_voice: t('typeCustomVoice'),
    voice_design: t('typeVoiceDesign'),
    voice_clone: t('typeVoiceClone'),
  }

  const getLanguageDisplay = (lang: string | undefined) => {
    if (!lang || lang === 'Auto') return t('autoDetect')
    return lang
  }

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    setDetailDialogOpen(true)
  }

  return (
    <div
      className={cn(
        "relative border rounded-lg p-4 pb-14 space-y-3 hover:bg-accent/50 transition-colors cursor-pointer",
        job.status === 'failed' && "border-destructive/50"
      )}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-2">
        <Badge variant={jobTypeBadgeVariant[job.type]}>
          {jobTypeLabel[job.type]}
        </Badge>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
          <span>{getRelativeTime(job.created_at)}</span>
          <Eye className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="space-y-2 text-sm">
        {job.parameters?.text && (
          <div>
            <span className="text-muted-foreground">{t('synthesisText')}: </span>
            <span className="line-clamp-2">{job.parameters.text}</span>
          </div>
        )}

        <div className="text-muted-foreground">
          {t('language')}{getLanguageDisplay(job.parameters?.language)}
        </div>

        {job.type === 'custom_voice' && job.parameters?.speaker && (
          <div className="text-muted-foreground">
            {t('speaker')}{job.parameters.speaker}
          </div>
        )}

        {job.type === 'voice_design' && job.parameters?.instruct && (
          <div>
            <span className="text-muted-foreground">{t('voiceDescription')}: </span>
            <span className="text-xs line-clamp-2">{job.parameters.instruct}</span>
          </div>
        )}

        {job.type === 'voice_clone' && job.parameters?.ref_text && (
          <div>
            <span className="text-muted-foreground">{t('referenceText')}: </span>
            <span className="text-xs line-clamp-1">{job.parameters.ref_text}</span>
          </div>
        )}
      </div>

      {job.status === 'processing' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t('statusProcessing')}</span>
        </div>
      )}

      {job.status === 'pending' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{t('statusPending')}</span>
        </div>
      )}

      {job.status === 'failed' && job.error_message && (
        <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-md">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <span className="text-sm text-destructive">{job.error_message}</span>
        </div>
      )}

      <div className="absolute bottom-3 right-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-[44px] md:min-h-[36px] text-muted-foreground hover:[&_svg]:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('deleteJob')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('deleteJobConfirm')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(job.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {tCommon('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <JobDetailDialog
        job={job}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.job.id === nextProps.job.id &&
    prevProps.job.status === nextProps.job.status &&
    prevProps.job.updated_at === nextProps.job.updated_at &&
    prevProps.job.error_message === nextProps.job.error_message
  )
})

HistoryItem.displayName = 'HistoryItem'

export { HistoryItem }
