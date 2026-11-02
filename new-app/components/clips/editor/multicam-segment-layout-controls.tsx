'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { angleAt, multicamAngles, setLayoutForRange } from '@/lib/clips/editor/multicam-manual'
import { LAYOUT_KIND_LABEL, type SegmentLayoutKind, type SourceSegmentLayout } from '@/lib/clips/editor/segment-layout'
import type { ClipMediaSource } from '@/lib/clips/editor/sources'
import { sourceSegmentAt } from '@/lib/clips/editor/sources'

const KINDS: SegmentLayoutKind[] = ['side_by_side', 'stack', 'pip', 'grid']

export function layoutForKind(
  kind: SegmentLayoutKind,
  segSourceId: string,
  library: readonly ClipMediaSource[],
  angleCount: number,
): SourceSegmentLayout | null {
  if (kind === 'grid' && angleCount < 3) return null
  const other = library.find((s) => s.id !== segSourceId)?.id ?? 'main'
  if (kind === 'grid') {
    const ids = library.map((s) => s.id).filter((id) => id !== segSourceId)
    return { kind, withSourceId: other, withSourceId2: 'main', withSourceId3: ids[1] ?? 'main' }
  }
  return { kind, withSourceId: other }
}

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
  const activeKind = playheadSeg?.layout?.kind

  const commit = (next: ClipEditsV2, label: string) => {
    if (onEditsPass) onEditsPass(next, label)
    else onEdits(next)
  }

  if (angles.length < 2) return null

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
          onClick={() => {
            if (!playheadSeg) return
            commit(setLayoutForRange(edits, playheadSeg.startMs, playheadSeg.endMs, null, lib), 'Full frame')
          }}
        >
          Single
        </Button>
        {KINDS.map((kind) => {
          if (kind === 'grid' && angles.length < 3) return null
          const layout = playheadSeg ? layoutForKind(kind, playheadSeg.sourceId, lib, angles.length) : null
          return (
            <Button
              key={kind}
              size="xs"
              variant={activeKind === kind ? 'default' : 'outline'}
              disabled={!playheadSeg || !layout}
              data-testid={`${testId}-${kind}`}
              onClick={() => {
                if (!playheadSeg || !layout) return
                commit(
                  setLayoutForRange(edits, playheadSeg.startMs, playheadSeg.endMs, layout, lib),
                  LAYOUT_KIND_LABEL[kind],
                )
              }}
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
  const active = angleAt(edits, playheadSourceMs)
  const withSourceId = active === sourceId ? 'main' : active
  return setLayoutForRange(
    edits,
    seg.startMs,
    seg.endMs,
    { kind: 'side_by_side', withSourceId, split: 0.5 },
    library,
  )
}
