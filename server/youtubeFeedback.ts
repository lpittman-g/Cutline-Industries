import { promises as fs } from 'node:fs'
import path from 'node:path'
import { google } from 'googleapis'
import { getAuthorizedClient } from './youtubeAuth.ts'
import { ROOT } from './youtubeAuth.ts'
import type { AudienceInput, FeedbackInsight, FeedbackReport } from './projectContent.ts'
import { PROJECT, PROJECT_TOPICS } from './projectContent.ts'

const FEEDBACK_PATH = path.join(ROOT, 'inbox', 'feedback_report.json')
const INPUTS_PATH = path.join(ROOT, 'inbox', 'audience_inputs.json')
const STATE_PATH = path.join(ROOT, 'ai-pipeline-state.json')

function engagementScore(views: number, likes: number, comments: number): number {
  return views + likes * 8 + comments * 15
}

async function loadUploadIds(): Promise<string[]> {
  const ids = new Set<string>()
  try {
    const state = JSON.parse(await fs.readFile(STATE_PATH, 'utf8')) as {
      processedTopics?: Record<string, { uploads?: string[] }>
    }
    for (const entry of Object.values(state.processedTopics ?? {})) {
      for (const id of entry.uploads ?? []) {
        if (id && !id.startsWith('dry_')) ids.add(id)
      }
    }
  } catch {
    // no state yet
  }

  try {
    const aiOut = path.join(ROOT, 'ai_out')
    const dirs = await fs.readdir(aiOut)
    for (const dir of dirs) {
      try {
        const manifest = JSON.parse(
          await fs.readFile(path.join(aiOut, dir, 'manifest.json'), 'utf8'),
        ) as { uploads?: string[] }
        for (const id of manifest.uploads ?? []) {
          if (id && !id.startsWith('dry_')) ids.add(id)
        }
      } catch {
        // skip
      }
    }
  } catch {
    // no ai_out
  }

  return [...ids]
}

async function loadAudienceInputs(): Promise<AudienceInput[]> {
  try {
    return JSON.parse(await fs.readFile(INPUTS_PATH, 'utf8')) as AudienceInput[]
  } catch {
    return []
  }
}

export async function saveAudienceInput(message: string, source: AudienceInput['source'] = 'api') {
  const inputs = await loadAudienceInputs()
  const row: AudienceInput = {
    id: `input_${Date.now()}`,
    message: message.trim().slice(0, 500),
    source,
    at: new Date().toISOString(),
  }
  if (!row.message) throw new Error('Empty feedback message')
  inputs.push(row)
  await fs.mkdir(path.dirname(INPUTS_PATH), { recursive: true })
  await fs.writeFile(INPUTS_PATH, JSON.stringify(inputs.slice(-100), null, 2))
  return row
}

export async function runFeedbackLoop(): Promise<FeedbackReport> {
  const uploadIds = await loadUploadIds()
  const audienceInputs = await loadAudienceInputs()
  const insights: FeedbackInsight[] = []

  if (uploadIds.length) {
    const auth = await getAuthorizedClient()
    const youtube = google.youtube({ version: 'v3', auth })

    const videoRes = await youtube.videos.list({
      part: ['snippet', 'statistics'],
      id: uploadIds.slice(0, 50),
    })

    for (const video of videoRes.data.items ?? []) {
      const views = Number(video.statistics?.viewCount ?? 0)
      const likes = Number(video.statistics?.likeCount ?? 0)
      const comments = Number(video.statistics?.commentCount ?? 0)
      insights.push({
        videoId: video.id ?? '',
        title: video.snippet?.title ?? '',
        views,
        likes,
        comments,
        score: engagementScore(views, likes, comments),
      })
    }

    insights.sort((a, b) => b.score - a.score)

    for (const insight of insights.slice(0, 5)) {
      if (!insight.videoId || insight.comments === 0) continue
      try {
        const commentRes = await youtube.commentThreads.list({
          part: ['snippet'],
          videoId: insight.videoId,
          maxResults: 3,
          order: 'relevance',
        })
        const top = commentRes.data.items?.[0]?.snippet?.topLevelComment?.snippet?.textDisplay
        if (top) insight.topComment = top.slice(0, 200)
      } catch {
        // comments disabled or quota
      }
    }
  }

  const winningTitles = insights.slice(0, 3).map((i) => i.title).filter(Boolean)
  const winningHooks = winningTitles.map((t) => t.split('|')[0]?.trim() ?? t).slice(0, 3)
  const commentRequests = [
    ...insights.map((i) => i.topComment).filter(Boolean) as string[],
    ...audienceInputs.map((i) => i.message),
  ].slice(0, 10)

  const processedTopicIds = new Set<string>()
  try {
    const state = JSON.parse(await fs.readFile(STATE_PATH, 'utf8')) as {
      processedTopics?: Record<string, { topicId?: string }>
    }
    for (const entry of Object.values(state.processedTopics ?? {})) {
      if (entry.topicId) processedTopicIds.add(entry.topicId)
    }
  } catch {
    // no state
  }

  const nextTopics = PROJECT_TOPICS.filter((t) => !processedTopicIds.has(t.id))
    .slice(0, 3)
    .map((t) => t.title)

  if (!nextTopics.length) {
    nextTopics.push(...PROJECT_TOPICS.slice(0, 3).map((t) => t.title))
  }

  const report: FeedbackReport = {
    generated_at: new Date().toISOString(),
    insights,
    winning_hooks: winningHooks.length ? winningHooks : [
      `${PROJECT.product} turns chat velocity into revenue.`,
      `Visit ${PROJECT.site} to see the heat feed.`,
    ],
    winning_keywords: ['Thermal', 'Cutline', 'Shorts', 'streaming', 'monetization'],
    audience_requests: commentRequests,
    next_topic_suggestions: nextTopics,
  }

  await fs.mkdir(path.dirname(FEEDBACK_PATH), { recursive: true })
  await fs.writeFile(FEEDBACK_PATH, JSON.stringify(report, null, 2))
  return report
}

export async function loadFeedbackReport(): Promise<FeedbackReport | null> {
  try {
    return JSON.parse(await fs.readFile(FEEDBACK_PATH, 'utf8')) as FeedbackReport
  } catch {
    return null
  }
}
