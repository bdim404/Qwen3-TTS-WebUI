import axios from 'axios'
import type { LoginRequest, LoginResponse, User, PasswordChangeRequest, UserPreferences, SystemSettings } from '@/types/auth'
import type { Job, JobCreateResponse, JobListResponse, JobType } from '@/types/job'
import type { Language, Speaker, CustomVoiceForm, VoiceDesignForm, VoiceCloneForm } from '@/types/tts'
import type { UserCreateRequest, UserUpdateRequest, UserListResponse } from '@/types/user'
import { API_ENDPOINTS, LANGUAGE_NAMES, SPEAKER_DESCRIPTIONS_ZH } from '@/lib/constants'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

interface ValidationError {
  type: string
  loc: string[]
  msg: string
  input?: any
  ctx?: any
}

const FIELD_NAMES: Record<string, string> = {
  username: '用户名',
  email: '邮箱',
  password: '密码',
  current_password: '当前密码',
  new_password: '新密码',
  confirm_password: '确认密码',
  is_active: '激活状态',
  is_superuser: '超级管理员',
}

const formatValidationErrors = (errors: ValidationError[]): string => {
  return errors.map((error) => {
    const fieldPath = error.loc.slice(1)
    const fieldName = fieldPath[fieldPath.length - 1]
    const translatedField = FIELD_NAMES[fieldName] || fieldName

    switch (error.type) {
      case 'string_pattern_mismatch':
        if (fieldName === 'username') {
          return `${translatedField}只能包含字母、数字、下划线和连字符`
        }
        return `${translatedField}格式不正确`

      case 'string_too_short':
        return `${translatedField}长度不能少于${error.ctx?.min_length || '指定'}个字符`

      case 'string_too_long':
        return `${translatedField}长度不能超过${error.ctx?.max_length || '指定'}个字符`

      case 'value_error':
        if (error.msg.includes('uppercase')) {
          return `${translatedField}必须包含至少一个大写字母`
        }
        if (error.msg.includes('lowercase')) {
          return `${translatedField}必须包含至少一个小写字母`
        }
        if (error.msg.includes('digit')) {
          return `${translatedField}必须包含至少一个数字`
        }
        if (error.msg.includes('alphanumeric')) {
          return `${translatedField}只能包含字母、数字、下划线和连字符`
        }
        return `${translatedField}: ${error.msg}`

      case 'missing':
        return `${translatedField}为必填项`

      case 'value_error.email':
        return `${translatedField}格式不正确`

      default:
        return `${translatedField}: ${error.msg}`
    }
  }).join('; ')
}

export const formatApiError = (error: any): string => {
  if (!error.response) {
    if (error.message === 'Network Error' || !navigator.onLine) {
      return '网络连接失败，请检查您的网络连接'
    }
    return error.message || '请求失败，请稍后重试'
  }

  const status = error.response.status
  const data = error.response.data

  switch (status) {
    case 400:
      if (data?.detail) {
        if (typeof data.detail === 'string') {
          return data.detail
        }
        if (Array.isArray(data.detail)) {
          return data.detail.map((err: any) => err.msg || err.message).join('; ')
        }
      }
      return '请求参数错误，请检查输入'

    case 422:
      if (data?.detail && Array.isArray(data.detail)) {
        return formatValidationErrors(data.detail)
      }
      return '输入验证失败，请检查表单'

    case 401:
      return '认证失败，请重新登录'

    case 403:
      return '没有权限执行此操作'

    case 404:
      return '请求的资源不存在'

    case 413:
      return '上传文件过大，请选择较小的文件'

    case 429:
      return '请求过于频繁，请稍后再试'

    case 500:
      return '服务器错误，请稍后重试'

    case 502:
    case 503:
    case 504:
      return '服务暂时不可用，请稍后重试'

    default:
      return data?.detail || data?.message || `请求失败 (${status})`
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }

    error.message = formatApiError(error)
    return Promise.reject(error)
  }
)

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const params = new URLSearchParams()
    params.append('username', credentials.username)
    params.append('password', credentials.password)

    const response = await apiClient.post<LoginResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )
    return response.data
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>(API_ENDPOINTS.AUTH.ME)
    return response.data
  },

  changePassword: async (data: PasswordChangeRequest): Promise<User> => {
    const response = await apiClient.post<User>(
      API_ENDPOINTS.AUTH.CHANGE_PASSWORD,
      data
    )
    return response.data
  },

  getPreferences: async (): Promise<UserPreferences> => {
    const response = await apiClient.get<UserPreferences>(API_ENDPOINTS.AUTH.PREFERENCES)
    return response.data
  },

  updatePreferences: async (data: UserPreferences): Promise<void> => {
    await apiClient.put(API_ENDPOINTS.AUTH.PREFERENCES, data)
  },

  setAliyunKey: async (apiKey: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.AUTH.SET_ALIYUN_KEY, { api_key: apiKey })
  },

  deleteAliyunKey: async (): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.AUTH.SET_ALIYUN_KEY)
  },

  verifyAliyunKey: async (): Promise<{ valid: boolean; message: string }> => {
    const response = await apiClient.get<{ valid: boolean; message: string }>(
      API_ENDPOINTS.AUTH.VERIFY_ALIYUN_KEY
    )
    return response.data
  },

  getSystemSettings: async (): Promise<SystemSettings> => {
    const response = await apiClient.get<SystemSettings>('/users/system/settings')
    return response.data
  },

  updateSystemSettings: async (settings: { local_model_enabled: boolean }): Promise<void> => {
    await apiClient.put('/users/system/settings', settings)
  },
}

