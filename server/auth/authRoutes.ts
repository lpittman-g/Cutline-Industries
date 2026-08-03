import type { Express, NextFunction, Request, Response } from 'express'
import { thermalDbEnabled } from '../db/pool.ts'
import {
  clearFailedLogin,
  consumeEmailVerificationToken,
  createEmailVerificationToken,
  createSession,
  deleteSession,
  findSessionUser,
  findUserByEmail,
  insertUser,
  markEmailVerified,
  recordLoginAttempt,
  setFailedLogin,
  setMfaEnabled,
  toPublicUser,
} from './authRepo.ts'
import {
  SESSION_COOKIE,
  emailDomain,
  hashPassword,
  hashToken,
  loadAuthConfig,
  newOpaqueToken,
  normalizeEmail,
  publicBaseUrl,
  validatePassword,
  verifyPassword,
} from './authCrypto.ts'

declare global {
  namespace Express {
    interface Request {
      authUser?: ReturnType<typeof toPublicUser>
    }
  }
}

function dbRequired(_req: Request, res: Response, next: NextFunction) {
  if (!thermalDbEnabled()) {
    res.status(503).json({
      error: 'DATABASE_URL not configured',
      hint: 'Set DATABASE_URL and run npm run db:migrate',
    })
    return
  }
  next()
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const key = part.slice(0, idx).trim()
    const val = decodeURIComponent(part.slice(idx + 1).trim())
    out[key] = val
  }
  return out
}

function clientIp(req: Request) {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0]?.trim() ?? null
  return req.socket.remoteAddress ?? null
}

function setSessionCookie(res: Response, token: string, maxAgeMs: number) {
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.CUTLINE_PUBLIC_URL)
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ]
  if (secure) parts.push('Secure')
  res.append('Set-Cookie', parts.join('; '))
}

function clearSessionCookie(res: Response) {
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  )
}

async function attachUser(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!thermalDbEnabled()) {
      next()
      return
    }
    const cookies = parseCookies(req.headers.cookie)
    const token = cookies[SESSION_COOKIE]
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

