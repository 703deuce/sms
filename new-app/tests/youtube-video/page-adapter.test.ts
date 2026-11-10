import { describe, expect, it, vi } from 'vitest'
import { YOUTUBE_VIDEO_PATHS } from '../../lib/youtube-video-ui/paths'
import { createYoutubeVideoClient } from '../../lib/youtube-video-ui/client'
import { createYoutubeVideoController } from '../../lib/youtube-video-ui/controller'
import { parseHttpErrorPayload, parseYoutubeVideoRun, YoutubeVideoHttpError } from '../../lib/youtube-video-ui/parse'
import { formatCredits } from '../../lib/youtube-video-ui/format'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const UPLOAD_SOURCE = { kind: 'upload' as const, projectId: 'proj_1' }

const READY_RESULT = {
  clipId: 'clip_1',
  projectId: 'proj_1',
  editorUrl: '/app/clips/proj_1/edit/clip_1',
  durationMs: 12000,
  durationSeconds: 12,
  playbackUrl: 'https://cdn.example/play.mp4',
  thumbnailUrl: 'https://cdn.example/thumb.jpg',
  downloadUrl: 'https://cdn.example/dl.mp4',
  plan: { premise: 'A tight cut', beats: [] },
  chapters: [{ title: 'Intro', startMs: 0 }],
  chapterText: 'Ch 1',
}

const READY_RUN = {
  runId: 'run_1',
  status: 'ready',
  stage: 'applying',
  creditsEstimated: 12,
  result: READY_RESULT,
}

