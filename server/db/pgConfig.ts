import type pg from 'pg'

/**
 * Build pg Client/Pool config from DATABASE_URL.
 * Managed hosts (Neon, Supabase, RDS) require SSL; local Docker/Postgres does not.
 */
export function createPgConfig(connectionString: string): pg.ClientConfig {
  const hostname = parseHostname(connectionString)
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  const sslFlag = (process.env.DATABASE_SSL ?? process.env.PGSSLMODE ?? '').toLowerCase()
  const forceOff = sslFlag === '0' || sslFlag === 'false' || sslFlag === 'disable'
  const forceOn = sslFlag === '1' || sslFlag === 'true' || sslFlag === 'require'
  const urlWantsSsl = /[?&]sslmode=(require|verify-ca|verify-full)/i.test(connectionString)
  const useSsl = forceOn || urlWantsSsl || (!isLocal && !forceOff)

  if (!useSsl) {
    return { connectionString }
  }

  // Encrypted transport for Neon / Supabase / RDS. Set DATABASE_SSL_REJECT_UNAUTHORIZED=1
  // when the provider CA is trusted (or bundled) and you want full cert verification.
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === '1'

  return {
    connectionString,
    ssl: { rejectUnauthorized },
  }
}

function parseHostname(connectionString: string): string {
  try {
    const normalized = connectionString.replace(/^postgres(ql)?:/i, 'http:')
    return new URL(normalized).hostname
  } catch {
    return ''
  }
}
