// IMPORTANT: Import instrument before any other modules so Sentry can hook HTTP.
import './instrument.ts'
import path from 'node:path'
import dotenv from 'dotenv'
import { ROOT } from './youtubeAuth.ts'
import { createApp } from './createApp.ts'

dotenv.config({ path: path.join(ROOT, '.env') })

const app = createApp()
const PORT = Number(process.env.CUTLINE_API_PORT || 8787)

app.listen(PORT, () => {
  console.log(`Cutline Industries API on http://127.0.0.1:${PORT}`)
})
