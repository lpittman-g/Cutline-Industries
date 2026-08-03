import type { NextFunction, Request, Response } from 'express'
import { thermalDbEnabled } from '../db/pool.ts'
import { findSessionUser, toPublicUser, type UserRole } from './authRepo.ts'
import { SESSION_COOKIE, hashToken } from './authCrypto.ts'

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

export async function attachAuthUser(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!thermalDbEnabled()) {
      next()
      return
    }
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    if (!token) {
      next()
      return
    }
    const user = await findSessionUser(hashToken(token))
    if (user) req.authUser = toPublicUser(user)
    next()
  } catch (err) {
    next(err)
  }
}

/** Mission Control open in local/dev when AUTH_MC_OPEN=1 */
export function missionControlOpen() {
  return process.env.AUTH_MC_OPEN === '1'
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (missionControlOpen()) {
    next()
    return
  }
  if (!req.authUser) {
    res.status(401).json({ error: 'Sign in required', hint: 'POST /api/auth/signin' })
    return
  }
  next()
}

const ROLE_RANK: Record<UserRole, number> = {
  user: 1,
  operator: 2,
  admin: 3,
}

export function requireRole(min: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (missionControlOpen()) {
      next()
      return
    }
    if (!req.authUser) {
      res.status(401).json({ error: 'Sign in required' })
      return
    }
    const rank = ROLE_RANK[req.authUser.role] ?? 0
    if (rank < ROLE_RANK[min]) {
      res.status(403).json({
        error: 'Insufficient role',
        hint: `Requires ${min} or higher (have ${req.authUser.role})`,
      })
      return
    }
    next()
  }
}
