import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function bucket() {
  return process.env.AWS_S3_BUCKET_NAME?.trim() || ''
}

export function s3Configured() {
  return Boolean(
    bucket() &&
      process.env.AWS_REGION?.trim() &&
      process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim(),
  )
}

function client() {
  if (!s3Configured()) throw new Error('AWS S3 storage is not configured')
  return new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
}

function contentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  return 'application/octet-stream'
}

function publicUrl(key: string) {
  const cdn = process.env.AWS_CLOUDFRONT_DOMAIN?.trim().replace(/\/$/, '')
  if (cdn) return `${cdn}/${key}`
  return `https://${bucket()}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
}

export async function uploadFile(input: {
  filePath: string
  key: string
  publicRead?: boolean
}) {
  const file = await stat(input.filePath)
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: input.key,
      Body: createReadStream(input.filePath),
      ContentLength: file.size,
      ContentType: contentType(input.filePath),
      CacheControl: input.publicRead ? 'public, max-age=31536000, immutable' : 'private, no-store',
    }),
  )
  return {
    key: input.key,
    uri: `s3://${bucket()}/${input.key}`,
    url: input.publicRead ? publicUrl(input.key) : null,
  }
}

/**
 * Upload a local MP4 preview and return its CloudFront URL when configured,
 * otherwise the regional S3 URL. The bucket/prefix must be readable by the
 * CDN or bucket policy for the returned URL to be publicly accessible.
 */
export async function uploadClipToS3(filePath: string, s3Key: string): Promise<string> {
  const uploaded = await uploadFile({
    filePath,
    key: s3Key,
    publicRead: true,
  })
  if (!uploaded.url) throw new Error('S3 upload completed without a public URL')
  return uploaded.url
}

export async function uploadThermalClipAssets(input: {
  spikeId: number
  cleanPath: string
  watermarkedPath: string
  thumbnailPath: string
}) {
  const prefix = `thermal/clips/${input.spikeId}`
  const [clean, watermarked, thumbnail] = await Promise.all([
    uploadFile({
      filePath: input.cleanPath,
      key: `${prefix}/clean.mp4`,
      publicRead: false,
    }),
    uploadFile({
      filePath: input.watermarkedPath,
      key: `${prefix}/preview.mp4`,
      publicRead: true,
    }),
    uploadFile({
      filePath: input.thumbnailPath,
      key: `${prefix}/thumb.jpg`,
      publicRead: true,
    }),
  ])
  return { clean, watermarked, thumbnail }
}

export function keyFromS3Uri(uri: string) {
  const prefix = `s3://${bucket()}/`
  return uri.startsWith(prefix) ? uri.slice(prefix.length) : null
}

export async function createPrivateDownloadUrl(s3Uri: string, expiresIn = 900) {
  const key = keyFromS3Uri(s3Uri)
  if (!key) throw new Error('Clip clean asset is not stored in configured S3 bucket')
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: 'attachment; filename="thermal-clean-clip.mp4"',
    }),
    { expiresIn },
  )
}
