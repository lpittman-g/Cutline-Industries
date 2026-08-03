import OpenAI from 'openai'
import {
  findRetainerByGameTitle,
  getClipById,
  getHeatSpike,
  queueBountyPost,
  updateClipAutopilot,
  updateRetainer,
} from './db/thermalRepo.ts'
import { sendDevPitchEmail } from './devPitchEmail.ts'
import { sendDiscordClipDrop } from './discordNotify.ts'

export type ThermalAutopilotCopy = {
  discordHypeMessage: string
  xCaption: string
  tiktokCaption: string
  devEmailSubject: string
  devEmailBody: string
}

export function buildFallbackCopy(input: {
  streamerName: string
  gameTitle: string
  msgPerMin: number
}): ThermalAutopilotCopy {
  return {
    discordHypeMessage: `Chat hit ${input.msgPerMin} messages/min while you played ${input.gameTitle}. Thermal cut the moment while it was hot.`,
    xCaption: `Chat exploded during @${input.streamerName}'s ${input.gameTitle} run 🔥 #Gaming #IndieGames #Shorts`,
    tiktokCaption: `${input.gameTitle} heat check — @${input.streamerName} chat went wild. #fyp #gaming #indiegames #shorts`,
    devEmailSubject: `${input.gameTitle} creator heat → wishlist-ready Shorts`,
    devEmailBody: `Thermal detected a high-engagement moment from @${input.streamerName} playing ${input.gameTitle}. We turn creator reactions into vertical ad cuts designed for TikTok and YouTube Shorts, with a clear Steam wishlist call to action. Would you like a monthly creator gameplay pack?`,
  }
}

export function normalizeAutopilotCopy(
  value: unknown,
  fallback: ThermalAutopilotCopy,
): ThermalAutopilotCopy {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const text = (key: keyof ThermalAutopilotCopy) =>
    typeof row[key] === 'string' && String(row[key]).trim()
      ? String(row[key]).trim()
      : fallback[key]
  return {
    discordHypeMessage: text('discordHypeMessage'),
    xCaption: text('xCaption'),
    tiktokCaption: text('tiktokCaption'),
    devEmailSubject: text('devEmailSubject'),
    devEmailBody: text('devEmailBody'),
  }
}

async function generateCopy(input: {
  streamerName: string
  gameTitle: string
  msgPerMin: number
  clipTitle: string
}) {
  const fallback = buildFallbackCopy(input)
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return {
      copy: fallback,
      source: 'fallback' as const,
      warning: 'OPENAI_API_KEY not set',
    }
  }

  try {
    const openai = new OpenAI({ apiKey })
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_THERMAL_MODEL?.trim() || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are Thermal AI, Cutline Industries’ gaming media director. Return strict JSON only. Do not invent performance results or endorsements.',
        },
        {
          role: 'user',
          content: `Streamer: ${input.streamerName}
Game: ${input.gameTitle}
Heat: ${input.msgPerMin} messages/min
Clip title: ${input.clipTitle}

Return JSON string keys:
- discordHypeMessage: energetic but factual heat alert
- xCaption: short X/Twitter caption with 2-4 relevant hashtags
- tiktokCaption: short TikTok caption with 2-4 relevant hashtags (can differ from xCaption)
- devEmailSubject: concise indie developer outreach subject
- devEmailBody: short cold email about turning creator gameplay into vertical ads that support Steam wishlist campaigns`,
        },
      ],
    })
    const raw = response.choices[0]?.message.content
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      copy: normalizeAutopilotCopy(parsed, fallback),
      source: 'openai' as const,
      warning: null,
    }
  } catch (err) {
    return {
      copy: fallback,
      source: 'fallback' as const,
      warning: `openai: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Enriches an already-rendered Thermal clip. Rendering and S3 persistence stay
 * in heatPipeline; this stage owns AI copy and tier distribution.
 */
export async function processHeatSpikeAutopilot(input: {
  spikeId: number
  clipId: number
  streamerId: number
  streamerName: string
  gameTitle: string
  msgPerMin: number
  clipTitle: string
  previewUrl: string
}) {
  await updateClipAutopilot({ clipId: input.clipId, status: 'processing' })

  try {
    const { copy, source, warning } = await generateCopy(input)
    const base = (process.env.CUTLINE_PUBLIC_URL || 'https://cutline-industries.studio').replace(
      /\/$/,
      '',
    )
    const gatewayUrl = `${base}/checkout/${input.clipId}?tier=gateway`
    const previewUrl = input.previewUrl.startsWith('http')
      ? input.previewUrl
      : `${base}${input.previewUrl}`
    const warnings: string[] = []
    if (warning) warnings.push(warning)

    await sendDiscordClipDrop({
      streamer: input.streamerName,
      game: input.gameTitle,
      message: copy.discordHypeMessage,
      previewUrl,
      checkoutUrl: gatewayUrl,
    }).catch((err) => warnings.push(`discord: ${err instanceof Error ? err.message : String(err)}`))

    await Promise.all([
      queueBountyPost({ clip_id: input.clipId, platform: 'x', notes: copy.xCaption }),
      queueBountyPost({ clip_id: input.clipId, platform: 'tiktok', notes: copy.tiktokCaption }),
    ])

    const developer = await findRetainerByGameTitle(input.gameTitle)
    if (developer?.contact_email) {
      const result = await sendDevPitchEmail({
        to: developer.contact_email,
        subject: copy.devEmailSubject,
        body: `${copy.devEmailBody}\n\nWatermarked sample: ${previewUrl}\n\nCutline Industries · Thermal`,
      }).catch((err) => {
        warnings.push(`email: ${err instanceof Error ? err.message : String(err)}`)
        return null
      })
      if (result && 'ok' in result && result.ok) {
        await updateRetainer(developer.id, {
          status: 'sample_sent',
          sample_clip_id: input.clipId,
          notes: `Thermal autopilot pitch sent for ${input.gameTitle}`,
        })
      }
    }

    await updateClipAutopilot({
      clipId: input.clipId,
      status: 'completed',
      caption: copy.xCaption,
      tiktokCaption: copy.tiktokCaption,
      discordMessage: copy.discordHypeMessage,
      devEmailSubject: copy.devEmailSubject,
      devEmailBody: copy.devEmailBody,
      error: warnings.length ? warnings.join('; ') : null,
    })
    return { ok: true as const, copy, source, warnings }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await updateClipAutopilot({
      clipId: input.clipId,
      status: 'failed',
      error: message,
    })
    throw err
  }
}

/**
 * Re-run AI copy + distribution for an already-rendered clip (failed / pending /
 * completed). Does not re-cut FFmpeg or re-upload S3 assets.
 */
export async function rerunClipAutopilot(clipId: number) {
  const clip = await getClipById(clipId)
  if (!clip) throw new Error(`Clip ${clipId} not found`)
  if (!clip.media_url) {
    throw new Error('Clip must have rendered media before Thermal autopilot can run')
  }

  const spike = clip.spike_id ? await getHeatSpike(clip.spike_id) : null
  return processHeatSpikeAutopilot({
    spikeId: clip.spike_id ?? 0,
    clipId: clip.id,
    streamerId: spike?.streamer_id ?? 0,
    streamerName: clip.streamer_username ?? spike?.streamer_username ?? 'streamer',
    gameTitle: clip.game ?? spike?.game ?? 'Live',
    msgPerMin: spike?.msg_per_min ?? 0,
    clipTitle: clip.title ?? `Clip #${clip.id}`,
    previewUrl: clip.media_url,
  })
}
