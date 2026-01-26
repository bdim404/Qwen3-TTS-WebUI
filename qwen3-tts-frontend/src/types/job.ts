export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type JobType = 'custom_voice' | 'voice_design' | 'voice_clone'

export interface Job {
  id: number
  type: JobType
  status: JobStatus
  created_at: string
  updated_at: string
  error_message?: string
  audio_url?: string
  download_url?: string
  parameters: Record<string, any>
}

export interface JobCreateResponse {
  job_id: number
  status: string
  message: string
}

export interface JobListResponse {
  jobs: Job[]
  total: number
}

export interface JobState {
  currentJob: Job | null
  status: JobStatus | null
  error: string | null
  elapsedTime: number
}
