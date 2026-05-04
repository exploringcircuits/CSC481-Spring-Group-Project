export interface User {
  id: number
  email: string
  display_name: string
  is_staff: boolean
  date_joined: string
}

export interface LoginResponse {
  access: string
  refresh: string
  user: User
}

export interface RegisterPayload {
  email: string
  password: string
  display_name?: string
}

export interface LoginPayload {
  email: string
  password: string
}
