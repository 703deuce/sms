'use client'

import { useMemo } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { angleAt, multicamAngles, setLayoutForRange } from '@/lib/clips/editor/multicam-manual'
import {
  layoutForKind,
  layoutPartnersForSegment,
  layoutPersistedOnSegment,
} from '@/lib/clips/editor/multicam-layout-pick'
import { normalizeSegmentLayout, LAYOUT_KIND_LABEL, type SegmentLayoutKind } from '@/lib/clips/editor/segment-layout'
import { normalizeSourceSegments, sourceSegmentAt, type ClipMediaSource } from '@/lib/clips/editor/sources'

const KINDS: SegmentLayoutKind[] = ['side_by_side', 'stack', 'pip', 'grid']

export { layoutForKind, layoutPartnersForSegment, layoutPersistedOnSegment }

export function MulticamSegmentLayoutControls({
  edits,
  library,
  playheadSourceMs,
  onEdits,
  onEditsPass,
  testId = 'multicam-playhead-layout',
}: {
  edits: ClipEditsV2
  library: readonly ClipMediaSource[]
  playheadSourceMs: number
  onEdits: (next: ClipEditsV2) => void
  onEditsPass?: (next: ClipEditsV2, label: string) => void
  testId?: string
}) {
  const lib = useMemo(() => {
    const ids = new Set(library.map((s) => s.id))
    const own = (edits.sources ?? []).filter((s) => !ids.has(s.id))
    return [...own, ...library]
  }, [edits.sources, library])
  const angles = multicamAngles(edits, lib)
  const playheadSeg = sourceSegmentAt(edits.sourceSegments, playheadSourceMs)
  const activeKind = playheadSeg
    ? normalizeSegmentLayout(playheadSeg.layout, edits.sources, playheadSeg.sourceId)?.kind
    : undefined

  const commit = (next: ClipEditsV2, label: string) => {
    if (onEditsPass) onEditsPass(next, label)
    else onEdits(next)
  }

  const applyLayout = (kind: SegmentLayoutKind | null) => {
    if (!playheadSeg) return
    const requested = kind ? layoutForKind(kind, playheadSeg.sourceId, edits, lib) : null
    if (kind && !requested) {
      toast.error("Couldn't apply layout")
      return
    }
    const next = setLayoutForRange(edits, playheadSeg.startMs, playheadSeg.endMs, requested, lib)
    if (!layoutPersistedOnSegment(next, playheadSeg, requested)) {
      toast.error("Couldn't apply layout")
      return
    }
    commit(next, kind ? LAYOUT_KIND_LABEL[kind] : 'Full frame')
  }

  if (angles.length < 2) return null

  const gridPartners = playheadSeg ? layoutPartnersForSegment(edits, lib, playheadSeg.sourceId) : []

  return (
    <section className="space-y-1.5 rounded-md border p-2" data-testid={testId}>
      <p className="text-xs font-semibold">Segment layout (playhead)</p>
      {!playheadSeg ? (
        <p className="text-[11px] text-muted-foreground">Switch an angle at the playhead (keys 1–9 or angle grid) before choosing a layout.</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {playheadSeg.sourceId} · {Math.round(playheadSeg.startMs / 1000)}s–{Math.round(playheadSeg.endMs / 1000)}s
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Segment layout">
        <Label className="sr-only">Layout</Label>
        <Button
          size="xs"
          variant={!activeKind ? 'default' : 'outline'}
          disabled={!playheadSeg}
          data-testid={`${testId}-single`}
          onClick={() => applyLayout(null)}
        >
          Single
        </Button>
        {KINDS.map((kind) => {
          if (kind === 'grid' && gridPartners.length < 3) return null
          const layout = playheadSeg ? layoutForKind(kind, playheadSeg.sourceId, edits, lib) : null
          return (
            <Button
              key={kind}
              size="xs"
              variant={activeKind === kind ? 'default' : 'outline'}
              disabled={!playheadSeg || !layout}
              data-testid={`${testId}-${kind}`}
              onClick={() => applyLayout(kind)}
            >
              {kind === 'grid' ? 'Grid' : LAYOUT_KIND_LABEL[kind]}
            </Button>
          )
        })}
      </div>
    </section>
  )
}

/** Side-by-side at playhead after switching to `sourceId` (shift-click on angle tile). */
export function sideBySideAfterAngleSwitch(
  edits: ClipEditsV2,
  playheadSourceMs: number,
  sourceId: string,
  library: readonly ClipMediaSource[],
): ClipEditsV2 {
  const seg = sourceSegmentAt(edits.sourceSegments, playheadSourceMs)
  if (!seg) return edits
  const lib = library
  const layout = layoutForKind('side_by_side', seg.sourceId, edits, lib)
  if (!layout) return edits
  const next = setLayoutForRange(edits, seg.startMs, seg.endMs, layout, lib)
  return layoutPersistedOnSegment(next, seg, layout) ? next : edits
}
