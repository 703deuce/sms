import {
  YOUTUBE_VIDEO_PATHS,
  type CreateYoutubeVideoBody,
  type YoutubeVideoRun,
} from './contract'
import {
  parseHttpErrorPayload,
  parseYoutubeVideoCreateResponse,
  parseYoutubeVideoRun,
  YoutubeVideoHttpError,
} from './parse'

export type YoutubeVideoClient = {
  createRun: (body: CreateYoutubeVideoBody) => Promise<YoutubeVideoRun>
  getRun: (runId: string) => Promise<YoutubeVideoRun>
  chooseOption: (runId: string, optionId: string) => Promise<YoutubeVideoRun>
  revertRun: (runId: string) => Promise<YoutubeVideoRun>
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
    async createRun(body) {
      const json = await request(YOUTUBE_VIDEO_PATHS.create, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return parseYoutubeVideoCreateResponse(json)
    },
    async getRun(runId) {
      const json = await request(YOUTUBE_VIDEO_PATHS.run(runId), { method: 'GET' })
      return parseYoutubeVideoRun(json)
    },
    async chooseOption(runId, optionId) {
      try {
        const json = await request(YOUTUBE_VIDEO_PATHS.choose(runId), {
          method: 'POST',
          // Send both names so either contract draft accepts the body.
          body: JSON.stringify({ optionId, id: optionId }),
        })
        return parseYoutubeVideoRun(json)
      } catch (e) {
        if (e instanceof YoutubeVideoHttpError && e.status === 409) throw e
        throw e
      }
    },
    async revertRun(runId) {
      const json = await request(YOUTUBE_VIDEO_PATHS.revert(runId), { method: 'POST' })
      return parseYoutubeVideoRun(json)
    },
  }
}
