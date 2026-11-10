import { createHash } from 'crypto'
import { AiCaptionsError } from '@/lib/ai-captions/errors'
import type { AiCaptionsCreateBody, AiCaptionsSource } from '@/lib/ai-captions/types'

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

export function parseCreateBody(body: unknown, headerKey: string | null): {
  clientRequestId: string
  source: AiCaptionsSource
  styleId?: string
  requestHash: string
} {
  if (!isRecord(body)) {
    throw new AiCaptionsError('idempotency_key_required', 'A JSON body is required.', 400)
  }
  const bodyKey = typeof body.clientRequestId === 'string' ? body.clientRequestId.trim() : ''
  const header = headerKey?.trim() || ''
  if (header && bodyKey && header !== bodyKey) {
    throw new AiCaptionsError(
      'idempotency_key_required',
      'Idempotency-Key and clientRequestId must match when both are sent.',
      400,
    )
  }
  const clientRequestId = header || bodyKey
  if (!clientRequestId) {
    throw new AiCaptionsError(
      'idempotency_key_required',
      'Send an Idempotency-Key header or clientRequestId.',
      400,
    )
  }

  const source = parseSource(body.source)
  let styleId: string | undefined
  if (body.styleId !== undefined && body.styleId !== null) {
    if (typeof body.styleId !== 'string' || !body.styleId.trim()) {
      throw new AiCaptionsError('unknown_style_id', 'styleId must be a non-empty string.', 400)
    }
    styleId = body.styleId.trim()
  }

  const requestHash = hashCreateRequest(source, styleId)
  return { clientRequestId, source, styleId, requestHash }
}

export function parseSource(raw: unknown): AiCaptionsSource {
  if (!isRecord(raw)) {
    throw new AiCaptionsError('source_not_found', 'A source object is required.', 400)
  }
  const kind = raw.kind
  if (kind === 'upload') {
    const uploadId = typeof raw.uploadId === 'string' ? raw.uploadId.trim() : ''
    if (!uploadId) {
      throw new AiCaptionsError('source_not_found', 'source.uploadId is required for an upload source.', 400)
    }
    return { kind: 'upload', uploadId }
  }
  if (kind === 'project') {
    const projectId = typeof raw.projectId === 'string' ? raw.projectId.trim() : ''
    if (!projectId) {
      throw new AiCaptionsError('source_not_found', 'source.projectId is required for a project source.', 400)
    }
    return { kind: 'project', projectId }
  }
  if (kind === 'asset') {
    const projectId = typeof raw.projectId === 'string' ? raw.projectId.trim() : ''
    const assetId = typeof raw.assetId === 'string' ? raw.assetId.trim() : ''
    if (!projectId) {
      throw new AiCaptionsError('source_not_found', 'source.projectId is required for an asset source.', 400)
    }
    if (!assetId) {
      throw new AiCaptionsError('source_not_found', 'source.assetId is required for an asset source.', 400)
    }
    return { kind: 'asset', projectId, assetId }
  }
  throw new AiCaptionsError('source_not_found', 'source.kind must be upload, project, or asset.', 400)
}

export function hashCreateRequest(source: AiCaptionsSource, styleId: string | undefined): string {
  const payload =
    source.kind === 'upload'
      ? { kind: 'upload', uploadId: source.uploadId, styleId: styleId ?? null }
      : source.kind === 'asset'
        ? { kind: 'asset', projectId: source.projectId, assetId: source.assetId, styleId: styleId ?? null }
        : { kind: 'project', projectId: source.projectId, styleId: styleId ?? null }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export function parseStyleBody(body: unknown): { styleId: string } {
  if (!isRecord(body) || typeof body.styleId !== 'string' || !body.styleId.trim()) {
    throw new AiCaptionsError('unknown_style_id', 'Send { styleId } in the request body.', 400)
  }
  return { styleId: body.styleId.trim() }
}
