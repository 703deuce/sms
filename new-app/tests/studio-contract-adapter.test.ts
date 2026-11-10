// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { createStudioClient } from '../lib/ai-studio/client'
import { STUDIO_API_VERSION, STUDIO_LAUNCH_MODEL_IDS, STUDIO_PATHS } from '../lib/ai-studio/contract'
import { createDevStudioFallback, DEV_FALLBACK_MODELS } from '../lib/ai-studio/fallback'
import { parseStudioJob, parseStudioRegistry } from '../lib/ai-studio/parse'

function json(status: number, body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

describe('studio contract adapter', () => {
  it('parses a registry and job in the contract shape', () => {
    const registry = parseStudioRegistry({ version: STUDIO_API_VERSION, models: DEV_FALLBACK_MODELS })
    expect(registry.models.map((m) => m.id)).toEqual([...STUDIO_LAUNCH_MODEL_IDS])
    expect(registry.models.some((m) => m.id.includes('2.5'))).toBe(false)
    const job = parseStudioJob({
      job: {
        id: 'job_1',
        status: 'done',
        modelId: 'flux-2-pro',
        mode: 'text_to_image',
        prompt: 'a lamp',
        aspect: '1:1',
        durationSec: null,
        resolution: '1K',
        creditEstimate: 5,
        projectId: null,
        output: {
          kind: 'image',
          contentType: 'image/png',
          width: 1024,
          height: 1024,
          durationSec: null,
          previewUrl: '/api/studio/jobs/job_1/output',
          downloadUrl: '/api/studio/jobs/job_1/output?download=1',
        },
        error: null,
        createdAt: '2026-11-10T00:00:00.000Z',
        updatedAt: '2026-11-10T00:00:01.000Z',
        startedAt: '2026-11-10T00:00:00.000Z',
        completedAt: '2026-11-10T00:00:01.000Z',
      },
    })
    expect(job.id).toBe('job_1')
    expect(job.output?.previewUrl).toContain('/api/studio/jobs/job_1/output')
  })

  it('calls the real contract endpoints when they exist', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith(STUDIO_PATHS.models)) {
        return json(200, { version: 1, models: DEV_FALLBACK_MODELS })
      }
      if (String(url) === STUDIO_PATHS.jobs && init?.method === 'POST') {
        const body = JSON.parse(String(init.body))
        expect(body.modelId).toBe('flux-2-pro')
        expect(body.mode).toBe('text_to_image')
        return json(201, {
          job: {
            id: 'job_live',
            status: 'queued',
            modelId: body.modelId,
            mode: body.mode,
            prompt: body.prompt,
            aspect: body.aspect ?? null,
            durationSec: null,
            resolution: body.resolution ?? null,
            creditEstimate: 5,
            projectId: null,
            output: null,
            error: null,
            createdAt: '2026-11-10T00:00:00.000Z',
            updatedAt: '2026-11-10T00:00:00.000Z',
            startedAt: null,
            completedAt: null,
          },
        })
      }
      return json(404, { error: 'no', code: 'JOB_NOT_FOUND' })
    })
    const client = createStudioClient({ fetch: fetchImpl as unknown as typeof fetch, allowDevFallback: false })
    const models = await client.listModels()
    expect(models.version).toBe(1)
    const job = await client.createJob({ modelId: 'flux-2-pro', mode: 'text_to_image', prompt: 'lamp' })
    expect(job.id).toBe('job_live')
    expect(client.transport()).toBe('api')
  })

  it('uses a dev-only fallback when the route is missing, but not for JOB_NOT_FOUND', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes('/models')) {
        return new Response('<html>not found</html>', { status: 404, headers: { 'Content-Type': 'text/html' } })
      }
      return new Response('<html>not found</html>', { status: 404, headers: { 'Content-Type': 'text/html' } })
    })
    const fallback = createDevStudioFallback()
    const client = createStudioClient({ fetch: fetchImpl as unknown as typeof fetch, allowDevFallback: true, fallback })
    const models = await client.listModels()
    expect(client.transport()).toBe('dev-fallback')
    expect(models.models[0]?.id).toBeTruthy()

    const prod = createStudioClient({ fetch: fetchImpl as unknown as typeof fetch, allowDevFallback: false })
    await expect(prod.listModels()).rejects.toMatchObject({ ui: { kind: 'API_UNAVAILABLE' } })

    const found = vi.fn(async () => json(404, { error: 'gone', code: 'JOB_NOT_FOUND' }))
    const live = createStudioClient({ fetch: found as unknown as typeof fetch, allowDevFallback: true })
    await expect(live.getJob('missing')).rejects.toMatchObject({ ui: { kind: 'JOB_NOT_FOUND' } })
    expect(live.transport()).toBe('api')
  })
})
