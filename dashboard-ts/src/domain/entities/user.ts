export interface User {
  id: number
  username: string
  full_name: string
  email: string
  role: string
  active: boolean
  created_at: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

export interface CreateUserRequest {
  username: string
  password: string
  full_name?: string
  email?: string
  role: string
}

export interface UpdateUserRequest {
  password?: string
  full_name?: string
  email?: string
  role?: string
  active?: boolean
}
