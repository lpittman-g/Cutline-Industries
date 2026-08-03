import pg from 'pg'
import dotenv from 'dotenv'
import { ROOT } from '../youtubeAuth.ts'

dotenv.config({ path: `${ROOT}/.env` })

let pool: pg.Pool | null = null

export function thermalDbEnabled() {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export function getPool(): pg.Pool {
  if (!thermalDbEnabled()) {
    throw new Error('DATABASE_URL is not configured')
  }
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

export async function withClient<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}
