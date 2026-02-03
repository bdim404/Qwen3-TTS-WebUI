import type { User } from './auth'

export interface UserCreateRequest {
  username: string
  email: string
  password: string
  is_active: boolean
  is_superuser: boolean
  can_use_local_model: boolean
}

export interface UserUpdateRequest {
  username?: string
  email?: string
  password?: string
  is_active?: boolean
  is_superuser?: boolean
  can_use_local_model?: boolean
}

export interface UserListResponse {
  users: User[]
  total: number
}