export function registerAuthRoutes(app: Express) {
  app.use(attachUser)

  app.get('/api/auth/config', async (_req, res) => {
    const cfg = await loadAuthConfig()
    res.json({
      signUp: {
        allowPublicRegistration: cfg.auth_configuration.sign_up_rules.allow_public_registration,
        requireEmailVerification: cfg.auth_configuration.sign_up_rules.require_email_verification,
        passwordPolicy: cfg.auth_configuration.sign_up_rules.password_policy,
        blockedDomains: cfg.auth_configuration.sign_up_rules.blocked_domains,
      },
      signIn: {
        maxLoginAttempts: cfg.auth_configuration.sign_in_rules.max_login_attempts,
        lockoutDurationMinutes: cfg.auth_configuration.sign_in_rules.lockout_duration_minutes,
        sessionTimeoutHours: cfg.auth_configuration.sign_in_rules.session_timeout_hours,
        multiFactorAuthentication: cfg.auth_configuration.sign_in_rules.multi_factor_authentication,
      },
    })
  })

  app.get('/api/auth/user', dbRequired, (req, res) => {
    res.json({ user: req.authUser ?? null })
  })

  app.post('/api/auth/signup', dbRequired, async (req, res) => {
    try {
      const cfg = await loadAuthConfig()
      const rules = cfg.auth_configuration.sign_up_rules
      if (!rules.allow_public_registration) {
        res.status(403).json({ error: 'Public registration is disabled' })
        return
      }

      const email = normalizeEmail(String(req.body?.email ?? ''))
      const password = String(req.body?.password ?? '')
      const displayName = req.body?.displayName ? String(req.body.displayName).trim() : null

      if (!email || !email.includes('@')) {
        res.status(400).json({ error: 'Valid email required' })
        return
      }
      const domain = emailDomain(email)
      if (rules.blocked_domains.map((d) => d.toLowerCase()).includes(domain)) {
        res.status(400).json({ error: 'Email domain is not allowed' })
        return
      }

      const pwErrors = validatePassword(password, rules.password_policy)
      if (pwErrors.length) {
        res.status(400).json({ error: pwErrors[0], errors: pwErrors })
        return
      }

      if (await findUserByEmail(email)) {
        res.status(409).json({ error: 'An account with this email already exists' })
        return
      }

      const user = await insertUser({
        email,
        password_hash: await hashPassword(password),
        display_name: displayName,
      })

      let verificationUrl: string | null = null
      if (rules.require_email_verification) {
        const raw = newOpaqueToken()
        const expires = new Date(Date.now() + 48 * 60 * 60 * 1000)
        await createEmailVerificationToken({
          user_id: user.id,
          token_hash: hashToken(raw),
          expires_at: expires,
        })
        verificationUrl = `${publicBaseUrl()}/verify-email?token=${raw}`
        console.info(`[auth] verify email for ${email}: ${verificationUrl}`)
      } else {
        await markEmailVerified(user.id)
      }

      const expose =
        process.env.AUTH_DEV_EXPOSE_LINKS === '1' || process.env.NODE_ENV !== 'production'

      res.status(201).json({
        ok: true,
        user: toPublicUser({ ...user, email_verified: !rules.require_email_verification }),
        requiresEmailVerification: rules.require_email_verification,
        verificationUrl: expose ? verificationUrl : undefined,
        message: rules.require_email_verification
          ? 'Account created. Verify your email before signing in.'
          : 'Account created.',
      })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/api/auth/verify-email', dbRequired, async (req, res) => {
    try {
      const token = String(req.body?.token ?? req.query?.token ?? '')
      if (!token) {
        res.status(400).json({ error: 'token required' })
        return
      }
      const userId = await consumeEmailVerificationToken(hashToken(token))
      if (!userId) {
        res.status(400).json({ error: 'Invalid or expired verification token' })
        return
      }
      await markEmailVerified(userId)
      res.json({ ok: true, message: 'Email verified. You can sign in.' })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/api/auth/signin', dbRequired, async (req, res) => {
    try {
      const cfg = await loadAuthConfig()
      const signIn = cfg.auth_configuration.sign_in_rules
      const email = normalizeEmail(String(req.body?.email ?? ''))
      const password = String(req.body?.password ?? '')
      const mfaCode = req.body?.mfaCode != null ? String(req.body.mfaCode) : null
      const ip = clientIp(req)

      if (!email || !password) {
        res.status(400).json({ error: 'email and password required' })
        return
      }

      const user = await findUserByEmail(email)
      if (!user) {
        await recordLoginAttempt({ email, success: false, ip_address: ip })
        res.status(401).json({ error: 'Invalid email or password' })
        return
      }

      if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
        res.status(423).json({
          error: 'Account locked due to failed sign-in attempts',
          lockedUntil: user.locked_until,
        })
        return
      }

      const ok = await verifyPassword(password, user.password_hash)
      if (!ok) {
        const next = user.failed_login_count + 1
        let lockedUntil: Date | null = null
        if (next >= signIn.max_login_attempts) {
          lockedUntil = new Date(Date.now() + signIn.lockout_duration_minutes * 60 * 1000)
        }
        await setFailedLogin(user.id, next, lockedUntil)
        await recordLoginAttempt({ email, success: false, ip_address: ip })
        res.status(401).json({
          error: lockedUntil
            ? `Too many attempts. Locked for ${signIn.lockout_duration_minutes} minutes.`
            : 'Invalid email or password',
          attemptsRemaining: Math.max(0, signIn.max_login_attempts - next),
        })
        return
      }

      if (cfg.auth_configuration.sign_up_rules.require_email_verification && !user.email_verified) {
        res.status(403).json({
          error: 'Email not verified',
          hint: 'Check your inbox or use the verification link from signup.',
        })
        return
      }

      if (user.mfa_enabled) {
        if (!mfaCode) {
          res.status(401).json({
            error: 'MFA code required',
            mfaRequired: true,
          })
          return
        }
        // Optional MFA: accept stored secret equality for recovery codes / future TOTP.
        // Until TOTP is wired, require exact mfa_secret match (dev/ops set via enable endpoint).
        if (!user.mfa_secret || mfaCode !== user.mfa_secret) {
          await recordLoginAttempt({ email, success: false, ip_address: ip })
          res.status(401).json({ error: 'Invalid MFA code', mfaRequired: true })
          return
        }
      }

      await clearFailedLogin(user.id)
      await recordLoginAttempt({ email, success: true, ip_address: ip })

      const raw = newOpaqueToken()
      const maxAgeMs = signIn.session_timeout_hours * 60 * 60 * 1000
      await createSession({
        user_id: user.id,
        token_hash: hashToken(raw),
        expires_at: new Date(Date.now() + maxAgeMs),
        ip_address: ip,
        user_agent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      })
      setSessionCookie(res, raw, maxAgeMs)

      res.json({ ok: true, user: toPublicUser(user) })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/api/auth/logout', dbRequired, async (req, res) => {
    try {
      const cookies = parseCookies(req.headers.cookie)
      const token = cookies[SESSION_COOKIE]
      if (token) await deleteSession(hashToken(token))
      clearSessionCookie(res)
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  /** Optional MFA: enable with a shared recovery code (TOTP can replace later). */
  app.post('/api/auth/mfa/enable', dbRequired, async (req, res) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ error: 'Sign in required' })
        return
      }
      const cfg = await loadAuthConfig()
      if (cfg.auth_configuration.sign_in_rules.multi_factor_authentication === 'off') {
        res.status(403).json({ error: 'MFA is disabled' })
        return
      }
      const code = newOpaqueToken().slice(0, 8).toUpperCase()
      await setMfaEnabled(req.authUser.id, true, code)
      res.json({
        ok: true,
        mfaEnabled: true,
        recoveryCode: code,
        message: 'Store this recovery code. It is required at sign-in while MFA is on.',
      })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/api/auth/mfa/disable', dbRequired, async (req, res) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ error: 'Sign in required' })
        return
      }
      await setMfaEnabled(req.authUser.id, false, null)
      res.json({ ok: true, mfaEnabled: false })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })
}
