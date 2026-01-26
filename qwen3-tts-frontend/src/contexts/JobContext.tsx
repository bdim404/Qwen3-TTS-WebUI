import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import { toast } from 'sonner'
import { jobApi } from '@/lib/api'
import type { Job, JobStatus } from '@/types/job'
import { POLL_INTERVAL } from '@/lib/constants'

interface JobContextType {
  currentJob: Job | null
  status: JobStatus | null
  error: string | null
  elapsedTime: number
  startJob: (jobId: number) => void
  stopJob: () => void
  resetJob: () => void
  loadCompletedJob: (job: Job) => void
}

const JobContext = createContext<JobContextType | undefined>(undefined)

export function JobProvider({ children }: { children: ReactNode }) {
  const [currentJob, setCurrentJob] = useState<Job | null>(null)
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  const stopJob = useCallback(() => {
    setCurrentJob(null)
    setStatus(null)
    setError(null)
    setElapsedTime(0)
  }, [])

  const resetJob = useCallback(() => {
    setError(null)
  }, [])

  const loadCompletedJob = useCallback((job: Job) => {
    setCurrentJob(job)
    setStatus(job.status)
    setError(job.error_message || null)
    setElapsedTime(0)
  }, [])

  const startJob = useCallback((jobId: number) => {
    // Reset state for new job
    setCurrentJob(null)
    setStatus('pending')
    setError(null)
    setElapsedTime(0)

    let pollInterval: ReturnType<typeof setInterval> | null = null
    let timeInterval: ReturnType<typeof setInterval> | null = null

    const poll = async () => {
      try {
        const job = await jobApi.getJob(jobId)
        setCurrentJob(job)
        setStatus(job.status)

        if (job.status === 'completed') {
          if (pollInterval) clearInterval(pollInterval)
          if (timeInterval) clearInterval(timeInterval)
          toast.success('任务完成！')
        } else if (job.status === 'failed') {
          if (pollInterval) clearInterval(pollInterval)
          if (timeInterval) clearInterval(timeInterval)
          setError(job.error_message || '任务失败')
          toast.error(job.error_message || '任务失败')
        }
      } catch (error: any) {
        if (pollInterval) clearInterval(pollInterval)
        if (timeInterval) clearInterval(timeInterval)
        const message = error.response?.data?.detail || '获取任务状态失败'
        setError(message)
        toast.error(message)
      }
    }

    poll()
    pollInterval = setInterval(poll, POLL_INTERVAL)
    timeInterval = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)

    return () => {
      if (pollInterval) clearInterval(pollInterval)
      if (timeInterval) clearInterval(timeInterval)
    }
  }, [])

  const value = useMemo(
    () => ({
      currentJob,
      status,
      error,
      elapsedTime,
      startJob,
      stopJob,
      resetJob,
      loadCompletedJob,
    }),
    [currentJob, status, error, elapsedTime, startJob, stopJob, resetJob, loadCompletedJob]
  )

  return (
    <JobContext.Provider value={value}>
      {children}
    </JobContext.Provider>
  )
}

export function useJob() {
  const context = useContext(JobContext)
  if (!context) {
    throw new Error('useJob must be used within JobProvider')
  }
  return context
}
