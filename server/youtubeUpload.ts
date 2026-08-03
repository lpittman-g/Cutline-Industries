import { createReadStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { google } from 'googleapis'
import { getAuthorizedClient } from './youtubeAuth.ts'
import type { PlannedClip } from './planClips.ts'

export async function uploadShort(opts: {
  filePath: string
  clip: PlannedClip
  privacyStatus?: 'private' | 'unlisted' | 'public'
  dryRun?: boolean
}) {
  if (opts.dryRun) {
    return {
      dryRun: true as const,
      id: `dry_${path.basename(opts.filePath)}`,
      title: opts.clip.title,
    }
  }

  const auth = await getAuthorizedClient()
  const youtube = google.youtube({ version: 'v3', auth })
  const tags = opts.clip.tags.slice(0, 10)
  const description = `${opts.clip.description}\n\n#Shorts`

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: opts.clip.title.slice(0, 100),
        description: description.slice(0, 5000),
        tags,
        categoryId: '28', // Science & Technology
      },
      status: {
        privacyStatus: opts.privacyStatus ?? 'private',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: createReadStream(opts.filePath),
    },
  })

  return {
    dryRun: false as const,
    id: res.data.id,
    title: opts.clip.title,
    url: res.data.id ? `https://youtube.com/shorts/${res.data.id}` : null,
  }
}

export async function moveToUploaded(filePath: string, uploadedDir: string) {
  await fs.mkdir(uploadedDir, { recursive: true })
  const dest = path.join(uploadedDir, path.basename(filePath))
  try {
    await fs.rename(filePath, dest)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      try {
        await fs.access(dest)
        return dest
      } catch {
        // source gone and dest missing — upload already succeeded, skip move
        return dest
      }
    }
    throw err
  }
  return dest
}
