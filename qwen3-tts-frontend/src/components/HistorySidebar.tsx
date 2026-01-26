import { useRef, useEffect } from 'react'
import { useHistoryContext } from '@/contexts/HistoryContext'
import { HistoryItem } from '@/components/HistoryItem'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Loader2, FileAudio, RefreshCw } from 'lucide-react'
import type { JobType } from '@/types/job'
import { toast } from 'sonner'

interface HistorySidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoadParams: (jobId: number, jobType: JobType) => Promise<void>
}

function HistorySidebarContent({ onLoadParams }: Pick<HistorySidebarProps, 'onLoadParams'>) {
  const { jobs, loading, loadingMore, hasMore, loadMore, deleteJob, error, retry } = useHistoryContext()
  const observerTarget = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore()
        }
      },
      { threshold: 0.5 }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadMore])

  const handleLoadParams = async (jobId: number, jobType: JobType) => {
    try {
      await onLoadParams(jobId, jobType)
    } catch (error) {
      toast.error('加载参数失败')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">历史记录</h2>
        <p className="text-sm text-muted-foreground">共 {jobs.length} 条记录</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <p className="text-sm text-destructive text-center">{error}</p>
              <Button onClick={retry} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                重试
              </Button>
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <FileAudio className="w-12 h-12 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">暂无历史记录</p>
              <p className="text-xs text-muted-foreground text-center">
                生成语音后，记录将会显示在这里
              </p>
            </div>
          ) : (
            <>
              {jobs.map((job) => (
                <HistoryItem
                  key={job.id}
                  job={job}
                  onDelete={deleteJob}
                  onLoadParams={(job) => handleLoadParams(job.id, job.type)}
                />
              ))}

              {hasMore && (
                <div ref={observerTarget} className="py-4 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export function HistorySidebar({ open, onOpenChange, onLoadParams }: HistorySidebarProps) {
  return (
    <>
      <aside className="hidden lg:block w-[320px] border-r h-full">
        <HistorySidebarContent onLoadParams={onLoadParams} />
      </aside>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-full sm:max-w-md p-0">
          <HistorySidebarContent onLoadParams={onLoadParams} />
        </SheetContent>
      </Sheet>
    </>
  )
}
