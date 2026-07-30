import type { Clip, Project } from '../types'
import { formatClock } from './utils'

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 48)
}

export function clipsToJson(project: Project, clips: Clip[]): string {
  return JSON.stringify(
    {
      project: {
        id: project.id,
        name: project.name,
        game: project.game,
        niche: project.niche,
        vodFileName: project.vodFileName,
      },
      exportedAt: new Date().toISOString(),
      clips: clips.map((c) => ({
        id: c.id,
        label: c.label,
        start: c.start,
        end: c.end,
        duration: Number((c.end - c.start).toFixed(2)),
        title: c.title,
        hook: c.hook,
        description: c.description,
        hashtags: c.hashtags,
        cta: c.cta,
        score: c.score,
        status: c.status,
      })),
    },
    null,
    2,
  )
}

export function clipsToCsv(clips: Clip[]): string {
  const header = [
    'id',
    'label',
    'start',
    'end',
    'duration',
    'title',
    'hook',
    'cta',
    'hashtags',
    'score',
    'status',
  ]
  const rows = clips.map((c) =>
    [
      c.id,
      csvEscape(c.label),
      c.start.toFixed(2),
      c.end.toFixed(2),
      (c.end - c.start).toFixed(2),
      csvEscape(c.title),
      csvEscape(c.hook),
      csvEscape(c.cta),
      csvEscape(c.hashtags.join(' ')),
      String(c.score),
      c.status,
    ].join(','),
  )
  return [header.join(','), ...rows].join('\n')
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function clipsToFfmpegScript(project: Project, clips: Clip[]): string {
  const input = project.vodFileName || 'input.mp4'
  const lines = [
    '#!/usr/bin/env bash',
    `# CUTLINE export — ${project.name}`,
    `# Game: ${project.game}`,
    'set -euo pipefail',
    'mkdir -p shorts_out',
    '',
  ]
  clips.forEach((c, i) => {
    const out = `shorts_out/${String(i + 1).padStart(2, '0')}_${safeName(c.label || c.title)}.mp4`
    const duration = (c.end - c.start).toFixed(2)
    lines.push(`# ${c.title}`)
    lines.push(
      `ffmpeg -y -ss ${c.start.toFixed(2)} -i "${input}" -t ${duration} -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -c:v libx264 -c:a aac -movflags +faststart "${out}"`,
    )
    lines.push('')
  })
  lines.push('echo "Done — check shorts_out/"')
  return lines.join('\n')
}

export function clipsToYoutubeDraft(clips: Clip[]): string {
  return clips
    .map((c, i) => {
      return [
        `=== SHORT ${i + 1}: ${c.label} ===`,
        `TIMECODE: ${formatClock(c.start)} → ${formatClock(c.end)} (${(c.end - c.start).toFixed(1)}s)`,
        `TITLE: ${c.title}`,
        `HOOK: ${c.hook}`,
        `CTA: ${c.cta}`,
        `HASHTAGS: ${c.hashtags.join(' ')}`,
        '',
        'DESCRIPTION:',
        c.description,
        '',
        '---',
        '',
      ].join('\n')
    })
    .join('\n')
}

export function clipsToChapters(clips: Clip[]): string {
  return clips
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((c) => `${formatClock(c.start)} ${c.title}`)
    .join('\n')
}
