import { clipsFetch, deriveClipFromEditor } from '@/lib/clips-api'
import type { HighlightPick, HighlightRange } from '@/lib/clips/editor/highlights'
import { isPickMoved } from '@/lib/clips/editor/highlights'

export async function makeClipFromPick(
  foundProjectId: string,
  pick: HighlightPick,
  range: HighlightRange,
): Promise<{ clipId: string; navigated: 'existing' | 'derived' }> {
  if (!isPickMoved(pick, range)) {
    return { clipId: pick.clipId, navigated: 'existing' }
  }
  const res = await deriveClipFromEditor(pick.clipId, {
    trimIn: range.startMs,
    trimOut: range.endMs,
    title: pick.title,
  })
  return { clipId: res.clipId, navigated: 'derived' }
}

export type ProjectHighlightsResponse = {
  data: {
    source?: 'find' | 'project'
    status: string
    progress?: number | null
    foundProjectId?: string
    picks: HighlightPick[]
  } | null
}

export function fetchProjectHighlights(projectId: string) {
  return clipsFetch<ProjectHighlightsResponse>(`/api/clips/projects/${projectId}/highlights`)
}