describe('youtube video page adapter', () => {
  it('normalizes both option, beat, plan, and chapter field names', () => {
    const a = parseYoutubeVideoRun({
      data: {
        id: 'run_a',
        status: 'done',
        stage: 'planning',
        creditEstimate: 12,
        progress: 40,
        planCard: {
          title: 'Plan A',
          chapterText: 'Ch 1',
          chapters: [{ title: 'Intro', startMs: 0 }],
          options: [
            {
              id: 'opt_a',
              title: 'Tight cut',
              premise: 'Hook first',
              beats: [{ title: 'Hook', startMs: 0, endMs: 1500, sourceId: 'src_1', evidence: 'line 1' }],
            },
          ],
        },
        clipId: 'clip_1',
        projectId: 'proj_1',
        editorUrl: '/app/clips/proj_1/edit/clip_1',
      },
    })
    const b = parseYoutubeVideoRun({
      run: {
        runId: 'run_a',
        status: 'ready',
        stage: 'planning',
        creditsEstimated: 12,
        progressPercent: 40,
        plan: {
          premise: 'Plan A',
          beats: [{ label: 'Hook', startMs: 0, endMs: 1500, sourceId: 'src_1', evidence: 'line 1' }],
        },
        options: [
          {
            optionId: 'opt_a',
            title: 'Tight cut',
            premise: 'Hook first',
            beats: [{ label: 'Hook', startMs: 0, endMs: 1500, sourceId: 'src_1', evidence: 'line 1' }],
          },
        ],
        result: {
          clipId: 'clip_1',
          projectId: 'proj_1',
          editorUrl: '/app/clips/proj_1/edit/clip_1',
          chapterText: 'Ch 1',
          chapters: [{ title: 'Intro', startMs: 0 }],
        },
      },
    })
    expect(a.runId).toBe('run_a')
    expect(a.status).toBe('ready')
    expect(a.progressPercent).toBe(40)
    expect(a.creditsEstimated).toBe(12)
    expect(a.options?.[0]).toMatchObject({ id: 'opt_a', title: 'Tight cut', premise: 'Hook first' })
    expect(a.options?.[0].beats[0]).toMatchObject({
      label: 'Hook',
      startMs: 0,
      endMs: 1500,
      sourceId: 'src_1',
      evidence: 'line 1',
    })
    expect(a.result?.chapters).toEqual([{ title: 'Intro', startMs: 0 }])
    expect(a.result?.chapterText).toBe('Ch 1')
    expect(b.runId).toBe(a.runId)
    expect(b.status).toBe(a.status)
    expect(b.options).toEqual(a.options)
    expect(formatCredits(12)).toBe('12 credits')
    expect(formatCredits(12)).not.toMatch(/\$/)
  })

  it('posts a create body with upload sources and reuses clientRequestId on retry or double-click', async () => {
    const posts: Array<{ body: unknown; key: string | null }> = []
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const headers = new Headers(init?.headers)
      if (url === YOUTUBE_VIDEO_PATHS.create && init?.method === 'POST') {
        posts.push({ body: JSON.parse(String(init.body)), key: headers.get('Idempotency-Key') })
        return json(201, { data: { runId: 'run_1', status: 'queued', stage: 'ingest' } })
      }
      if (url === YOUTUBE_VIDEO_PATHS.run('run_1')) {
        return json(200, { data: READY_RUN })
      }
      throw new Error(`unexpected ${url}`)
    })
    const client = createYoutubeVideoClient({ fetch: fetchImpl as unknown as typeof fetch })
    const controller = createYoutubeVideoController({
      client,
      sleep: async () => {},
      randomId: () => 'req_fixed',
    })
    const first = controller.submit({ sources: [UPLOAD_SOURCE], title: 'Main cut' })
    const second = controller.submit({ sources: [UPLOAD_SOURCE], title: 'Main cut' })
    await Promise.all([first, second])
    expect(posts).toHaveLength(1)
    expect(posts[0]?.body).toEqual({
      sources: [UPLOAD_SOURCE],
      instruction: 'Main cut',
      clientRequestId: 'req_fixed',
    })
    expect(posts[0]?.key).toBe('req_fixed')
    expect(controller.getState().run?.status).toBe('ready')
    await controller.retry()
    expect(posts).toHaveLength(2)
    expect(posts[1]?.body).toMatchObject({ clientRequestId: 'req_fixed', sources: [UPLOAD_SOURCE] })
    expect(posts[1]?.key).toBe('req_fixed')
  })

  it('polls status and stage until the run is ready', async () => {
    const statuses = ['queued', 'importing', 'running', 'ready'] as const
    let poll = 0
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === YOUTUBE_VIDEO_PATHS.create && init?.method === 'POST') {
        return json(201, { data: { id: 'run_1', status: 'queued', stage: 'ingest' } })
      }
      if (url === YOUTUBE_VIDEO_PATHS.run('run_1')) {
        const status = statuses[Math.min(poll, statuses.length - 1)]
        poll += 1
        const body =
          status === 'ready'
            ? READY_RUN
            : { runId: 'run_1', status, stage: 'assembling', progressPercent: poll * 20 }
        return json(200, { data: body })
      }
      throw new Error(`unexpected ${url}`)
    })
    const client = createYoutubeVideoClient({ fetch: fetchImpl as unknown as typeof fetch })
    const controller = createYoutubeVideoController({ client, sleep: async () => {}, randomId: () => 'req_1' })
    await controller.submit({ sources: [UPLOAD_SOURCE] })
    const run = controller.getState().run
    expect(run?.status).toBe('ready')
    expect(run?.result?.editorUrl).toBe('/app/clips/proj_1/edit/clip_1')
    expect(run?.result?.playbackUrl).toBeTruthy()
    expect(poll).toBeGreaterThanOrEqual(1)
    expect(controller.getState().creditLabel).toBe('12 credits')
  })

  it('surfaces a failed run error without dollar amounts', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === YOUTUBE_VIDEO_PATHS.create && init?.method === 'POST') {
        return json(201, { data: { runId: 'run_1', status: 'queued', stage: 'ingest' } })
      }
      if (url === YOUTUBE_VIDEO_PATHS.run('run_1')) {
        return json(200, {
          data: {
            runId: 'run_1',
            status: 'failed',
            stage: 'assembling',
            failureCode: 'KIE_ERROR',
            failureMessage: 'Provider failed, cost $12.00',
          },
        })
      }
      throw new Error(`unexpected ${url}`)
    })
    const client = createYoutubeVideoClient({ fetch: fetchImpl as unknown as typeof fetch })
    const controller = createYoutubeVideoController({ client, sleep: async () => {}, randomId: () => 'req_1' })
    await controller.submit({ sources: [UPLOAD_SOURCE] })
    const state = controller.getState()
    expect(state.phase).toBe('failed')
    expect(state.error?.code).toBe('KIE_ERROR')
    expect(state.error?.message).toBe('Provider failed, cost')
    expect(state.error?.message).not.toMatch(/\$/)
  })

  it('reverts only after confirm, then refetches the run', async () => {
    const calls: string[] = []
    let reverted = false
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push(`${method} ${url}`)
      if (url === YOUTUBE_VIDEO_PATHS.create && method === 'POST') {
        return json(201, { data: READY_RUN })
      }
      if (url === YOUTUBE_VIDEO_PATHS.revert('run_1') && method === 'POST') {
        reverted = true
      }
      const payload = {
        ...READY_RUN,
        result: {
          ...READY_RESULT,
          playbackUrl: reverted ? 'https://cdn.example/ai-original.mp4' : READY_RESULT.playbackUrl,
        },
      }
      if (url === YOUTUBE_VIDEO_PATHS.revert('run_1') && method === 'POST') {
        return json(200, { data: payload })
      }
      if (url === YOUTUBE_VIDEO_PATHS.run('run_1') && method === 'GET') {
        return json(200, { data: payload })
      }
      throw new Error(`unexpected ${method} ${url}`)
    })
    const client = createYoutubeVideoClient({ fetch: fetchImpl as unknown as typeof fetch })
    const controller = createYoutubeVideoController({ client, sleep: async () => {}, randomId: () => 'req_1' })
    await controller.submit({ sources: [UPLOAD_SOURCE] })
    expect(controller.getState().run?.status).toBe('ready')
    await controller.confirmRevert()
    expect(calls.some((c) => c.startsWith(`POST ${YOUTUBE_VIDEO_PATHS.revert('run_1')}`))).toBe(false)
    controller.requestRevert()
    expect(controller.getState().confirmRevert).toBe(true)
    await controller.confirmRevert()
    expect(calls.filter((c) => c === `POST ${YOUTUBE_VIDEO_PATHS.revert('run_1')}`)).toHaveLength(1)
    expect(controller.getState().run?.result?.playbackUrl).toBe('https://cdn.example/ai-original.mp4')
    expect(controller.getState().confirmRevert).toBe(false)
  })

  it('shows a clear message and refetches when choose returns 409', async () => {
    const calls: string[] = []
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      calls.push(`${method} ${url}`)
      if (url === YOUTUBE_VIDEO_PATHS.create && method === 'POST') {
        return json(201, {
          data: {
            runId: 'run_1',
            status: 'awaiting_choice',
            stage: 'planning',
            options: [
              { id: 'opt_a', title: 'A', premise: '', beats: [] },
              { id: 'opt_b', title: 'B', premise: '', beats: [] },
            ],
          },
        })
      }
      if (url === YOUTUBE_VIDEO_PATHS.choose('run_1') && method === 'POST') {
        return json(409, { error: { code: 'option_already_chosen', message: 'A different option was already chosen.' } })
      }
      if (url === YOUTUBE_VIDEO_PATHS.run('run_1') && method === 'GET') {
        return json(200, { data: { ...READY_RUN } })
      }
      throw new Error(`unexpected ${method} ${url}`)
    })
    const client = createYoutubeVideoClient({ fetch: fetchImpl as unknown as typeof fetch })
    const controller = createYoutubeVideoController({ client, sleep: async () => {}, randomId: () => 'req_1' })
    await controller.submit({ sources: [UPLOAD_SOURCE] })
    await controller.choose('opt_b')
    expect(controller.getState().chooseError).toMatch(/already chosen/i)
    expect(calls).toContain(`GET ${YOUTUBE_VIDEO_PATHS.run('run_1')}`)
    expect(controller.getState().run?.status).toBe('ready')
  })

  it('maps a 409 payload to YoutubeVideoHttpError', async () => {
    const fetchImpl = async () =>
      json(409, { error: { code: 'option_already_chosen', message: 'A different option was already chosen.' } })
    const client = createYoutubeVideoClient({ fetch: fetchImpl as unknown as typeof fetch })
    await expect(client.chooseOption('run_1', 'opt_b')).rejects.toMatchObject({
      name: 'YoutubeVideoHttpError',
      status: 409,
      message: 'A different option was already chosen.',
    })
    await expect(client.chooseOption('run_1', 'opt_b')).rejects.toBeInstanceOf(YoutubeVideoHttpError)
  })

  it('shows a string error from the server instead of Request failed (400)', () => {
    const error = parseHttpErrorPayload(400, {
      error: 'The source upload has not finished yet.',
      failureCode: 'source_not_ready',
    })
    expect(error.message).toBe('The source upload has not finished yet.')
    expect(error.code).toBe('source_not_ready')
  })

  it('normalizes the waiting_for_source status for UI polling', () => {
    const waiting = parseYoutubeVideoRun({
      data: { runId: 'yvrun_wait', status: 'waiting_for_source', stage: 'waiting_for_source', progressPercent: 20 },
    })
    expect(waiting.status).toBe('waiting_for_source')
    expect(waiting.stage).toBe('waiting_for_source')
  })
  it('restores the persisted run on refresh and shows its terminal result', async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      if (String(input) === YOUTUBE_VIDEO_PATHS.run('yvrun_restore')) {
        return json(200, { data: { ...READY_RUN, runId: 'yvrun_restore' } })
      }
      throw new Error('unexpected URL')
    }
    const client = createYoutubeVideoClient({ fetch: fetchImpl as unknown as typeof fetch })
    const controller = createYoutubeVideoController({ client, sleep: async () => {} })
    await controller.restoreRun('yvrun_restore')
    expect(controller.getState().phase).toBe('ready')
    expect(controller.getState().run?.runId).toBe('yvrun_restore')
    expect(controller.getState().run?.result?.editorUrl).toBe('/app/clips/proj_1/edit/clip_1')
  })
})
