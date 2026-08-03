import { google } from 'googleapis'
import { getAuthorizedClient } from './youtubeAuth.ts'

function encodeMime(input: string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function sendDevPitchEmail(input: {
  to: string
  subject: string
  body: string
}) {
  const sender = process.env.GOOGLE_WORKSPACE_SENDER_EMAIL?.trim()
  if (!sender) {
    return { skipped: true, reason: 'GOOGLE_WORKSPACE_SENDER_EMAIL not set' }
  }

  const auth = await getAuthorizedClient()
  const gmail = google.gmail({ version: 'v1', auth })
  const raw = [
    `From: Cutline Industries <${sender}>`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    input.body,
  ].join('\r\n')

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodeMime(raw) },
  })
  return { ok: true, messageId: result.data.id ?? null }
}
