'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { writeClipEditorLayoutView } from '@/lib/clips/editor/editor-layout-view'

/** YouTube-only handoff: the shared editor's persisted layout is set before it mounts. */
export default function YoutubeVideoCompactEditorHandoff() {
  const params = useParams<{ projectId: string; clipId: string }>()

  useEffect(() => {
    if (!params.projectId || !params.clipId) return
    writeClipEditorLayoutView('script')
    window.location.replace(
      `/app/clips/${encodeURIComponent(params.projectId)}/edit/${encodeURIComponent(params.clipId)}`,
    )
  }, [params.projectId, params.clipId])

  return <p className="p-6 text-sm text-muted-foreground">Opening Compact editor…</p>
}
