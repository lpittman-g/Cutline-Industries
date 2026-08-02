import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { probeDuration } from './ffmpegCut.ts'

const execFileAsync = promisify(execFile)

const FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
]

async function resolveFont(): Promise<string> {
  for (const candidate of FONT_CANDIDATES) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // try next
    }
  }
  throw new Error('No TTF font found for FFmpeg drawtext')
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/\n/g, ' ')
    .slice(0, 120)
}

export type AiShortRenderInput = {
  title: string
  hook: string
  subtitle?: string
  audioPath: string
  outPath: string
  brand?: string
}

export async function renderAiShort(input: AiShortRenderInput): Promise<string> {
  const font = await resolveFont()
  const duration = await probeDuration(input.audioPath)
  const clipDuration = Math.min(Math.max(duration + 0.5, 8), 59)

  await fs.mkdir(path.dirname(input.outPath), { recursive: true })

  const title = escapeDrawtext(input.title)
  const hook = escapeDrawtext(input.hook)
  const subtitle = escapeDrawtext(input.subtitle ?? 'Cutline Industries')
  const brand = escapeDrawtext(input.brand ?? 'cutline-industries.studio')

  const vf = [
    `drawtext=fontfile=${font}:text='${title}':fontcolor=white:fontsize=52:x=(w-text_w)/2:y=320:box=1:boxcolor=0x00000088:boxborderw=16`,
    `drawtext=fontfile=${font}:text='${hook}':fontcolor=0xE2E8F0:fontsize=40:x=(w-text_w)/2:y=520:box=1:boxcolor=0x00000066:boxborderw=12`,
    `drawtext=fontfile=${font}:text='${subtitle}':fontcolor=0x94A3B8:fontsize=32:x=(w-text_w)/2:y=720`,
    `drawtext=fontfile=${font}:text='${brand}':fontcolor=0x64748B:fontsize=28:x=(w-text_w)/2:y=h-120`,
  ].join(',')

  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=0x0f172a:s=1080x1920:r=30:d=${clipDuration.toFixed(2)}`,
      '-i',
      input.audioPath,
      '-vf',
      vf,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-shortest',
      '-movflags',
      '+faststart',
      input.outPath,
    ],
    { maxBuffer: 1024 * 1024 * 20 },
  )

  return input.outPath
}
