/**
 * RFC 6238 TOTP implementation using Node.js built-in crypto.
 * No external dependencies.
 */
import { createHmac, randomBytes } from 'crypto'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

export function totpUri(secret: string, email: string): string {
  const label = encodeURIComponent(`Artemis:${email}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=Artemis&algorithm=SHA1&digits=6&period=30`
}

/** Returns true if token matches within ±1 time step (30 s) for clock drift. */
export function verifyTotp(secret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false
  const step = Math.floor(Date.now() / 30_000)
  for (const delta of [-1, 0, 1]) {
    if (hotp(secret, step + delta) === token) return true
  }
  return false
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret)
  const msg = Buffer.alloc(8)
  // counter as 8-byte big-endian (counter fits in lower 32 bits for decades)
  msg.writeUInt32BE(0, 0)
  msg.writeUInt32BE(counter >>> 0, 4)
  const digest = createHmac('sha1', key).update(msg).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  return String(code % 1_000_000).padStart(6, '0')
}

function base32Encode(buf: Uint8Array): string {
  let result = ''
  let bits = 0
  let value = 0
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      result += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) result += BASE32[(value << (5 - bits)) & 31]
  return result
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '')
  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const char of clean) {
    const idx = BASE32.indexOf(char)
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}
