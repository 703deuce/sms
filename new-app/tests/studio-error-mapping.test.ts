// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { STUDIO_ERROR_CODES } from '../lib/ai-studio/contract'
import {
  looksLikeMissingStudioRoute,
  mapStudioHttpError,
  mapStudioJobError,
  sanitizeStudioMessage,
} from '../lib/ai-studio/errors'

describe('studio error mapping', () => {
  it('maps every contract error code to that kind and never includes $', () => {
    for (const code of STUDIO_ERROR_CODES) {
      const ui = mapStudioHttpError({
        status: 400,
        body: { error: `${code} costs $12.00`, code },
      })
      expect(ui.kind).toBe(code)
      expect(ui.code).toBe(code)
      expect(ui.message).not.toMatch(/\$/)
      expect(ui.message.length).toBeGreaterThan(0)
    }
  })

  it('maps job errors and auth / missing-route states honestly', () => {
    expect(mapStudioJobError({ code: 'KIE_ERROR', message: 'Provider said no ($5)' }).message).not.toMatch(/\$/)
    expect(mapStudioHttpError({ status: 401, body: { error: 'nope' } }).kind).toBe('UNAUTHORIZED')
    expect(mapStudioHttpError({ status: 403, body: { error: 'nope' } }).kind).toBe('FORBIDDEN')
    expect(looksLikeMissingStudioRoute(404, null, 'text/html')).toBe(true)
    expect(looksLikeMissingStudioRoute(404, { error: 'Job not found', code: 'JOB_NOT_FOUND' }, 'application/json')).toBe(false)
    expect(mapStudioHttpError({ status: 404, body: null, contentType: 'text/html' }).kind).toBe('API_UNAVAILABLE')
    expect(mapStudioHttpError({ status: 404, body: { error: 'missing', code: 'JOB_NOT_FOUND' } }).kind).toBe('JOB_NOT_FOUND')
  })

  it('strips $ from any slipped message', () => {
    expect(sanitizeStudioMessage('  costs $9  today ')).toBe('costs 9 today')
  })
})
