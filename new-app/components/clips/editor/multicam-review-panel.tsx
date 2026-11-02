'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MAIN_ANGLE } from '@/lib/clips/editor/multicam-manual'
import { pruneSources, sourceById } from '@/lib/clips/editor/sources'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { formatTimecode } from '@/lib/clips/format'

export function MulticamReviewPanel({
  edits,
  angles,
  mainLabel,
  onEditsPass,
  onSeekSource,
}: {
  edits: ClipEditsV2
  angles: ProjectMediaItem[]
  mainLabel?: string
  onEditsPass: (next: ClipEditsV2, label: string) => void
  onSeekSource: (sourceMs: number) => void
}) {
  const segments = [...(edits.sourceSegments ?? [])].sort((a, b) => a.startMs - b.startMs)
  if (!segments.length) return null

  const angleOptions = [
    { value: MAIN_ANGLE, label: mainLabel ? `${mainLabel} (main)` : 'Main camera' },
    ...angles.map((a) => ({ value: a.refId, label: a.label })),
  ]

  const setAngle = (segId: string, sourceId: string) => {
    const sourceSegments = (edits.sourceSegments ?? []).map((s) => (s.id === segId ? { ...s, sourceId } : s))
    onEditsPass({ ...edits, sourceSegments }, 'Multicam: change angle')
  }

  const deleteSwitch = (segId: string) => {
    const sourceSegments = (edits.sourceSegments ?? []).filter((x) => x.id !== segId)
    onEditsPass(
      {
        ...edits,
        sourceSegments: sourceSegments.length ? sourceSegments : undefined,
        sources: pruneSources(edits.sources, sourceSegments, edits.multicam, edits.inserts),
      },
      'Multicam: delete switch',
    )
  }

  return (
    <section className="space-y-2 rounded-md border p-2" data-testid="multicam-review">
      <p className="text-xs font-semibold">Switch review</p>
      <p className="text-[11px] text-muted-foreground">Jump, change angle, or delete each camera switch (one undo per edit).</p>
      <ul className="max-h-52 space-y-1 overflow-y-auto rounded border border-dashed p-1.5 text-[11px]">
        {segments.map((s) => {
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-1" data-testid={`multicam-switch-${s.id}`}>
              <span className="tabular-nums">{formatTimecode(s.startMs)}</span>
              {s.auto ? <span className="text-muted-foreground">auto</span> : null}
              <Select
                items={angleOptions}
                value={s.sourceId}
                onValueChange={(v) => typeof v === 'string' && setAngle(s.id, v === MAIN_ANGLE ? MAIN_ANGLE : v)}
              >
                <SelectTrigger size="sm" className="h-7 min-w-[120px] flex-1" data-testid={`multicam-angle-${s.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {angleOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="xs" variant="outline" className="h-6" onClick={() => onSeekSource(s.startMs)}>
                Jump
              </Button>
              <Button size="xs" variant="ghost" className="h-6 text-destructive" onClick={() => deleteSwitch(s.id)}>
                Delete
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
