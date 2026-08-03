import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import ipp from 'ipp'
import { buildCatalog, resolvePrintablePath } from './catalog.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')

/** Default HTML→PDF budget (ms). Override with VOICE_PRINT_PDF_TIMEOUT_MS. */
const DEFAULT_PDF_TIMEOUT_MS = 60_000

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

function pdfTimeoutMs() {
  const raw = process.env.VOICE_PRINT_PDF_TIMEOUT_MS
  if (raw == null || raw === '') return DEFAULT_PDF_TIMEOUT_MS
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PDF_TIMEOUT_MS
}

/**
 * Ordered browser binaries for headless print-to-PDF.
 * Windows prefers Edge (usually preinstalled), then Chrome; env paths win.
 */
export function browserCandidates(platform = process.platform, env = process.env) {
  const localAppData = env.LOCALAPPDATA || ''
  const programFiles = env['ProgramFiles'] || 'C:\\Program Files'
  const programFilesX86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'

  const winEdge = [
    env.VOICE_PRINT_EDGE_PATH,
    path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    localAppData && path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    'msedge',
  ].filter(Boolean)

  const winChrome = [
    env.VOICE_PRINT_CHROME_PATH,
    path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    localAppData && path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'chrome',
  ].filter(Boolean)

  const macChrome = [
    env.VOICE_PRINT_CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome',
    'chromium',
  ].filter(Boolean)

  const linux = [
    env.VOICE_PRINT_CHROME_PATH,
    env.VOICE_PRINT_EDGE_PATH,
    'google-chrome',
    'google-chrome-stable',
    'chromium-browser',
    'chromium',
    'microsoft-edge',
    'msedge',
  ].filter(Boolean)

  if (platform === 'win32') return [...new Set([...winEdge, ...winChrome])]
  if (platform === 'darwin') return [...new Set(macChrome)]
  return [...new Set(linux)]
}

function isAbsoluteBrowserPath(bin) {
  return path.isAbsolute(bin) || /^[A-Za-z]:[\\/]/.test(bin)
}

async function pathExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/**
 * Headless Chromium/Edge args that are reliable on Windows (profile lock, hang).
 */
function headlessPdfArgs(outPdf, fileUrl, userDataDir) {
  return [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--hide-scrollbars',
    '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=15000',
    `--user-data-dir=${userDataDir}`,
    `--print-to-pdf=${outPdf}`,
    fileUrl,
  ]
}

function runCommand(cmd, args, { timeoutMs, useShell }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      // Absolute Windows paths with spaces break under shell:true; PATH names need it.
      shell: useShell,
      windowsHide: true,
    })

    let stderr = ''
    let settled = false
    const finish = (err, code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (err) reject(err)
      else if (code === 0) resolve()
      else {
        const detail = stderr.trim().slice(0, 400)
        reject(new Error(`${cmd} exited ${code}${detail ? `: ${detail}` : ''}`))
      }
    }

    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM')
      } catch {
        /* ignore */
      }
      // Windows often needs a harder kill if Edge ignores SIGTERM
      setTimeout(() => {
        try {
          child.kill('SIGKILL')
        } catch {
          /* ignore */
        }
      }, 1500)
      finish(
        new Error(
          `${cmd} timed out after ${timeoutMs}ms (HTML→PDF). Set VOICE_PRINT_PDF_TIMEOUT_MS or VOICE_PRINT_EDGE_PATH.`,
        ),
      )
    }, timeoutMs)

    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', (err) => finish(err))
    child.on('close', (code) => finish(null, code))
  })
}

export async function htmlToPdf(htmlPath, outPdf) {
  const candidates = browserCandidates()
  const fileUrl = pathToFileURL(htmlPath).href
  const timeoutMs = pdfTimeoutMs()
  const errors = []

  await fs.rm(outPdf, { force: true }).catch(() => {})

  for (const bin of candidates) {
    if (isAbsoluteBrowserPath(bin) && !(await pathExists(bin))) {
      errors.push(`${bin}: not found`)
      continue
    }

    const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'voice-print-browser-'))
    try {
      await runCommand(bin, headlessPdfArgs(outPdf, fileUrl, userDataDir), {
        timeoutMs,
        useShell: process.platform === 'win32' && !isAbsoluteBrowserPath(bin),
      })
      const st = await fs.stat(outPdf)
      if (st.size < 100) {
        throw new Error(`PDF too small (${st.size} bytes) — browser may have failed silently`)
      }
      return outPdf
    } catch (err) {
      errors.push(`${bin}: ${err.message || err}`)
      await fs.rm(outPdf, { force: true }).catch(() => {})
    } finally {
      await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {})
    }
  }

  const tried = errors.length ? `\nTried:\n- ${errors.join('\n- ')}` : ''
  throw new Error(
    `Could not convert HTML to PDF. Install Edge/Chrome, set VOICE_PRINT_EDGE_PATH, or print a PDF version.${tried}`,
  )
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

  if (args.includes('--browsers')) {
    for (const bin of browserCandidates()) {
      const exists = isAbsoluteBrowserPath(bin) ? await pathExists(bin) : '(PATH)'
      console.log(`${bin}\t${exists === true ? 'found' : exists === false ? 'missing' : exists}`)
    }
    return
  }

  const toPdfOnly = args.includes('--to-pdf')
  const file = args.find((a) => !a.startsWith('-'))
  if (!file) {
    console.error('Usage: node print.js <file-id-or-path> | --list | --browsers | --to-pdf <file>')
    process.exit(1)
  }

  const items = await listCatalog()
  const match = items.find((i) => i.id === file || i.path === file)
  const target = match?.path ?? file

  if (toPdfOnly) {
    const resolved = resolvePrintablePath(REPO_ROOT, target)
    await fs.access(resolved)
    const pdfPath = await ensurePdf(resolved)
    const st = await fs.stat(pdfPath)
    console.log(JSON.stringify({ ok: true, pdf: pdfPath, bytes: st.size }, null, 2))
    return
  }

  const result = await printFile(target)
  console.log(JSON.stringify(result, null, 2))
}

if (isMain) {
  main().catch((err) => {
    console.error(err.message || err)
    process.exit(1)
  })
}
