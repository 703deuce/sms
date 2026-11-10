'use client'

import { Clapperboard } from 'lucide-react'
import { Button } from '../ui/button'
import { EmptyState, Panel } from '../app/page-primitives'
import { ClipGrid, type ClipCardData } from './clip-grid'
import { UnifiedClipProgress } from './unified-clip-progress'
import { UnifiedResultsToolbar } from './unified-results-toolbar'
import type { ExportAspect } from '../../lib/clips/export-aspect'
import {
  filterSortUnifiedClips,
  unifiedClipCounts,
  type UnifiedClipResult,
  type UnifiedClipSort,
  type UnifiedClipTypeFilter,
} from '../../lib/clips/unified-clip-results'

export function UnifiedClipResults({
  clips,
  projectId,
  typeFilter,
  sort,
  onTypeFilterChange,
  onSortChange,
  status,
  error = null,
  onRetry,
  onDownload,
  onHidden,
  onChanged,
  isStreamer = false,
  cardAspect = '9:16',
  selectedIds,
  onToggleSelect,
  projectHasUpload = false,
  clipsReady = 0,
  clipsTotal = 0,
  etaSec = 0,
  stage = null,
}: {
  clips: UnifiedClipResult[]
  projectId: string
  typeFilter: UnifiedClipTypeFilter
  sort: UnifiedClipSort
  onTypeFilterChange: (next: UnifiedClipTypeFilter) => void
  onSortChange: (next: UnifiedClipSort) => void
  status: 'loading' | 'ready' | 'empty' | 'error'
  error?: string | null
  onRetry?: () => void
  onDownload?: (clipId: string) => void | Promise<void>
  onHidden?: (clipId: string) => void
  onChanged?: () => void
  isStreamer?: boolean
  cardAspect?: ExportAspect
  selectedIds?: Set<string>
  onToggleSelect?: (clipId: string) => void
  projectHasUpload?: boolean
  clipsReady?: number
  clipsTotal?: number
  etaSec?: number
  stage?: string | null
}) {
  const counts = unifiedClipCounts(clips)
  const displayed = filterSortUnifiedClips(clips, { type: typeFilter, sort })
  const title =
    counts.total === 0
      ? 'Clips'
      : `${counts.total} clip${counts.total === 1 ? '' : 's'} · ${counts.story} Story · ${counts.continuous} Continuous`

  if (status === 'loading') {
    return (
      <Panel title="Finding clips" description="Story and Continuous results arrive in one run.">
        <UnifiedClipProgress
          clipsReady={clipsReady}
          clipsTotal={clipsTotal}
          etaSec={etaSec}
          stage={stage}
        />
      </Panel>
    )
  }

  if (status === 'error') {
    return (
      <Panel title="Clips" description="This run did not finish.">
        <EmptyState
          icon={Clapperboard}
          title="Couldn't finish this clip run"
          description={error ?? 'Something went wrong while finding Story and Continuous clips.'}
          action={
            onRetry ? (
              <Button size="sm" variant="outline" onClick={onRetry}>
                Retry processing
              </Button>
            ) : undefined
          }
        />
      </Panel>
    )
  }

  if (status === 'empty' || clips.length === 0) {
    return (
      <Panel title="Clips" description="No Story or Continuous clips yet.">
        <EmptyState
          icon={Clapperboard}
          title="No clips found"
          description={
            error ??
            'No complete Story or Continuous moments were found in this segment.'
          }
          action={
            onRetry ? (
              <Button size="sm" variant="outline" onClick={onRetry}>
                Retry processing
              </Button>
            ) : undefined
          }
        />
      </Panel>
    )
  }

  return (
    <Panel
      title={title}
      description="Hover a card to preview. Edit opens the clip editor."
      actions={
        <UnifiedResultsToolbar
          typeFilter={typeFilter}
          sort={sort}
          onTypeFilterChange={onTypeFilterChange}
          onSortChange={onSortChange}
          storyCount={counts.story}
          continuousCount={counts.continuous}
        />
      }
    >
      {displayed.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title={typeFilter === 'story' ? 'No Story clips' : 'No Continuous clips'}
          description="Try the other type, or clear the filter to see every clip from this run."
        />
      ) : (
        <ClipGrid
          clips={displayed as ClipCardData[]}
          projectId={projectId}
          onDownload={onDownload}
          onHidden={onHidden}
          onChanged={onChanged}
          isStreamer={isStreamer}
          cardAspect={cardAspect}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          projectHasUpload={projectHasUpload}
        />
      )}
    </Panel>
  )
}
