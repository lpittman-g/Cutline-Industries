import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import ipp from 'ipp'
import { buildCatalog, resolvePrintablePath } from './catalog.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')

function printerUri() {
  const ip = process.env.VOICE_PRINT_PRINTER_IP || '192.168.1.157'
  return process.env.VOICE_PRINT_PRINTER_URI || `ipp://${ip}/ipp/print`
}

function printerHttpUri() {
  const ip = process.env.VOICE_PRINT_PRINTER_IP || '192.168.1.157'
  if (process.env.VOICE_PRINT_PRINTER_URI?.startsWith('http')) {
    return process.env.VOICE_PRINT_PRINTER_URI
  }
  return `http://${ip}:631/ipp/print`
}

async function htmlToPdf(htmlPath, outPdf) {
  const edge =
    process.env.VOICE_PRINT_EDGE_PATH ||
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  const chrome =
    process.env.VOICE_PRINT_CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

  const candidates =
    process.platform === 'win32'
      ? [edge, 'msedge']
      : process.platform === 'darwin'
        ? [chrome, 'google-chrome', 'chromium']
        : ['google-chrome', 'chromium-browser', 'chromium']

  const fileUrl = pathToFileURL(htmlPath).href

  for (const bin of candidates) {
    try {
      await runCommand(bin, [
        '--headless',
        '--disable-gpu',
        '--no-pdf-header-footer',
        `--print-to-pdf=${outPdf}`,
        fileUrl,
      ])
      await fs.access(outPdf)
      return outPdf
    } catch {
      /* try next */
    }
  }

  throw new Error(
    'Could not convert HTML to PDF. Install Chrome/Edge or add a PDF version of the file.',
  )
}

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))))
  })
}

async function ensurePdf(inputPath) {
  const ext = path.extname(inputPath).toLowerCase()
  if (ext === '.pdf') return inputPath
  if (ext === '.html' || ext === '.htm') {
    const out = path.join(path.dirname(inputPath), `.voice-print-${path.basename(inputPath, ext)}.pdf`)
    return htmlToPdf(inputPath, out)
  }
  throw new Error(`Unsupported file type: ${ext}. Use PDF or HTML.`)
}

export async function printFile(relativeOrAbsolutePath) {
  const resolved = resolvePrintablePath(REPO_ROOT, relativeOrAbsolutePath)
  await fs.access(resolved)
  const pdfPath = await ensurePdf(resolved)
  const data = await fs.readFile(pdfPath)

  return new Promise((resolve, reject) => {
    const printer = ipp.Printer(printerHttpUri())
    const msg = {
      'operation-attributes-tag': {
        'requesting-user-name': process.env.USERNAME || process.env.USER || 'cutline',
        'job-name': path.basename(resolved),
        'document-format': 'application/pdf',
      },
      data,
    }
    printer.execute('Print-Job', msg, (err, res) => {
      if (err) reject(err)
      else if (res?.statusCode >= 400) reject(new Error(`Printer rejected job: ${res?.statusCode}`))
      else resolve({ ok: true, file: resolved, printer: printerUri() })
    })
  })
}

export async function listCatalog() {
  return buildCatalog(REPO_ROOT)
}

const __file = fileURLToPath(import.meta.url)
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__file)

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--list') || args.includes('-l')) {
    const items = await listCatalog()
    for (const item of items) {
      console.log(`${item.id}\t${item.label}\t${item.path}`)
    }
    return
  }

  const file = args.find((a) => !a.startsWith('-'))
  if (!file) {
    console.error('Usage: node print.js <file-id-or-path> | --list')
    process.exit(1)
  }

  const items = await listCatalog()
  const match = items.find((i) => i.id === file || i.path === file)
  const target = match?.path ?? file
  const result = await printFile(target)
  console.log(JSON.stringify(result, null, 2))
}

if (isMain) {
  main().catch((err) => {
    console.error(err.message || err)
    process.exit(1)
  })
}
