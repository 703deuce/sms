import type { AdStudioErrorCode } from './types'

const STATUSES: Record<AdStudioErrorCode, number> = {
  INVALID_PARAMS: 400, PLAN_NOT_READY: 409, ALREADY_CONFIRMED: 409,
  CONCURRENCY_LIMIT: 409, RUN_NOT_FOUND: 404, INSUFFICIENT_CREDITS: 402,
  KIE_ERROR: 502, STOCK_ERROR: 502, RENDER_ERROR: 502, STORAGE_ERROR: 500,
}

export class AdStudioError extends Error {
  readonly code: AdStudioErrorCode
  readonly status: number
  constructor(code: AdStudioErrorCode, message: string) {
    super(message.replace(/\$/g, 'credits').slice(0, 450))
    this.name = 'AdStudioError'
    this.code = code
    this.status = STATUSES[code]
  }
}
