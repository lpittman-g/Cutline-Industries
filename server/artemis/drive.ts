import { google } from 'googleapis'
import { getAuthorizedClient } from '../youtubeAuth.ts'
import { ingestArtemisUpload, type UploadResult } from './upload.ts'

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'utility-mapper-504300-d6'

export type DriveCatalogEntry = {
  id: string
  title: string
  mimeType: string
  viewUrl: string
  text: string
}

/** Google Docs already pulled from Drive (Cutline Workspace). Live list merges on top when OAuth is ready. */
export const DRIVE_CATALOG: DriveCatalogEntry[] = [
  {
    id: '1QemEoruVRs34TEU6j8CFnRI2ZgP1qyVINSGAYh-RvK0',
    title: 'Privacy Policy — Lisa (Cutline Industries)',
    mimeType: 'application/vnd.google-apps.document',
    viewUrl: 'https://docs.google.com/document/d/1QemEoruVRs34TEU6j8CFnRI2ZgP1qyVINSGAYh-RvK0/edit',
    text: `Privacy Policy — Lisa (Cutline Industries)
Package: studio.cutlineindustries.lisa
Effective date: August 25, 2026

Cutline Industries ("Cutline," "we," "us") operates the Lisa Android application.

1. What Lisa does
Lisa is an AI chat assistant. Messages you send are transmitted to Cutline's servers and processed by our AI provider (Microsoft Azure AI Foundry) so Lisa can respond.

2. Data we process
Chat messages and prompts you enter. Basic technical logs needed to run the service. We do not require an account for the basic chat experience. Do not send passwords, payment card numbers, or highly sensitive personal data in chat.

3. Why we process it
To provide Lisa's answers, improve reliability, secure the service, and respond to support requests.

4. Sharing
We use service providers that process data on our behalf (including Microsoft Azure). We do not sell your personal information and do not use Lisa chat content for third-party advertising.

5. Retention
Chat and logs are retained only as long as needed to operate and secure the service, unless a longer period is required by law. You may request deletion by emailing lpittman@cutline-industries.studio.

6. Security
We use HTTPS and keep API keys on the server. No method of transmission is 100% secure.

7. Children
Lisa is not directed at children under 13. We do not knowingly collect data from children.

8. Your choices
You can stop using the app at any time. For access, correction, or deletion requests, email lpittman@cutline-industries.studio.

9. Changes
We may update this policy. The effective date above will change when we do.

10. Contact
Cutline Industries
Lamont Pittman, CEO
lpittman@cutline-industries.studio
`,
  },
  {
    id: '18wbHy5Sq76dCorOHvAvGzMsFfwtP6zg4LBNezVjMEyM',
    title: 'Lisa Privacy Policy — Cutline (Play Console)',
    mimeType: 'application/vnd.google-apps.document',
    viewUrl: 'https://docs.google.com/document/d/18wbHy5Sq76dCorOHvAvGzMsFfwtP6zg4LBNezVjMEyM/edit',
    text: `Privacy Policy — Lisa
Effective: August 25, 2026 · studio.cutlineindustries.lisa

Cutline Industries operates the Lisa Android app. Messages are sent to Cutline servers and Microsoft Azure AI Foundry to generate responses.

Data we process: chat messages and basic technical logs. Do not send passwords or payment data in chat.
Sharing: service providers including Microsoft Azure. We do not sell your data or use chat for ads.
Contact: lpittman@cutline-industries.studio
`,
  },
]

export function getDriveCatalogEntry(id: string): DriveCatalogEntry | undefined {
  return DRIVE_CATALOG.find((entry) => entry.id === id)
}

export async function tryListLiveDriveFiles(): Promise<{ connected: boolean; files: { id: string; title: string; mimeType: string }[] }> {
  try {
    const auth = await getAuthorizedClient()
    const drive = google.drive({ version: 'v3', auth })
    const res = await drive.files.list({
      pageSize: 12,
      fields: 'files(id,name,mimeType,webViewLink)',
      q: "trashed = false and mimeType != 'application/vnd.google-apps.folder'",
      orderBy: 'viewedByMeTime desc',
    })
    const files = (res.data.files ?? [])
      .filter((file) => file.id && file.name)
      .map((file) => ({
        id: file.id as string,
        title: file.name as string,
        mimeType: file.mimeType || 'application/octet-stream',
      }))
    return { connected: true, files }
  } catch {
    return { connected: false, files: [] }
  }
}

export async function getDriveStatus() {
  const live = await tryListLiveDriveFiles()
  const catalog = DRIVE_CATALOG.map((entry) => ({
    id: entry.id,
    title: entry.title,
    mimeType: entry.mimeType,
    viewUrl: entry.viewUrl,
    source: 'catalog' as const,
  }))
  const seen = new Set(catalog.map((row) => row.id))
  const liveFiles = live.files
    .filter((file) => !seen.has(file.id))
    .map((file) => ({ ...file, viewUrl: `https://drive.google.com/file/d/${file.id}/view`, source: 'live' as const }))
  return {
    projectId: PROJECT,
    connected: live.connected,
    source: live.connected ? 'google-drive' : 'catalog',
    files: [...catalog, ...liveFiles],
  }
}

export async function importDriveFile(id: string): Promise<UploadResult> {
  const catalog = getDriveCatalogEntry(id)
  let title = catalog?.title
  let text = catalog?.text
  if (!text) {
    try {
      const auth = await getAuthorizedClient()
      const drive = google.drive({ version: 'v3', auth })
      const meta = await drive.files.get({ fileId: id, fields: 'id,name,mimeType' })
      title = meta.data.name || title || id
      const exported = await drive.files.export({ fileId: id, mimeType: 'text/plain' }, { responseType: 'text' })
      text = typeof exported.data === 'string' ? exported.data : ''
    } catch {
      text = ''
    }
  }
  if (!title || !text?.trim()) {
    throw new Error('Drive file is not available for import. Authorize Google Drive or use a catalog doc.')
  }
  return ingestArtemisUpload({
    name: `${title}.txt`,
    mimeType: 'text/plain',
    buffer: Buffer.from(text, 'utf8'),
    source: 'quiver',
  })
}
