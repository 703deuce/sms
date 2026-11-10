'use client'

import { useMemo, useState } from 'react'
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
}) {
  const unified = useMemo(() => adaptStreamerClipsForUnifiedGrid(clips), [clips])
  const [typeFilter, setTypeFilter] = useState<UnifiedClipTypeFilter>('all')
  const [sort, setSort] = useState<UnifiedClipSort>('score')
  const status = streamerUnifiedGridStatus({
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
        error={error}
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
        clipsReady={clipsReady}
        clipsTotal={clipsTotal}
      />
    </div>
  )
}
