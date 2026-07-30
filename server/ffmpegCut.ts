import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import type { PlannedClip } from './planClips.ts'

const execFileAsync = promisify(execFile)

export async function probeDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ])
  const n = Number(stdout.trim())
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Could not read duration for ${filePath}`)
  return n
}

export async function cutVerticalShort(
  inputPath: string,
  clip: PlannedClip,
  outDir: string,
): Promise<string> {
  await fs.mkdir(outDir, { recursive: true })
  const safe = clip.label.replace(/[^a-zA-Z0-9._-]+/g, '_')
  const outPath = path.join(outDir, `${safe}.mp4`)
  const duration = Math.max(clip.end - clip.start, 1)

  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-ss',
      String(clip.start),
      '-i',
      inputPath,
      '-t',
      String(duration),
      '-vf',
      'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30',
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
      '-movflags',
      '+faststart',
      outPath,
    ],
    { maxBuffer: 1024 * 1024 * 20 },
  )

  return outPath
}
