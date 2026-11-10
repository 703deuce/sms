import type { YoutubeVideoCreateInput, YoutubeVideoRunView } from '../youtube-video/types'
import { YOUTUBE_VIDEO_PATHS } from './paths'
import { parseHttpErrorPayload, parseYoutubeVideoRun, YoutubeVideoHttpError } from './parse'

export type YoutubeVideoClient = {
  createRun: (body: YoutubeVideoCreateInput, idempotencyKey?: string) => Promise<YoutubeVideoRunView>
  getRun: (runId: string) => Promise<YoutubeVideoRunView>
  chooseOption: (runId: string, optionId: string) => Promise<YoutubeVideoRunView>
  revertRun: (runId: string) => Promise<YoutubeVideoRunView>
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { message: text }
  }
}

export function createYoutubeVideoClient(opts: { fetch?: typeof fetch } = {}): YoutubeVideoClient {
  const doFetch = opts.fetch ?? fetch

  async function request(url: string, init: RequestInit): Promise<unknown> {
    const res = await doFetch(url, {
      credentials: 'include',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    })
    const body = await readJson(res)
    if (!res.ok) throw parseHttpErrorPayload(res.status, body)
    return body
  }

  return {
    async createRun(body, idempotencyKey) {
      const key = idempotencyKey ?? body.clientRequestId
      const json = await request(YOUTUBE_VIDEO_PATHS.create, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: key ? { 'Idempotency-Key': key } : undefined,
      })
      return parseYoutubeVideoRun(json)
    },
    async getRun(runId) {
      return parseYoutubeVideoRun(await request(YOUTUBE_VIDEO_PATHS.run(runId), { method: 'GET' }))
    },
    async chooseOption(runId, optionId) {
      try {
        return parseYoutubeVideoRun(
          await request(YOUTUBE_VIDEO_PATHS.choose(runId), {
            method: 'POST',
            body: JSON.stringify({ optionId }),
          }),
        )
      } catch (e) {
        if (e instanceof YoutubeVideoHttpError && e.status === 409) throw e
        throw e
      }
    },
    async revertRun(runId) {
      return parseYoutubeVideoRun(await request(YOUTUBE_VIDEO_PATHS.revert(runId), { method: 'POST' }))
    },
  }
}
