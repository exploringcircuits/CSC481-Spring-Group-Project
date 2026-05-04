import { createContext, useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

import * as authService from "@/services/auth"
import { tokenStorage, userStorage } from "@/lib/storage"
import type { LoginPayload, RegisterPayload, User } from "@/types/auth"

export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isStaff: boolean
  isLoading: boolean
  login: (payload: LoginPayload) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  logout: () => Promise<void>
  refresh: () => Promise<User | null>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(() => userStorage.get())
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // On mount, if we have a token but no/stale user info, refresh from /me/.
  useEffect(() => {
    const token = tokenStorage.getAccess()
    if (!token) return
    let cancelled = false
    setIsLoading(true)
    authService
      .fetchMe()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch(() => {
        if (!cancelled) {
          tokenStorage.clear()
          userStorage.clear()
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (payload: LoginPayload) => {
    const u = await authService.login(payload)
    setUser(u)
    return u
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    return authService.register(payload)
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const u = await authService.fetchMe()
      setUser(u)
      return u
    } catch {
      return null
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isStaff: user?.is_staff ?? false,
      isLoading,
      login,
      register,
      logout,
      refresh,
    }),
    [user, isLoading, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
