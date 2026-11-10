import {
  STUDIO_ERROR_CODES,
  type StudioErrorCode,
  type StudioApiErrorBody,
} from './contract'

export type StudioUiErrorKind =
  | StudioErrorCode
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'API_UNAVAILABLE'
  | 'NETWORK'
  | 'UNKNOWN'

export type StudioUiError = {
  kind: StudioUiErrorKind
  code: StudioErrorCode | null
  httpStatus: number | null
  /** Safe to show. Never includes `$`. */
  message: string
}

const COPY: Record<StudioErrorCode, string> = {
  INVALID_PARAMS: 'Check the prompt and options, then try again.',
  UNKNOWN_MODEL: 'That model isn’t available. Pick another from the list.',
  CONCURRENCY_LIMIT: 'You already have generations in progress. Wait for one to finish, then try again.',
  JOB_NOT_READY: 'This generation isn’t ready yet. Wait until it finishes.',
  JOB_NOT_FOUND: 'This generation couldn’t be found.',
  PROJECT_NOT_FOUND: 'That editor project couldn’t be found. Pick another project and try again.',
  KIE_ERROR: 'The model provider couldn’t complete this generation.',
  STORAGE_ERROR: 'We couldn’t save or load that file. Try again in a moment.',
}

const KIND_COPY: Record<Exclude<StudioUiErrorKind, StudioErrorCode>, string> = {
  UNAUTHORIZED: 'Sign in to use AI Studio.',
  FORBIDDEN: 'You don’t have access to AI Studio in this workspace.',
  API_UNAVAILABLE: 'The Studio API isn’t available yet. Try again later.',
  NETWORK: 'Network error. Check your connection and try again.',
  UNKNOWN: 'Something went wrong. Try again in a moment.',
}

export function isStudioErrorCode(code: unknown): code is StudioErrorCode {
  return typeof code === 'string' && (STUDIO_ERROR_CODES as readonly string[]).includes(code)
}

/** Strip `$` so a slipped provider/API message can never surface as money. */
export function sanitizeStudioMessage(message: string): string {
  return message.replace(/\$/g, '').replace(/\s+/g, ' ').trim()
}

export function fallbackCopy(kind: StudioUiErrorKind): string {
  if (isStudioErrorCode(kind)) return COPY[kind]
  return KIND_COPY[kind]
}

export function mapStudioJobError(error: { code: string; message: string }): StudioUiError {
  const code = isStudioErrorCode(error.code) ? error.code : null
  const kind: StudioUiErrorKind = code ?? 'UNKNOWN'
  const raw = sanitizeStudioMessage(error.message)
  // Contract: KIE (or validation) messages are safe to show when present.
  const message = raw || fallbackCopy(kind)
  return { kind, code, httpStatus: null, message }
}

export function parseApiErrorBody(body: unknown): StudioApiErrorBody | null {
  if (!body || typeof body !== 'object') return null
  const rec = body as Record<string, unknown>
  const error = typeof rec.error === 'string' ? rec.error : ''
  const code = typeof rec.code === 'string' ? rec.code : ''
  if (!error && !code) return null
  return { error, code }
}

/**
 * A 404 is a missing route only when the body is not a contract error
 * (e.g. Next.js HTML or `{ "error": "Not Found" }` without a studio code).
 * `JOB_NOT_FOUND` / `PROJECT_NOT_FOUND` must not trip the dev fallback.
 */
export function looksLikeMissingStudioRoute(
  status: number,
  body: unknown,
  contentType?: string | null,
): boolean {
  if (status !== 404 && status !== 405) return false
  const parsed = parseApiErrorBody(body)
  if (parsed && isStudioErrorCode(parsed.code)) return false
  const ct = (contentType ?? '').toLowerCase()
  if (ct.includes('text/html')) return true
  if (parsed?.code) return false
  return true
}

export function mapStudioHttpError(input: {
  status: number
  body?: unknown
  contentType?: string | null
  networkMessage?: string
}): StudioUiError {
  if (input.networkMessage && !input.status) {
    return {
      kind: 'NETWORK',
      code: null,
      httpStatus: null,
      message: sanitizeStudioMessage(input.networkMessage) || fallbackCopy('NETWORK'),
    }
  }

  const parsed = parseApiErrorBody(input.body)
  if (parsed && isStudioErrorCode(parsed.code)) {
    const raw = sanitizeStudioMessage(parsed.error)
    return {
      kind: parsed.code,
      code: parsed.code,
      httpStatus: input.status,
      message: raw || fallbackCopy(parsed.code),
    }
  }

  if (input.status === 401) {
    return {
      kind: 'UNAUTHORIZED',
      code: null,
      httpStatus: 401,
      message: sanitizeStudioMessage(parsed?.error || '') || fallbackCopy('UNAUTHORIZED'),
    }
  }
  if (input.status === 403) {
    return {
      kind: 'FORBIDDEN',
      code: null,
      httpStatus: 403,
      message: sanitizeStudioMessage(parsed?.error || '') || fallbackCopy('FORBIDDEN'),
    }
  }
  if (looksLikeMissingStudioRoute(input.status, input.body, input.contentType)) {
    return {
      kind: 'API_UNAVAILABLE',
      code: null,
      httpStatus: input.status,
      message: fallbackCopy('API_UNAVAILABLE'),
    }
  }

  const raw = sanitizeStudioMessage(parsed?.error || '')
  return {
    kind: 'UNKNOWN',
    code: null,
    httpStatus: input.status || null,
    message: raw || fallbackCopy('UNKNOWN'),
  }
}

export class StudioClientError extends Error {
  readonly ui: StudioUiError
  readonly status: number | null

  constructor(ui: StudioUiError) {
    super(ui.message)
    this.name = 'StudioClientError'
    this.ui = ui
    this.status = ui.httpStatus
  }
}

export function toStudioUiError(err: unknown): StudioUiError {
  if (err instanceof StudioClientError) return err.ui
  if (err && typeof err === 'object' && 'ui' in err && (err as { ui?: StudioUiError }).ui) {
    return (err as { ui: StudioUiError }).ui
  }
  const message = err instanceof Error ? err.message : ''
  return {
    kind: 'UNKNOWN',
    code: null,
    httpStatus: null,
    message: sanitizeStudioMessage(message) || fallbackCopy('UNKNOWN'),
  }
}
