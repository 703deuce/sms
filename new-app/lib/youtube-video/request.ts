import { createHash } from 'node:crypto'
import { YoutubeVideoError } from '@/lib/youtube-video/errors'
import type { YoutubeVideoCreateInput, YoutubeVideoSource } from '@/lib/youtube-video/types'

const KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/

export function resolveIdempotencyKey(headerKey: string | null, bodyKey?: string): string {
  const header = headerKey?.trim() || undefined
  const body = bodyKey?.trim() || undefined
  if (header && body && header !== body) {
    throw new YoutubeVideoError('invalid_request', 'Idempotency-Key and clientRequestId must match', 400)
  }
  const key = header ?? body
  if (!key) throw new YoutubeVideoError('idempotency_key_required', 'Idempotency-Key or clientRequestId is required', 400)
  if (!KEY_RE.test(key)) {
    throw new YoutubeVideoError('invalid_request', 'Idempotency key must be 8–128 characters in [A-Za-z0-9._:-]', 400)
  }
  return key
}

export function canonicalizeSources(sources: YoutubeVideoSource[]): YoutubeVideoSource[] {
  return sources.map((source) => {
    if (source.kind === 'upload') return { kind: 'upload' as const, projectId: source.projectId }
    return { kind: 'url' as const, url: source.url.trim() }
  })
}

export function requestHash(input: { sources: YoutubeVideoSource[]; instruction?: string }): string {
  const payload = {
    instruction: input.instruction?.trim() || '',
    sources: canonicalizeSources(input.sources),
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

const TWITCH_OR_KICK = /^(https?:\/\/)?([a-z0-9-]+\.)*(twitch\.tv|kick\.com)\//i

export function validateCreateInput(input: YoutubeVideoCreateInput): YoutubeVideoCreateInput {
  if (!Array.isArray(input.sources) || input.sources.length < 1 || input.sources.length > 5) {
    throw new YoutubeVideoError('invalid_request', 'Provide 1–5 sources', 400)
  }
  if (input.instruction != null && input.instruction.length > 4000) {
    throw new YoutubeVideoError('invalid_request', 'instruction is too long', 400)
  }
  const sources: YoutubeVideoSource[] = input.sources.map((source, index) => {
    if (source.kind === 'upload') {
      if (!source.projectId?.trim()) {
        throw new YoutubeVideoError('invalid_request', `sources.${index}.projectId is required`, 400)
      }
      return { kind: 'upload', projectId: source.projectId.trim() }
    }
    if (source.kind === 'url') {
      const url = source.url?.trim() ?? ''
      if (!url) throw new YoutubeVideoError('invalid_request', `sources.${index}.url is required`, 400)
      if (!TWITCH_OR_KICK.test(url)) {
        throw new YoutubeVideoError('unsupported_source_url', 'Only Twitch or Kick URLs are supported', 400)
      }
      return { kind: 'url', url }
    }
    throw new YoutubeVideoError('invalid_request', `sources.${index}.kind is invalid`, 400)
  })
  return {
    clientRequestId: input.clientRequestId,
    instruction: input.instruction?.trim() || undefined,
    sources,
  }
}
