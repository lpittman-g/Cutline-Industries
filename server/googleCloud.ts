import { google } from 'googleapis'
import {
  getAuthorizedClient,
  GOOGLE_OAUTH_SCOPES,
  SECRET_PATH,
  TOKEN_PATH,
} from './youtubeAuth.ts'
import { promises as fs } from 'node:fs'

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'utility-mapper-504300-d6'

/** Console deep-links for one-time OAuth setup. */
export const GOOGLE_SETUP_LINKS = {
  oauthCredentials: `https://console.cloud.google.com/apis/credentials?project=${PROJECT}`,
  oauthConsentScreen: `https://console.cloud.google.com/apis/credentials/consent?project=${PROJECT}`,
  enableYoutubeDataApi: `https://console.cloud.google.com/apis/library/youtube.googleapis.com?project=${PROJECT}`,
  enableGmailApi: `https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=${PROJECT}`,
  oauthPlayground: 'https://developers.google.com/oauthplayground/',
  docs: 'docs/GOOGLE-OAUTH.md',
} as const

/** Google Cloud / Google APIs Cutline uses. */
export const GOOGLE_APIS = [
  {
    id: 'youtube-data-v3',
    name: 'YouTube Data API v3',
    consoleUrl: GOOGLE_SETUP_LINKS.enableYoutubeDataApi,
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
  {
    id: 'gmail-send',
    name: 'Gmail API (send only)',
    consoleUrl: GOOGLE_SETUP_LINKS.enableGmailApi,
    required: true,
    purpose: 'Send Thermal sample pitch emails from Google Workspace',
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

  const senderEmail =
    process.env.GOOGLE_WORKSPACE_SENDER_EMAIL?.trim() || 'lpittman@cutline-industries.studio'

  return {
    brand: 'Cutline Industries',
    accountEmailHint: senderEmail,
    projectId: projectHint || PROJECT,
    env: {
      GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || null,
      GOOGLE_WORKSPACE_SENDER_EMAIL: process.env.GOOGLE_WORKSPACE_SENDER_EMAIL || null,
    },
    secrets: {
      clientSecretPath: 'client_secret.json',
      tokenPath: 'token.json',
      hasClientSecret: hasSecret,
      hasToken,
    },
    oauth: {
      hasClientSecret: hasSecret,
      hasRefreshToken: hasToken,
      clientId,
      authorized: hasSecret && hasToken,
      scopes: [...GOOGLE_OAUTH_SCOPES],
    },
    links: GOOGLE_SETUP_LINKS,
    site: {
      domain: 'cutline-industries.studio',
      adsenseClient: process.env.VITE_ADSENSE_CLIENT || 'ca-pub-8439504069928032',
      analyticsId: process.env.VITE_GA_MEASUREMENT_ID || 'G-3JS2X6FP0T',
    },
    apis: GOOGLE_APIS,
    nextSteps: !hasSecret
      ? [
          `Open project ${PROJECT} in Google Cloud Console`,
          'Enable YouTube Data API v3 and Gmail API',
          'Create OAuth Web client + download client_secret.json into project root',
          'Set GOOGLE_CLOUD_PROJECT and GOOGLE_WORKSPACE_SENDER_EMAIL in .env',
        ]
      : !hasToken
        ? [
            `Add OAuth test user (${senderEmail})`,
            'Authorize YouTube + Gmail scopes (youtube, youtube.upload, gmail.send)',
            'Exchange code via /api/google/oauth/exchange or paste refresh_token on Autopilot',
            'Save token.json (gitignored)',
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
