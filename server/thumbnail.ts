import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function extractThumbnail(videoPath: string, outPath: string, atSec = 1) {
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await execFileAsync('ffmpeg', [
    '-y',
    '-ss',
    String(atSec),
    '-i',
    videoPath,
    '-frames:v',
    '1',
    '-vf',
    'scale=640:360:force_original_aspect_ratio=increase,crop=640:360',
    outPath,
  ])
  return outPath
}

export async function watermarkVideo(inputPath: string, outPath: string, label = 'THERMAL') {
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-i',
      inputPath,
      '-vf',
      `drawtext=text='${label}':fontcolor=white@0.7:fontsize=28:x=(w-text_w-24):y=(h-text_h-24):box=1:boxcolor=0x00000088`,
      '-c:a',
      'copy',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-movflags',
      '+faststart',
      outPath,
    ],
    { maxBuffer: 1024 * 1024 * 20 },
  )
  return outPath
}
