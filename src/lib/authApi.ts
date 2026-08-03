const API = import.meta.env.VITE_API_URL || ''

export type AuthUser = {
  id: number
  email: string
  displayName: string | null
  emailVerified: boolean
  mfaEnabled: boolean
}

export type AuthConfigPublic = {
  signUp: {
    allowPublicRegistration: boolean
    requireEmailVerification: boolean
    passwordPolicy: {
      min_length: number
      require_uppercase: boolean
      require_numbers: boolean
      require_special_characters: boolean
    }
    blockedDomains: string[]
  }
  signIn: {
    maxLoginAttempts: number
    lockoutDurationMinutes: number
    sessionTimeoutHours: number
    multiFactorAuthentication: string
  }
}

async function parseError(res: Response) {
  let message = await res.text()
  try {
    const parsed = JSON.parse(message) as { error?: string; hint?: string }
    message = [parsed.error, parsed.hint].filter(Boolean).join(' — ')
  } catch {
    /* keep */
  }
  return message || res.statusText
}

async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<T>
}

export function fetchAuthConfig() {
  return authJson<AuthConfigPublic>('/api/auth/config')
}

export function fetchAuthUser() {
  return authJson<{ user: AuthUser | null }>('/api/auth/user')
}

export function signup(input: { email: string; password: string; displayName?: string }) {
  return authJson<{
    ok: boolean
    user: AuthUser
    requiresEmailVerification: boolean
    verificationUrl?: string
    message: string
  }>('/api/auth/signup', { method: 'POST', body: JSON.stringify(input) })
}

export function signin(input: { email: string; password: string; mfaCode?: string }) {
  return authJson<{ ok: boolean; user: AuthUser; mfaRequired?: boolean }>('/api/auth/signin', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function verifyEmail(token: string) {
  return authJson<{ ok: boolean; message: string }>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export function logout() {
  return authJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST', body: '{}' })
}
