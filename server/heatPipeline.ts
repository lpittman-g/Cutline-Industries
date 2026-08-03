import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ROOT } from './youtubeAuth.ts'
import { cutVerticalShort, probeDuration } from './ffmpegCut.ts'
import { extractThumbnail, watermarkVideo } from './thumbnail.ts'
import {
  getHeatSpike,
  getStreamerById,
  insertClip,
  updateHeatSpikeStatus,
} from './db/thermalRepo.ts'
import type { PlannedClip } from './planClips.ts'
import { s3Configured, uploadThermalClipAssets } from './s3Storage.ts'
import { processHeatSpikeAutopilot } from './thermalHeatAutopilot.ts'

const MEDIA_ROOT = path.join(ROOT, 'thermal_media')
const DEFAULT_VOD = path.join(ROOT, 'inbox', 'cutline_test_vod.mp4')

async function resolveVodUrl(spike: { vod_url: string | null }, streamerId: number | null) {
  if (spike.vod_url) return spike.vod_url
  if (streamerId) {
    const streamer = await getStreamerById(streamerId)
    if (streamer?.vod_fallback_url) return streamer.vod_fallback_url
  }
  try {
    await fs.access(DEFAULT_VOD)
    return DEFAULT_VOD
  } catch {
    throw new Error('No VOD available for clip render (set vod_url on spike or add inbox/cutline_test_vod.mp4)')
  }
}

function buildHeatClipPlan(duration: number, title: string): PlannedClip {
  const clipSeconds = Number(process.env.THERMAL_CLIP_SECONDS || 22)
  const start = Math.max(5, Math.min(duration * 0.35, duration - clipSeconds - 1))
  const end = Math.min(start + clipSeconds, duration - 0.25)
  return {
    label: 'heat_clip',
    start: Number(start.toFixed(2)),
    end: Number(end.toFixed(2)),
    title: title.slice(0, 95),
    hook: title,
    description: title,
    tags: ['Thermal', 'Shorts'],
    cta: 'Unlock on Thermal',
  }
}

export async function processHeatSpikeToClip(spikeId: number) {
  const spike = await getHeatSpike(spikeId)
  if (!spike) throw new Error(`Heat spike ${spikeId} not found`)

  await updateHeatSpikeStatus(spikeId, 'processing')

  try {
    const streamer = spike.streamer_id ? await getStreamerById(spike.streamer_id) : null
    const username = streamer?.username ?? spike.streamer_username ?? 'streamer'
    const game = spike.game ?? streamer?.game ?? 'Live'
    const title =
      spike.title ??
      `Heat clip — ${username} (${spike.msg_per_min} msg/min)`

    const vodPath = await resolveVodUrl(spike, spike.streamer_id)
    const duration = await probeDuration(vodPath)
    const plan = buildHeatClipPlan(duration, title)

    const outDir = path.join(MEDIA_ROOT, 'clips', String(spikeId))
    const cleanPath = await cutVerticalShort(vodPath, plan, outDir)
    const watermarkedPath = path.join(outDir, 'heat_clip_wm.mp4')
    await watermarkVideo(cleanPath, watermarkedPath, 'THERMAL · PREVIEW')

    const thumbPath = path.join(outDir, 'thumb.jpg')
    await extractThumbnail(cleanPath, thumbPath, 1)

    let mediaUrl = `/thermal-media/clips/${spikeId}/heat_clip_wm.mp4`
    let thumbUrl = `/thermal-media/clips/${spikeId}/thumb.jpg`
    let cleanAsset = cleanPath
    let watermarkedAsset = watermarkedPath

    if (s3Configured()) {
      const assets = await uploadThermalClipAssets({
        spikeId,
        cleanPath,
        watermarkedPath,
        thumbnailPath: thumbPath,
      })
      mediaUrl = assets.watermarked.url ?? mediaUrl
      thumbUrl = assets.thumbnail.url ?? thumbUrl
      cleanAsset = assets.clean.uri
      watermarkedAsset = assets.watermarked.uri
    }

    const clip = await insertClip({
      spike_id: spikeId,
      title: plan.title,
      duration_sec: Math.round(plan.end - plan.start),
      game,
      streamer_username: username,
      thumbnail_url: thumbUrl,
      media_url: mediaUrl,
      s3_watermarked_url: watermarkedAsset,
      s3_clean_url: cleanAsset,
      tier: 'gateway',
      price_usd: 15,
    })

    await updateHeatSpikeStatus(spikeId, 'rendered')
    const autopilot = await processHeatSpikeAutopilot({
      spikeId,
      clipId: clip.id,
      streamerId: spike.streamer_id ?? 0,
      streamerName: username,
      gameTitle: game,
      msgPerMin: spike.msg_per_min,
      clipTitle: plan.title,
      previewUrl: mediaUrl,
    }).catch((err) => ({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }))
    return { spike, clip, autopilot, paths: { cleanPath, watermarkedPath, thumbPath } }
  } catch (err) {
    await updateHeatSpikeStatus(spikeId, 'failed')
    throw err
  }
}

export async function triggerHeatEvent(opts: {
  streamerId: number
  msgPerMin?: number
  vodUrl?: string | null
  title?: string
}) {
  const { insertHeatSpike } = await import('./db/thermalRepo.ts')
  const streamer = await getStreamerById(opts.streamerId)
  if (!streamer) throw new Error('Streamer not found')

  const spike = await insertHeatSpike({
    streamer_id: opts.streamerId,
    msg_per_min: opts.msgPerMin ?? Math.max(streamer.current_msg_per_min, 150),
    vod_url: opts.vodUrl ?? streamer.vod_fallback_url,
    title: opts.title ?? `Heat on @${streamer.username}`,
    game: streamer.game,
  })

  const { notifyDiscordHeat } = await import('./discordNotify.ts')
  await notifyDiscordHeat({
    streamer: streamer.username,
    msgPerMin: spike.msg_per_min,
    spikeId: spike.id,
  }).catch(() => undefined)

  const result = await processHeatSpikeToClip(spike.id)
  return result
}
