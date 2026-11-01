import type { ExportAspect } from '@/lib/clips/export-aspect'

export type DeliverFormat = 'mp4' | 'mov' | 'gif' | 'mp3' | 'wav' | 'm4a' | 'flac' | 'png'
export type DeliverCodec = 'h264' | 'hevc'
export type DeliverQuality = 'standard' | 'high' | 'max'
export type DeliverFps = 'source' | 24 | 25 | 30 | 50 | 60 | 10 | 12 | 15

export type ExportDeliver = {
  format: DeliverFormat
  codec: DeliverCodec
  quality: DeliverQuality
  fps: DeliverFps
  targetResolution?: '720p' | '1080p' | '1440p' | '2160p'
  rangeInMs?: number
  rangeOutMs?: number
  stillAtMs?: number
  softSubs?: boolean
}

export const DEFAULT_DELIVER: ExportDeliver = {
  format: 'mp4',
  codec: 'h264',
  quality: 'standard',
  fps: 'source',
}

export const DELIVER_CONTENT_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  png: 'image/png',
}

export function deliverExt(d: ExportDeliver): string {
  if (d.format === 'm4a') return 'm4a'
  return d.format
}

export function stableDeliverJson(d: ExportDeliver): string {
  const keys = Object.keys(d).sort() as (keyof ExportDeliver)[]
  const o: Record<string, unknown> = {}
  for (const k of keys) {
    const v = d[k]
    if (v !== undefined) o[k] = v
  }
  return JSON.stringify(o)
}

export function isDefaultDeliver(d: ExportDeliver | null | undefined): boolean {
  if (!d) return true
  return (
    d.format === DEFAULT_DELIVER.format &&
    d.codec === DEFAULT_DELIVER.codec &&
    d.quality === DEFAULT_DELIVER.quality &&
    d.fps === DEFAULT_DELIVER.fps &&
    !d.targetResolution &&
    d.rangeInMs == null &&
    d.rangeOutMs == null &&
    d.stillAtMs == null &&
    !d.softSubs
  )
}

export function deliverChip(d: ExportDeliver): string {
  const parts: string[] = []
  if (d.format === 'mp4' || d.format === 'mov') {
    parts.push(d.format.toUpperCase())
    parts.push(d.codec === 'hevc' ? 'HEVC' : 'H.264')
    if (d.targetResolution) parts.push(d.targetResolution === '2160p' ? '4K' : d.targetResolution)
    if (d.fps !== 'source') parts.push(`${d.fps} fps`)
  } else if (d.format === 'gif') parts.push('GIF')
  else if (d.format === 'png') parts.push('PNG')
  else parts.push(d.format.toUpperCase())
  return parts.join(' · ')
}

type NormCtx = {
  canHigh: boolean
  lengthMs: number
  hasInOut: boolean
  platform: boolean
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** Server-side validation (§2.1 rules). Returns normalized deliver or null when default MP4 path. */
export function normalizeDeliver(raw: unknown, ctx: NormCtx): ExportDeliver | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  let format = (typeof o.format === 'string' ? o.format : 'mp4') as DeliverFormat
  if (!['mp4', 'mov', 'gif', 'mp3', 'wav', 'm4a', 'flac', 'png'].includes(format)) format = 'mp4'

  if (ctx.platform) return null

  let targetResolution = (o.targetResolution as ExportDeliver['targetResolution']) ?? undefined
  if (targetResolution && !['720p', '1080p', '1440p', '2160p'].includes(targetResolution)) {
    targetResolution = undefined
  }
  if (!ctx.canHigh && (targetResolution === '1080p' || targetResolution === '1440p' || targetResolution === '2160p')) {
    targetResolution = '720p'
  }
  if (targetResolution === '2160p' && ctx.lengthMs > 10 * 60 * 1000) targetResolution = '1080p'

  let fps: DeliverFps = DEFAULT_DELIVER.fps
  const fpsRaw = o.fps
  if (fpsRaw === 'source' || fpsRaw === undefined) fps = 'source'
  else if ([24, 25, 30, 50, 60, 10, 12, 15].includes(Number(fpsRaw))) fps = Number(fpsRaw) as DeliverFps

  let codec: DeliverCodec = o.codec === 'hevc' ? 'hevc' : 'h264'
  let quality: DeliverQuality =
    o.quality === 'high' || o.quality === 'max' ? (o.quality as DeliverQuality) : 'standard'

  if (format === 'gif') {
    if (ctx.lengthMs > 30_000) return null
    targetResolution = '720p'
    if (![10, 12, 15].includes(fps as number)) fps = 12
  }
  if (format === 'png') {
    const stillAtMs = num(o.stillAtMs)
    if (stillAtMs == null) return null
    const out: ExportDeliver = {
      format: 'png',
      codec: 'h264',
      quality: 'standard',
      fps: 'source',
      stillAtMs,
      ...(targetResolution ? { targetResolution } : {}),
    }
    return out
  }
  if (['mp3', 'wav', 'm4a', 'flac'].includes(format)) {
    const out: ExportDeliver = { format, codec: 'h264', quality: 'standard', fps: 'source' }
    return out.format === 'mp4' ? null : out
  }

  let rangeInMs = num(o.rangeInMs)
  let rangeOutMs = num(o.rangeOutMs)
  if (rangeInMs != null || rangeOutMs != null) {
    if (!ctx.hasInOut || rangeInMs == null || rangeOutMs == null || rangeOutMs <= rangeInMs) {
      rangeInMs = undefined
      rangeOutMs = undefined
    }
  }

  const softSubs = o.softSubs === true && (format === 'mp4' || format === 'mov')

  const deliver: ExportDeliver = {
    format,
    codec,
    quality,
    fps,
    ...(targetResolution ? { targetResolution } : {}),
    ...(rangeInMs != null ? { rangeInMs, rangeOutMs } : {}),
    ...(softSubs ? { softSubs: true } : {}),
  }
  return isDefaultDeliver(deliver) ? null : deliver
}

/** Compose hash uses 1080p short side even when deliver targets 4K (§2.3). */
export function composeResolutionForDeliver(res: string | undefined): '720p' | '1080p' {
  if (res === '720p') return '720p'
  return '1080p'
}

export function exportResolutionLabel(d: ExportDeliver | null, fallback: string): string {
  return d?.targetResolution ?? fallback
}
