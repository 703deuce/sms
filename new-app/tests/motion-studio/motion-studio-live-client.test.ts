// @ts-ignore vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it, vi } from 'vitest'
import { createLiveMotionStudioClient, MotionStudioHttpError } from '../../lib/motion-studio/client'

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

describe('Motion Studio live client auth contract', () => {
  it('uses same-origin session cookies on every call', async () => {
    const f = fakeFetch(200, { project: { id: 'ms_1' } })
    const client = createLiveMotionStudioClient({ fetcher: f as unknown as typeof fetch })
    await client.getProject('ms_1')
    await client.createPlan('ms_1', 'k')
    for (const call of f.mock.calls as unknown as [string, RequestInit][]) {
      expect(call[0]).toMatch(/^\/api\/motion-studio\//)
      expect(call[1].credentials).toBe('same-origin')
    }
    expect((f.mock.calls[1] as unknown as [string, RequestInit])[1].headers).toMatchObject({ 'Idempotency-Key': 'k' })
  })

  it('maps 401 (no session) and 404 (other workspace) to typed errors with clean copy', async () => {
    const c401 = createLiveMotionStudioClient({ fetcher: fakeFetch(401, { error: 'Unauthorized' }) as unknown as typeof fetch })
    await expect(c401.listProjects()).rejects.toMatchObject({ status: 401, message: 'Your session has ended. Refresh the page to sign in again.' })
    const c404 = createLiveMotionStudioClient({ fetcher: fakeFetch(404, { error: 'not found', code: 'NOT_FOUND' }) as unknown as typeof fetch })
    const err = await c404.getProject('ms_other').catch((e) => e)
    expect(err).toBeInstanceOf(MotionStudioHttpError)
    expect(err).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Project not found.' })
  })
})
