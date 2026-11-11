import { createHash } from 'node:crypto'
import type { VideoTemplateRelease } from './gallery'

/** Deterministic Batch 9A first-party WAV (shared by browser preview and server provisioning). */
export function buildBatch9aGrooveV2Wav(
  music: NonNullable<VideoTemplateRelease['defaultMusic']>,
): Buffer {
  if (music.generator !== 'batch9a-groove-v2') throw new Error('Unsupported first-party soundtrack generator')
  const sr = 24000
  const n = Math.round((sr * music.durationFrames) / 30)
  const buffer = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buffer)
  const ascii = (o: number, x: string) => {
    for (let i = 0; i < x.length; i++) v.setUint8(o + i, x.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  v.setUint32(4, 36 + n * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, sr, true)
  v.setUint32(28, sr * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  ascii(36, 'data')
  v.setUint32(40, n * 2, true)
  const beat = 9600
  const sub = 2400
  const bar = beat * 4
  const bass = [436, 367, 327, 490] as const
  const pad = [218, 183, 164, 245] as const
  const tri = (i: number, p: number) => {
    const x = i % p
    const h = p >> 1
    return x < h ? -32768 + Math.floor((65535 * x) / h) : 32767 - Math.floor((65535 * (x - h)) / (p - h))
  }
  const noise = (i: number) => {
    let x = Math.imul((i ^ 0x9e37) >>> 0, 1103515245) >>> 0
    x ^= x >>> 11
    return (x & 65535) - 32768
  }
  const sc = (x: number, g: number) => Math.trunc((x * g) / 32768)
  for (let i = 0; i < n; i++) {
    const bp = i % beat
    const sp = i % sub
    const bi = Math.floor(i / beat) % 4
    const ch = Math.floor(i / bar) % 4
    let m = sc(tri(i, bass[ch]!), 6000) + sc(tri(i, pad[ch]!), 900)
    if (bp < 2100) m += sc(tri(bp, 120 + Math.floor(bp / 25)), 12000 - Math.floor((bp * 12000) / 2100))
    if ((bi === 1 || bi === 3) && bp < 1500) m += sc(noise(i), 5000 - Math.floor((bp * 5000) / 1500))
    if (sp < 420) m += sc(noise(i * 7 + 3), 2200 - Math.floor((sp * 1800) / 420))
    v.setInt16(44 + i * 2, Math.max(-29000, Math.min(29000, m)), true)
  }
  return Buffer.from(buffer)
}

export function sha256HexBytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function assertBatch9aGrooveBytes(
  music: NonNullable<VideoTemplateRelease['defaultMusic']>,
  bytes: Buffer,
): void {
  const digest = sha256HexBytes(bytes)
  if (digest !== music.sha256) throw new Error('First-party soundtrack integrity check failed')
}
