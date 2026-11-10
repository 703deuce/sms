// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it, vi } from 'vitest'
import { YOUTUBE_VIDEO_PATHS } from '../lib/youtube-video/contract'
import { createYoutubeVideoClient } from '../lib/youtube-video/client'
import { createYoutubeVideoController } from '../lib/youtube-video/controller'
import { parseYoutubeVideoRun } from '../lib/youtube-video/parse'
import { formatCredits } from '../lib/youtube-video/format'
import { YoutubeVideoHttpError } from '../lib/youtube-video/parse'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const UPLOAD_SOURCE = { kind: 'upload' as const, projectId: 'proj_1' }

const DONE_RUN = {
  runId: 'run_1',
  status: 'done',
  stage: 'ready',
  clipId: 'clip_1',
  projectId: 'proj_1',
  editorUrl: '/app/clips/proj_1/edit/clip_1',
  durationMs: 12000,
  playbackUrl: 'https://cdn.example/play.mp4',
  thumbnailUrl: 'https://cdn.example/thumb.jpg',
  downloadUrl: 'https://cdn.example/dl.mp4',
  creditEstimate: 12,
}

describe('youtube video adapter', () => {
  it('normalizes both option, beat, plan, and chapter field names', () => {
    const a = parseYoutubeVideoRun({
      id: 'run_a',
      status: 'running',
      stage: 'planning',
      planCard: {
        title: 'Plan A',
        chapterText: 'Ch 1',
        chapters: [{ title: 'Intro', startMs: 0 }],
        options: [
          {
            id: 'opt_a',
            title: 'Tight cut',
            beats: [{ title: 'Hook', startMs: 0, endMs: 1500, sourceId: 'src_1', evidence: { n: 1 } }],
          },
        ],
      },
    })
    const b = parseYoutubeVideoRun({
      run: {
        runId: 'run_a',
        status: 'running',
        stage: 'planning',
        plan: {
          title: 'Plan A',
          chapterText: 'Ch 1',
          chapters: [{ title: 'Intro', startMs: 0 }],
        },
        options: [
          {
            optionId: 'opt_a',
            title: 'Tight cut',
            beats: [{ label: 'Hook', ranges: [{ sourceId: 'src_1', startMs: 0, endMs: 1500 }], evidence: { n: 1 } }],
          },
        ],
      },
    })
    expect(a.runId).toBe('run_a')
    expect(a.plan?.title).toBe('Plan A')
    expect(a.plan?.chapterText).toBe('Ch 1')
    expect(a.plan?.chapters).toEqual([{ title: 'Intro', startMs: 0 }])
    expect(a.options[0]).toMatchObject({ optionId: 'opt_a', title: 'Tight cut' })
    expect(a.options[0].beats[0]).toMatchObject({
      label: 'Hook',
      ranges: [{ sourceId: 'src_1', startMs: 0, endMs: 1500 }],
      evidence: { n: 1 },
    })
    expect(b).toEqual(a)
    expect(formatCredits(12)).toBe('12 credits')
    expect(formatCredits(12)).not.toMatch(/\$/)
  })

  it('posts a create body with upload sources and reuses clientRequestId on retry or double-click', async () => {
    const posts: unknown[] = []
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === YOUTUBE_VIDEO_PATHS.create && init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)))
        return json(201, { run: { runId: 'run_1', status: 'queued', stage: 'queued' } })
      }
      if (url === YOUTUBE_VIDEO_PATHS.run('run_1')) {
        return json(200, DONE_RUN)
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
    expect(posts[0]).toEqual({
      sources: [UPLOAD_SOURCE],
      title: 'Main cut',
      clientRequestId: 'req_fixed',
    })
    controller.getState().run && expect(controller.getState().run?.status).toBe('done')
    // After a failure-like retry, the same id is reused.
    await controller.retry()
    expect(posts).toHaveLength(2)
    expect(posts[1]).toMatchObject({ clientRequestId: 'req_fixed', sources: [UPLOAD_SOURCE] })
  })

  it('polls status and stage until the run is done', async () => {
    const statuses = ['queued', 'importing', 'running', 'done'] as const
    let poll = 0
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === YOUTUBE_VIDEO_PATHS.create && init?.method === 'POST') {
        return json(201, { id: 'run_1', status: 'queued', stage: 'queued' })
      }
      if (url === YOUTUBE_VIDEO_PATHS.run('run_1')) {
        const status = statuses[Math.min(poll, statuses.length - 1)]
        poll += 1
        const body =
          status === 'done'
            ? DONE_RUN
            : { runId: 'run_1', status, stage: status, progress: poll * 20 }
        return json(200, body)
      }
      throw new Error(`unexpected ${url}`)
    })
    const client = createYoutubeVideoClient({ fetch: fetchImpl as unknown as typeof fetch })
    const controller = createYoutubeVideoController({ client, sleep: async () => {}, randomId: () => 'req_1' })
    await controller.submit({ sources: [UPLOAD_SOURCE] })
    const run = controller.getState().run
    expect(run?.status).toBe('done')
    expect(run?.editorUrl).toBe('/app/clips/proj_1/edit/clip_1')
    expect(run?.playbackUrl).toBeTruthy()
    expect(poll).toBeGreaterThanOrEqual(1)
    expect(controller.getState().creditLabel).toBe('12 credits')
  })

  it('surfaces a failed run error without dollar amounts', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === YOUTUBE_VIDEO_PATHS.create && init?.method === 'POST') {
        return json(201, { runId: 'run_1', status: 'queued', stage: 'queued' })
      }
      if (url === YOUTUBE_VIDEO_PATHS.run('run_1')) {
        return json(200, {
          runId: 'run_1',
          status: 'failed',
          stage: 'failed',
          error: { code: 'KIE_ERROR', message: 'Provider failed, cost $12.00' },
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
        return json(201, DONE_RUN)
      }
      if (url === YOUTUBE_VIDEO_PATHS.revert('run_1') && method === 'POST') {
        reverted = true
        return json(200, { ...DONE_RUN, playbackUrl: 'https://cdn.example/ai-original.mp4', stage: 'reverted' })
      }
      if (url === YOUTUBE_VIDEO_PATHS.run('run_1') && method === 'GET') {
        return json(200, {
          ...DONE_RUN,
          playbackUrl: reverted ? 'https://cdn.example/ai-original.mp4' : DONE_RUN.playbackUrl,
          stage: reverted ? 'reverted' : 'ready',
        })
      }
      throw new Error(`unexpected ${method} ${url}`)
    })
    const client = createYoutubeVideoClient({ fetch: fetchImpl as unknown as typeof fetch })
    const controller = createYoutubeVideoController({ client, sleep: async () => {}, randomId: () => 'req_1' })
    await controller.submit({ sources: [UPLOAD_SOURCE] })
    expect(controller.getState().run?.status).toBe('done')
    await controller.confirmRevert()
    expect(calls.some((c) => c.startsWith(`POST ${YOUTUBE_VIDEO_PATHS.revert('run_1')}`))).toBe(false)
    controller.requestRevert()
    expect(controller.getState().confirmRevert).toBe(true)
    await controller.confirmRevert()
    expect(calls.filter((c) => c === `POST ${YOUTUBE_VIDEO_PATHS.revert('run_1')}`)).toHaveLength(1)
    expect(controller.getState().run?.playbackUrl).toBe('https://cdn.example/ai-original.mp4')
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
          runId: 'run_1',
          status: 'running',
          stage: 'choose',
          options: [
            { optionId: 'opt_a', title: 'A' },
            { optionId: 'opt_b', title: 'B' },
          ],
        })
      }
      if (url === YOUTUBE_VIDEO_PATHS.choose('run_1') && method === 'POST') {
        return json(409, { error: { code: 'OPTION_ALREADY_CHOSEN', message: 'A different option was already chosen.' } })
      }
      if (url === YOUTUBE_VIDEO_PATHS.run('run_1') && method === 'GET') {
        return json(200, { ...DONE_RUN, chosenOptionId: 'opt_a' })
      }
      throw new Error(`unexpected ${method} ${url}`)
    })
    const client = createYoutubeVideoClient({ fetch: fetchImpl as unknown as typeof fetch })
    const controller = createYoutubeVideoController({ client, sleep: async () => {}, randomId: () => 'req_1' })
    await controller.submit({ sources: [UPLOAD_SOURCE] })
    await controller.choose('opt_b')
    expect(controller.getState().chooseError).toMatch(/already chosen/i)
    expect(calls).toContain(`GET ${YOUTUBE_VIDEO_PATHS.run('run_1')}`)
    expect(controller.getState().run?.chosenOptionId).toBe('opt_a')
    expect(controller.getState().run?.status).toBe('done')
  })

  it('maps a 409 payload to YoutubeVideoHttpError', async () => {
    const fetchImpl = async () => json(409, { error: { code: 'OPTION_ALREADY_CHOSEN', message: 'A different option was already chosen.' } })
    const client = createYoutubeVideoClient({ fetch: fetchImpl as unknown as typeof fetch })
    await expect(client.chooseOption('run_1', 'opt_b')).rejects.toMatchObject({
      name: 'YoutubeVideoHttpError',
      status: 409,
      message: 'A different option was already chosen.',
    })
    await expect(client.chooseOption('run_1', 'opt_b')).rejects.toBeInstanceOf(YoutubeVideoHttpError)
  })
})