export const ttsApi = {
  getLanguages: async (): Promise<Language[]> => {
    const response = await apiClient.get<string[]>(API_ENDPOINTS.TTS.LANGUAGES)
    return response.data.map((lang) => ({
      code: lang,
      name: LANGUAGE_NAMES[lang] || lang,
    }))
  },

  getSpeakers: async (): Promise<Speaker[]> => {
    const response = await apiClient.get<Speaker[]>(API_ENDPOINTS.TTS.SPEAKERS)
    return response.data.map((speaker) => ({
      name: speaker.name,
      description: SPEAKER_DESCRIPTIONS_ZH[speaker.name] || speaker.description,
    }))
  },

  createCustomVoiceJob: async (data: CustomVoiceForm): Promise<JobCreateResponse> => {
    const response = await apiClient.post<JobCreateResponse>(API_ENDPOINTS.TTS.CUSTOM_VOICE, data)
    return response.data
  },

  createVoiceDesignJob: async (data: VoiceDesignForm): Promise<JobCreateResponse> => {
    const response = await apiClient.post<JobCreateResponse>(API_ENDPOINTS.TTS.VOICE_DESIGN, data)
    return response.data
  },

  createVoiceCloneJob: async (data: VoiceCloneForm): Promise<JobCreateResponse> => {
    const formData = new FormData()
    formData.append('text', data.text)
    if (data.ref_audio) {
      formData.append('ref_audio', data.ref_audio)
    }
    if (data.language) {
      formData.append('language', data.language)
    }
    if (data.ref_text) {
      formData.append('ref_text', data.ref_text)
    }
    if (data.use_cache !== undefined) {
      formData.append('use_cache', String(data.use_cache))
    }
    if (data.x_vector_only_mode !== undefined) {
      formData.append('x_vector_only_mode', String(data.x_vector_only_mode))
    }
    if (data.max_new_tokens !== undefined) {
      formData.append('max_new_tokens', String(data.max_new_tokens))
    }
    if (data.temperature !== undefined) {
      formData.append('temperature', String(data.temperature))
    }
    if (data.top_k !== undefined) {
      formData.append('top_k', String(data.top_k))
    }
    if (data.top_p !== undefined) {
      formData.append('top_p', String(data.top_p))
    }
    if (data.repetition_penalty !== undefined) {
      formData.append('repetition_penalty', String(data.repetition_penalty))
    }
    if (data.backend) {
      formData.append('backend', data.backend)
    }

    const response = await apiClient.post<JobCreateResponse>(
      API_ENDPOINTS.TTS.VOICE_CLONE,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },
}

const normalizeJobType = (jobType: string): JobType => {
  const typeMap: Record<string, JobType> = {
    'custom-voice': 'custom_voice',
    'voice-design': 'voice_design',
    'voice-clone': 'voice_clone',
  }
  return typeMap[jobType] || jobType as JobType
}

const normalizeJob = (job: any): Job => {
  let parameters = job.input_params || job.parameters || {}

  if (typeof parameters === 'string') {
    try {
      parameters = JSON.parse(parameters)
    } catch (e) {
      console.error('Failed to parse job parameters:', e)
      parameters = {}
    }
  }

  return {
    ...job,
    type: normalizeJobType(job.job_type || job.type),
    parameters,
    audio_url: job.download_url || job.audio_url,
  }
}

export const jobApi = {
  getJob: async (id: number): Promise<Job> => {
    const response = await apiClient.get<any>(API_ENDPOINTS.JOBS.GET(id))
    return normalizeJob(response.data)
  },

  listJobs: async (skip = 0, limit = 100, status?: string): Promise<JobListResponse> => {
    const params: Record<string, any> = { skip, limit }
    if (status) params.status = status
    const response = await apiClient.get<any>(API_ENDPOINTS.JOBS.LIST, { params })
    return {
      ...response.data,
      jobs: response.data.jobs.map(normalizeJob),
    }
  },

  deleteJob: async (id: number): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.JOBS.DELETE(id))
  },

  getAudioUrl: (id: number, audioPath?: string): string => {
    if (audioPath) {
      if (audioPath.startsWith('http')) {
        return audioPath
      } else {
        const baseUrl = import.meta.env.VITE_API_URL
        const normalizedPath = audioPath.startsWith('/') ? audioPath : `/${audioPath}`
        return `${baseUrl}${normalizedPath}`
      }
    } else {
      return `${import.meta.env.VITE_API_URL}${API_ENDPOINTS.JOBS.AUDIO(id)}`
    }
  },
}

export const userApi = {
  listUsers: async (skip = 0, limit = 100): Promise<UserListResponse> => {
    const response = await apiClient.get<UserListResponse>(
      API_ENDPOINTS.USERS.LIST,
      { params: { skip, limit } }
    )
    return response.data
  },

  getUser: async (id: number): Promise<User> => {
    const response = await apiClient.get<User>(API_ENDPOINTS.USERS.GET(id))
    return response.data
  },

  createUser: async (data: UserCreateRequest): Promise<User> => {
    const response = await apiClient.post<User>(API_ENDPOINTS.USERS.CREATE, data)
    return response.data
  },

  updateUser: async (id: number, data: UserUpdateRequest): Promise<User> => {
    const response = await apiClient.put<User>(API_ENDPOINTS.USERS.UPDATE(id), data)
    return response.data
  },

  deleteUser: async (id: number): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.USERS.DELETE(id))
  },
}

export default apiClient
