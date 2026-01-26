import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { jobApi } from '@/lib/api'
import type { Job } from '@/types/job'
import { toast } from 'sonner'

interface HistoryContextType {
  jobs: Job[]
  total: number
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  retry: () => Promise<void>
  deleteJob: (id: number) => Promise<void>
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined)

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [skip, setSkip] = useState(0)
  const limit = 20

  const hasMore = jobs.length < total

  const loadJobs = useCallback(async (currentSkip: number, isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const response = await jobApi.listJobs(currentSkip, limit)

      if (isLoadMore) {
        setJobs(prev => [...prev, ...response.jobs])
      } else {
        setJobs(response.jobs)
      }
      setTotal(response.total)
    } catch (error: any) {
      const errorMessage = error.message || '加载历史记录失败'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    const newSkip = skip + limit
    setSkip(newSkip)
    await loadJobs(newSkip, true)
  }, [skip, loadingMore, hasMore, loadJobs])

  const refresh = useCallback(async () => {
    setSkip(0)
    await loadJobs(0, false)
  }, [loadJobs])

  const retry = useCallback(async () => {
    setSkip(0)
    await loadJobs(0, false)
  }, [loadJobs])

  const deleteJob = useCallback(async (id: number) => {
    const previousJobs = [...jobs]
    const previousTotal = total

    setJobs(prev => prev.filter(job => job.id !== id))
    setTotal(prev => prev - 1)

    try {
      await jobApi.deleteJob(id)
      toast.success('删除成功')
    } catch (error) {
      setJobs(previousJobs)
      setTotal(previousTotal)
      toast.error('删除失败')
    }
  }, [jobs, total])

  useEffect(() => {
    loadJobs(0, false)
  }, [loadJobs])

  const value = useMemo(
    () => ({
      jobs,
      total,
      loading,
      loadingMore,
      hasMore,
      error,
      loadMore,
      refresh,
      retry,
      deleteJob,
    }),
    [jobs, total, loading, loadingMore, hasMore, error, loadMore, refresh, retry, deleteJob]
  )

  return (
    <HistoryContext.Provider value={value}>
      {children}
    </HistoryContext.Provider>
  )
}

export function useHistoryContext() {
  const context = useContext(HistoryContext)
  if (!context) {
    throw new Error('useHistoryContext must be used within HistoryProvider')
  }
  return context
}
