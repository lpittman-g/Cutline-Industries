import dotenv from 'dotenv'
import { ROOT } from './youtubeAuth.ts'

dotenv.config({ path: `${ROOT}/.env` })

export async function notifyDiscordHeat(opts: {
  streamer: string
  msgPerMin: number
  spikeId: number
}) {
  const webhook = process.env.DISCORD_HEAT_WEBHOOK_URL?.trim()
  if (!webhook) return { skipped: true, reason: 'DISCORD_HEAT_WEBHOOK_URL not set' }

  const base = process.env.CUTLINE_PUBLIC_URL || 'https://cutline-industries.studio'
  const body = {
    content: `🔥 **HEAT DETECTED** · @${opts.streamer} · ${opts.msgPerMin} msg/min · spike #${opts.spikeId}`,
    embeds: [
      {
        title: 'Thermal clip pipeline',
        description: `Processing clip → [Mission Control](${base}/app/clips)`,
        color: 0xff6b35,
      },
    ],
  }

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Discord webhook ${res.status}`)
  return { ok: true }
}

export async function sendDiscordClipDrop(opts: {
  streamer: string
  game: string
  message: string
  previewUrl: string
  checkoutUrl: string
}) {
  const webhook = process.env.DISCORD_HEAT_WEBHOOK_URL?.trim()
  if (!webhook) return { skipped: true, reason: 'DISCORD_HEAT_WEBHOOK_URL not set' }

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `🔥 **HEAT SPIKE · @${opts.streamer}**\n${opts.message}\n\n👉 [Unlock clean clip ($15)](${opts.checkoutUrl})`,
      embeds: [
        {
          title: `${opts.game} · Thermal preview`,
          url: opts.previewUrl,
          description: `[Watch watermarked preview](${opts.previewUrl})`,
          color: 0xff6b35,
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Discord clip drop webhook ${res.status}`)
  return { ok: true }
}
