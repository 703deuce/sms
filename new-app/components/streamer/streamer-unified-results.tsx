'use client'

import { useEffect, useMemo, useState } from 'react'
import { clipsFetch } from '../../lib/clips-api'
import { UnifiedClipResults } from '../clips/unified-clip-results'
import {
  adaptStreamerClipsForUnifiedGrid,
  streamerUnifiedGridStatus,
} from '../../lib/clips/adapt-streamer-unified-clips'
import type { UnifiedClipSort, UnifiedClipTypeFilter } from '../../lib/clips/unified-clip-results'
import { retryProject } from '../../lib/clips-api'

export function StreamerUnifiedResults({
  clips,
  fallbackProjectId,
  processing = false,
  failed = false,
  error = null,
  retryProjectId = null,
  etaSec = 0,
  stage = null,
  clipsReady = 0,
  clipsTotal = 0,
  loadAfterPaint = false,
}: {
  /** Existing list-project-clips rows (or already-adapted unified clips). */
  clips: unknown[]
  /** Used when a clip row has no projectId. */
  fallbackProjectId: string
  processing?: boolean
  failed?: boolean
  error?: string | null
  retryProjectId?: string | null
  etaSec?: number
  stage?: string | null
  clipsReady?: number
  clipsTotal?: number
  loadAfterPaint?: boolean
}) {
  const [loaded, setLoaded] = useState<unknown[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  useEffect(() => {
    if (!loadAfterPaint) return
    let active = true
    const started = Date.now()
    console.info('[page:timing]', { path: '/app/streamer', query: 'client_clip_load_start' })
    void clipsFetch<{ clips: unknown[] }>('/api/streamer/clips-hub')
      .then((data) => {
        if (!active) return
        setLoaded(data.clips)
        console.info('[page:timing]', { path: '/app/streamer', query: 'client_clip_load_done', elapsedMs: Date.now() - started, rows: data.clips.length })
      })
      .catch((err) => {
        if (!active) return
        console.warn('[page:timing]', { path: '/app/streamer', query: 'client_clip_load_failed', elapsedMs: Date.now() - started, error: String(err) })
        setLoadError('Could not load your clips. Refresh this page to try again.')
      })
    return () => { active = false }
  }, [loadAfterPaint])
  const pending = loadAfterPaint && loaded === null && loadError === null
  const unified = useMemo(() => adaptStreamerClipsForUnifiedGrid(loadAfterPaint ? loaded ?? [] : clips), [clips, loadAfterPaint, loaded])
  const [typeFilter, setTypeFilter] = useState<UnifiedClipTypeFilter>('all')
  const [sort, setSort] = useState<UnifiedClipSort>('score')
  const status = loadError ? 'error' : pending ? 'loading' : streamerUnifiedGridStatus({
    clipCount: unified.length,
    processing,
    failed,
  })
  const projectId = unified[0]?.projectId || fallbackProjectId

  return (
    <div data-testid="streamer-unified-results">
      <UnifiedClipResults
        clips={unified}
        projectId={projectId}
        typeFilter={typeFilter}
        sort={sort}
        onTypeFilterChange={setTypeFilter}
        onSortChange={setSort}
        status={status}
        error={loadError ?? error}
        onRetry={
          retryProjectId
            ? () => {
                void retryProject(retryProjectId)
              }
            : undefined
        }
        isStreamer
        etaSec={etaSec}
        stage={stage}
        clipsReady={Math.max(clipsReady, unified.length)}
        clipsTotal={clipsTotal}
      />
    </div>
  )
}
