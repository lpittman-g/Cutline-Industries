import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'
import { buildCatalog } from './catalog.js'
import { listCatalog, printFile } from './print.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')

dotenv.config({ path: path.join(REPO_ROOT, '.env') })
dotenv.config({ path: path.join(__dirname, '.env') })

const app = express()
const PORT = Number(process.env.VOICE_PRINT_PORT || 8791)
const WAKE_WORD = (process.env.VOICE_PRINT_WAKE_WORD || 'print').toLowerCase()

app.use(express.json({ limit: '1mb' }))
app.use(express.static(path.join(__dirname, 'public')))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    wakeWord: WAKE_WORD,
    printerIp: process.env.VOICE_PRINT_PRINTER_IP || '192.168.1.157',
    printerUri: process.env.VOICE_PRINT_PRINTER_URI || null,
  })
})

app.get('/api/catalog', async (_req, res) => {
  try {
    res.json({ items: await buildCatalog(REPO_ROOT) })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.post('/api/print', async (req, res) => {
  try {
    const file = String(req.body?.file ?? req.body?.path ?? '')
    if (!file) {
      res.status(400).json({ error: 'file required' })
      return
    }
    const items = await listCatalog()
    const match = items.find((i) => i.id === file || i.path === file)
    const target = match?.path ?? file
    const result = await printFile(target)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

app.listen(PORT, () => {
  console.log(`Voice Print listening on http://127.0.0.1:${PORT}`)
  console.log(`Wake word: "${WAKE_WORD}" → HP at ${process.env.VOICE_PRINT_PRINTER_IP || '192.168.1.157'}`)
  console.log('Open the page, pick a blueprint, allow the microphone, then say print.')
})
