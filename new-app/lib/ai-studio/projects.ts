import { EDITOR_PROJECTS_PATH } from './contract'
import { StudioClientError, mapStudioHttpError } from './errors'
import { parseEditorProjects } from './parse'

export type EditorProjectOption = { id: string; title: string }

export async function listEditorProjectsForStudio(
  fetchImpl: typeof fetch = fetch,
): Promise<EditorProjectOption[]> {
  let res: Response
  try {
    res = await fetchImpl(`${EDITOR_PROJECTS_PATH}?limit=50`, { credentials: 'include' })
  } catch (e) {
    throw new StudioClientError(
      mapStudioHttpError({ status: 0, networkMessage: e instanceof Error ? e.message : 'Network error' }),
    )
  }
  const contentType = res.headers.get('content-type') ?? ''
  const text = await res.text()
  let json: unknown = null
  if (contentType.includes('json')) {
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      json = null
    }
  }
  if (!res.ok) {
    throw new StudioClientError(mapStudioHttpError({ status: res.status, body: json, contentType }))
  }
  return parseEditorProjects(json)
}
