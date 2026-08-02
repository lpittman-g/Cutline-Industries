import { google } from 'googleapis'
import { getAuthorizedClient, SECRET_PATH, TOKEN_PATH } from './youtubeAuth.ts'
import { promises as fs } from 'node:fs'

/** Google Cloud / Google APIs Cutline uses. */
export const GOOGLE_APIS = [
  {
    id: 'youtube-data-v3',
    name: 'YouTube Data API v3',
    consoleUrl: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
    required: true,
    purpose: 'Upload Shorts + read channel metadata for Autopilot',
  },
  {
    id: 'adsense',
    name: 'AdSense (site tag)',
    consoleUrl: 'https://www.google.com/adsense',
    required: false,
    purpose: 'Display ads on cutline-industries.studio via ca-pub client',
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    consoleUrl: 'https://analytics.google.com',
    required: false,
    purpose: 'Traffic measurement via gtag measurement ID',
  },
] as const

export async function getGoogleCloudStatus() {
  let hasSecret = false
  let hasToken = false
  let clientId: string | null = null
  let projectHint: string | null = process.env.GOOGLE_CLOUD_PROJECT || null

  try {
    await fs.access(SECRET_PATH)
    hasSecret = true
    const raw = JSON.parse(await fs.readFile(SECRET_PATH, 'utf8')) as {
      web?: { client_id?: string; project_id?: string }
      installed?: { client_id?: string; project_id?: string }
    }
    const cfg = raw.web ?? raw.installed
    clientId = cfg?.client_id ?? null
    projectHint = projectHint || cfg?.project_id || null
  } catch {
    hasSecret = false
  }

  try {
    await fs.access(TOKEN_PATH)
    hasToken = true
  } catch {
    hasToken = false
  }

  return {
    brand: 'Cutline Industries',
    accountEmailHint: 'lpittman@cutline-industries.studio',
    projectId: projectHint,
    oauth: {
      hasClientSecret: hasSecret,
      hasRefreshToken: hasToken,
      clientId,
      authorized: hasSecret && hasToken,
    },
    site: {
      domain: 'cutline-industries.studio',
      adsenseClient: process.env.VITE_ADSENSE_CLIENT || 'ca-pub-8439504069928032',
      analyticsId: process.env.VITE_GA_MEASUREMENT_ID || 'G-3JS2X6FP0T',
    },
    apis: GOOGLE_APIS,
    nextSteps: !hasSecret
      ? [
          'Create a Google Cloud project',
          'Enable YouTube Data API v3',
          'Create OAuth Web client + download client_secret.json into project root',
        ]
      : !hasToken
        ? [
            'Add OAuth test user (your Gmail / Workspace email)',
            'Authorize YouTube scopes in OAuth Playground',
            'POST refresh_token to /api/autopilot/token',
          ]
        : ['Google OAuth ready — call /api/google/youtube/channel to verify'],
  }
}

export async function getYoutubeChannel() {
  const auth = await getAuthorizedClient()
  const youtube = google.youtube({ version: 'v3', auth })
  const res = await youtube.channels.list({
    part: ['snippet', 'statistics', 'contentDetails'],
    mine: true,
  })
  const channel = res.data.items?.[0]
  if (!channel) {
    throw new Error('No YouTube channel found for this Google account')
  }
  return {
    id: channel.id,
    title: channel.snippet?.title,
    customUrl: channel.snippet?.customUrl,
    description: channel.snippet?.description,
    thumbnails: channel.snippet?.thumbnails,
    stats: channel.statistics,
  }
}
