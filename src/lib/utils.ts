export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}.${ms}`
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function parseTimestamp(input: string): number | null {
  const cleaned = input.trim()
  if (!cleaned) return null
  if (/^\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned)
  const parts = cleaned.split(':').map(Number)
  if (parts.some((p) => Number.isNaN(p))) return null
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

export function downloadText(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function scoreClip(opts: {
  duration: number
  hasHook: boolean
  hasTitle: boolean
  hashtags: number
  hasCta: boolean
}): number {
  let score = 40
  const d = opts.duration
  if (d >= 12 && d <= 35) score += 25
  else if (d >= 8 && d <= 45) score += 15
  else if (d >= 5 && d <= 59) score += 5
  else score -= 10
  if (opts.hasHook) score += 12
  if (opts.hasTitle) score += 10
  if (opts.hashtags >= 3 && opts.hashtags <= 6) score += 8
  if (opts.hasCta) score += 5
  return clamp(score, 1, 99)
}
