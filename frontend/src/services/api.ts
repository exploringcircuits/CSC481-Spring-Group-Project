import { tokenStorage } from "@/lib/storage"

/** Where the backend lives. In dev we go through the Vite proxy at /api/*,
 * so a relative URL is enough. Override via VITE_API_URL for prod builds. */
const API_BASE = import.meta.env.VITE_API_URL ?? ""

/** Thrown for any non-2xx response. Carries the parsed body when possible. */
export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body: unknown = null) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  /** When true, do not attach the Authorization header even if a token exists. */
  anonymous?: boolean
}

/**
 * Single entry point for all backend calls.
 *
 * - Prepends API_BASE so callers pass `/api/...` paths.
 * - Attaches `Authorization: Bearer <token>` when a token is present and the
 *   call isn't marked anonymous.
 * - JSON-encodes object bodies and sets Content-Type accordingly.
 * - Parses JSON responses; throws ApiError for non-2xx.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, anonymous, headers, ...rest } = options

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  }

  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders["Content-Type"] = "application/json"
  }

  if (!anonymous) {
    const token = tokenStorage.getAccess()
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  })

  // 204 No Content → return undefined cast to T
  if (response.status === 204) {
    return undefined as T
  }

  let payload: unknown = null
  const contentType = response.headers.get("Content-Type") ?? ""
  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => null)
  } else {
    payload = await response.text().catch(() => null)
  }

  if (!response.ok) {
    const message = extractErrorMessage(payload, response.status)
    throw new ApiError(response.status, message, payload)
  }

  return payload as T
}

function extractErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === "string" && payload.length > 0) return payload
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>
    if (typeof obj.detail === "string") return obj.detail
    if (typeof obj.error === "string") return obj.error
    // DRF returns { field: [errors...] } for validation errors
    const fieldErrors = Object.entries(obj)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
    if (fieldErrors.length > 0) return fieldErrors.join("; ")
  }
  return `Request failed with status ${status}`
}
