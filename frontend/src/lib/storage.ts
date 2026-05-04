import type { User } from "@/types/auth"

const ACCESS_TOKEN_KEY = "access_token"
const REFRESH_TOKEN_KEY = "refresh_token"
const USER_KEY = "auth_user"

export const tokenStorage = {
  getAccess(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  },
  getRefresh(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  },
  setTokens(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, access)
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
  },
  setAccess(access: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, access)
  },
  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

export const userStorage = {
  get(): User | null {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as User
    } catch {
      return null
    }
  },
  set(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear(): void {
    localStorage.removeItem(USER_KEY)
  },
}
