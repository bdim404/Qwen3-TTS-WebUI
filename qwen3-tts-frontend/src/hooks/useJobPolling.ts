import { useJob } from '@/contexts/JobContext'

export function useJobPolling() {
  const { currentJob, status, error, elapsedTime, startJob, stopJob, resetJob, loadCompletedJob } = useJob()

  return {
    currentJob,
    status,
    error,
    elapsedTime,
    isPolling: status === 'processing' || status === 'pending',
    isCompleted: status === 'completed',
    isFailed: status === 'failed',
    startPolling: startJob,
    stopPolling: stopJob,
    resetError: resetJob,
    loadCompletedJob,
  }
}
