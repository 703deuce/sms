const GATEWAY_STATUSES = new Set([502, 503, 504])
const DEFAULT_GATEWAY_RETRIES = 2
const RETRY_BASE_MS = 600

export class FetchJsonError extends Error {
  readonly status?: number
  readonly retryable: boolean

  constructor(message: string, opts?: { status?: number; retryable?: boolean }) {
    super(message)
    this.name = 'FetchJsonError'
    this.status = opts?.status
    this.retryable = opts?.retryable ?? false
  }
}

function isIdempotentMethod(method: string) {
  const m = method.toUpperCase()
  return m === 'GET' || m === 'HEAD'
}

function gatewayUserMessage(status: number) {
  return 'Server is restarting, retrying…'
}

async function readBody(res: Response): Promise<{ json: unknown; text: string }> {
  const text = await res.text()
  const ct = (res.headers.get('content-type') ?? '').toLowerCase()
  if (ct.includes('application/json') || ct.includes('+json')) {
    try {
      return { json: text ? JSON.parse(text) : {}, text }
    } catch {
      return { json: null, text }
    }
  }
  return { json: null, text }
}

function errorFromNonJson(res: Response, text: string): FetchJsonError {
  if (GATEWAY_STATUSES.has(res.status)) {
    return new FetchJsonError(gatewayUserMessage(res.status), { status: res.status, retryable: true })
  }
  const trimmed = text.trim()
  if (trimmed.startsWith('<')) {
    return new FetchJsonError(`Server error (${res.status}). Try again in a moment.`, { status: res.status })
  }
  return new FetchJsonError(trimmed.slice(0, 200) || res.statusText || `Request failed (${res.status})`, {
    status: res.status,
  })
}

export type FetchJsonOptions = RequestInit & {
  /** Log tag for diagnostics (e.g. clipper-status-poll). */
  tag?: string
  /** Retry 502/503/504 for idempotent requests (default: GET/HEAD only). */
  retryGateway?: boolean
  maxGatewayRetries?: number
}

/**
 * fetch + JSON parse with HTML/gateway-safe errors and optional gateway retries on polls/GETs.
 */
export async function fetchJson<T = unknown>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { tag, retryGateway, maxGatewayRetries = DEFAULT_GATEWAY_RETRIES, ...init } = options
  const method = (init.method ?? 'GET').toUpperCase()
  const allowRetry = retryGateway ?? isIdempotentMethod(method)
  let attempt = 0

  while (true) {
    attempt += 1
    let res: Response
    try {
      res = await fetch(url, init)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      if (tag) console.info('[fetch-json]', { tag, event: 'network_error', attempt, message: msg })
      throw new FetchJsonError(msg)
    }

    const { json, text } = await readBody(res)

    if (json === null && text.trim()) {
      const parseErr = errorFromNonJson(res, text)
      if (allowRetry && parseErr.retryable && attempt <= maxGatewayRetries + 1) {
        if (tag) {
          console.info('[fetch-json]', { tag, event: 'gateway_retry', status: res.status, attempt })
        }
        await new Promise((r) => setTimeout(r, RETRY_BASE_MS * attempt))
        continue
      }
      if (tag) console.info('[fetch-json]', { tag, event: 'non_json_error', status: res.status, attempt })
      throw parseErr
    }

    if (!res.ok) {
      const body = json as { error?: string } | null
      if (GATEWAY_STATUSES.has(res.status)) {
        if (allowRetry && attempt <= maxGatewayRetries + 1) {
          if (tag) console.info('[fetch-json]', { tag, event: 'gateway_status_retry', status: res.status, attempt })
          await new Promise((r) => setTimeout(r, RETRY_BASE_MS * attempt))
          continue
        }
        if (tag) console.info('[fetch-json]', { tag, event: 'gateway_exhausted', status: res.status, attempt })
        throw new FetchJsonError(gatewayUserMessage(res.status), { status: res.status })
      }
      const msg = body?.error || res.statusText || `Request failed (${res.status})`
      throw new FetchJsonError(msg, { status: res.status })
    }

    return json as T
  }
}
