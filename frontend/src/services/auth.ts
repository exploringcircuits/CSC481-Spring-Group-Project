import { apiFetch } from "@/services/api"
import { tokenStorage, userStorage } from "@/lib/storage"
import type {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  User,
} from "@/types/auth"

/** Register a new account. Does not log the user in. */
export async function register(payload: RegisterPayload): Promise<User> {
  return apiFetch<User>("/api/auth/register/", {
    method: "POST",
    body: payload,
    anonymous: true,
  })
}

/** Log in and persist tokens + user info to localStorage. */
export async function login(payload: LoginPayload): Promise<User> {
  const data = await apiFetch<LoginResponse>("/api/auth/login/", {
    method: "POST",
    body: payload,
    anonymous: true,
  })
  tokenStorage.setTokens(data.access, data.refresh)
  userStorage.set(data.user)
  return data.user
}

/** Drop tokens + user info. Optionally hits the backend logout endpoint
 * (currently a no-op server-side, but good to call for future auditing). */
export async function logout(): Promise<void> {
  try {
    if (tokenStorage.getAccess()) {
      await apiFetch("/api/auth/logout/", { method: "POST" })
    }
  } catch {
    // If the call fails (e.g. token already expired) we still clear local state.
  } finally {
    tokenStorage.clear()
    userStorage.clear()
  }
}

/** Fetch the current user from the backend. Used to refresh local cache. */
export async function fetchMe(): Promise<User> {
  const user = await apiFetch<User>("/api/auth/me/")
  userStorage.set(user)
  return user
}

/** Use the refresh token to get a new access token. Returns true on success. */
export async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokenStorage.getRefresh()
  if (!refresh) return false
  try {
    const data = await apiFetch<{ access: string }>("/api/auth/refresh/", {
      method: "POST",
      body: { refresh },
      anonymous: true,
    })
    tokenStorage.setAccess(data.access)
    return true
  } catch {
    return false
  }
}
