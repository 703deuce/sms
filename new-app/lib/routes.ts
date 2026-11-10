/** Canonical in-app paths for the SaaS under `/app`. Use this from #1117 and all first-party hrefs. */

export function withQuery(
  path: string,
  query?: URLSearchParams | string | Record<string, string | string[] | undefined | null>,
): string {
  if (!query) return path
  let params: URLSearchParams
  if (typeof query === 'string') {
    params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query)
  } else if (query instanceof URLSearchParams) {
    params = new URLSearchParams(query.toString())
  } else {
    params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value == null) continue
      if (Array.isArray(value)) value.forEach((item) => params.append(key, item))
      else params.set(key, value)
    }
  }
  const q = params.toString()
  return q ? `${path}?${q}` : path
}

export const routes = {
  app: () => '/app',
  clips: () => '/app/clips',
  clipsNew: (query?: Record<string, string | undefined>) => withQuery('/app/clips/new', query),
  project: (projectId: string) => `/app/clips/${projectId}`,
  youtubeVideo: () => '/app/youtube-video',
  videoEditor: () => '/app/video-editor',
  videoEditorNew: (query?: Record<string, string | undefined>) => withQuery('/app/video-editor/new', query),
  edit: (projectId: string, clipId: string, query?: URLSearchParams | string | Record<string, string | string[] | undefined | null>) =>
    withQuery(`/app/video-editor/${projectId}/edit/${clipId}`, query),
  text: (projectId: string, clipId: string, query?: URLSearchParams | string | Record<string, string | string[] | undefined | null>) =>
    withQuery('/app/video-editor/' + projectId + '/text/' + clipId, query),
  chat: (projectId: string, clipId: string, query?: URLSearchParams | string | Record<string, string | string[] | undefined | null>) =>
    withQuery('/app/video-editor/' + projectId + '/chat/' + clipId, query),
  templateMode: (projectId: string, clipId: string, query?: URLSearchParams | string | Record<string, string | string[] | undefined | null>) =>
    withQuery('/app/video-editor/' + projectId + '/templates/' + clipId, query),
  studio: (projectId: string, clipId: string, query?: URLSearchParams | string | Record<string, string | string[] | undefined | null>) =>
    withQuery(`/app/video-editor/${projectId}/studio/${clipId}`, query),
  script: (projectId: string, query?: URLSearchParams | string | Record<string, string | string[] | undefined | null>) =>
    withQuery(`/app/video-editor/${projectId}/script`, query),
  aiVideo: (projectId: string, query?: URLSearchParams | string | Record<string, string | string[] | undefined | null>) =>
    withQuery(`/app/ai-video/${projectId}`, query),
  aiVideoNew: (query?: URLSearchParams | string | Record<string, string | string[] | undefined | null>) =>
    withQuery('/app/ai-video/new', query),
  aiVideoTemplates: (query?: URLSearchParams | string | Record<string, string | string[] | undefined | null>) =>
    withQuery('/app/ai-video/templates', query),
  exports: () => '/app/exports',
  streamer: () => '/app/streamer',
  settings: () => '/app/settings',
  help: () => '/app/help',
  media: () => '/app/clips/media',
  brand: () => '/app/clips/brand',
  templates: () => '/app/clips/templates',
}

export { appRouteRedirects, applyAppRouteRedirect, STAY_PATHS } from './app-route-redirects.mjs'
