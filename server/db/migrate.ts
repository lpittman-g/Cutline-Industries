import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import { ROOT } from '../youtubeAuth.ts'
import { createPgConfig } from './pgConfig.ts'

dotenv.config({ path: path.join(ROOT, '.env') })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.resolve(__dirname, '../../db/migrations')

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    console.error('DATABASE_URL is required. Example: postgres://user:pass@localhost:5432/thermal')
    process.exit(1)
  }

  const client = new pg.Client(createPgConfig(databaseUrl))
  await client.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort()

    for (const filename of files) {
      const already = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [
        filename,
      ])
      if (already.rowCount) {
        console.log(`skip ${filename}`)
        continue
      }

      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, filename), 'utf8')
      console.log(`apply ${filename}`)
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
    }

    console.log('Thermal migrations complete')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
