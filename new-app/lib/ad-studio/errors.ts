import type { AdStudioErrorCode } from './types'

/** API-safe errors: no provider payloads or currency in client messages. */
export class AdStudioError extends Error {
  constructor(public readonly code: AdStudioErrorCode, message: string, public readonly status = 400) {
    super(message.replace(/\$/g, ''))
    this.name = 'AdStudioError'
  }
}

export const adInvalid = (message = 'Invalid ad brief or parameters.') =>
  new AdStudioError('INVALID_PARAMS', message, 400)

export function adSafeFailure(_err: unknown, code: AdStudioErrorCode = 'STORAGE_ERROR'): AdStudioError {
  console.error('[ad-studio:error] unexpected', { code, type: _err instanceof Error ? _err.name : typeof _err })
  return new AdStudioError(code, 'Ad Studio could not finish this step. Please try again.', code === 'STORAGE_ERROR' ? 500 : 502)
}
