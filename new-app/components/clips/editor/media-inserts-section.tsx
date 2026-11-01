'use client'

import { useMemo } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'
import { mediaUrlFor, type ProjectMediaApi } from '@/components/clips/editor/use-project-media'
import { MediaSceneSplit } from '@/components/clips/editor/g4/video-tools'
import { orderedKeepSegments, type ClipEditsV2 } from '@/lib/clips/edits'
import {
  INSERT_MIN_MS,
  insertWindows,
  patchInsert,
  removeInsert,
  type ClipInsert,
} from '@/lib/clips/editor/inserts'
import { insertWords } from '@/lib/clips/editor/media-words'
import { pruneSources, sourceById } from '@/lib/clips/editor/sources'
import { formatMediaDuration } from '@/lib/clips/media-transcribe-cost'

/**
 * E5b Media panel → "Inserted clips": every insert in play order with its sound, framing, length,
 * remove, and — once the clip is transcribed — its words, editable (stored as word fixes).
 */
export function InsertsSection({
  edits,
  media,
  onEdits,
}: {
  edits: ClipEditsV2
  media: ProjectMediaApi
  onEdits: (next: ClipEditsV2) => void
}) {
  const windows = useMemo(() => insertWindows(orderedKeepSegments(edits), edits.inserts), [edits])
  const words = useMemo(
    () => insertWords(windows, edits.sources, media.transcripts, edits.wordFixes),
    [windows, edits.sources, edits.wordFixes, media.transcripts],
  )
  if (!windows.length) return null
  const patch = (id: string, p: Parameters<typeof patchInsert>[2]) =>
    onEdits({ ...edits, inserts: patchInsert(edits.inserts, id, p, edits.sources) })
  const remove = (id: string) => {
    const inserts = removeInsert(edits.inserts, id)
    onEdits({ ...edits, inserts, sources: pruneSources(edits.sources, edits.sourceSegments, edits.multicam, inserts) })
  }
  const fixWord = (i: number, text: string) => {
    const wordFixes = { ...edits.wordFixes, [String(i)]: text }
    onEdits({ ...edits, wordFixes })
  }
  return (
    <section className="space-y-2 rounded-md border p-2" data-testid="media-inserts">
      <div className="text-xs font-semibold">Inserted clips</div>
      <p className="text-[11px] text-muted-foreground">These lengthen the video; everything after each one moves right.</p>
      {windows.map((w) => {
        const ins = edits.inserts?.find((i) => i.id === w.id) as ClipInsert
        const src = sourceById(edits.sources, w.sourceId)
        const maxMs = src?.mediaType === 'video' && src.durationMs ? Math.max(INSERT_MIN_MS, src.durationMs - w.inMs) : 30_000
        const myWords = words.filter((x) => x.insertId === w.id)
        return (
          <div key={w.id} className="space-y-1 rounded border p-1.5 text-[11px]" data-testid="media-insert-row">
            <div className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate font-medium" title={src?.label}>{w.freeze ? 'Freeze frame' : w.gap ? 'Gap' : src?.label ?? 'Clip'}</span>
              <span className="tabular-nums text-muted-foreground">
                {ins.append ? 'end' : `at ${formatMediaDuration(w.startMs)}`} · {(w.durMs / 1000).toFixed(1)} s
              </span>
              <Button size="xs" variant="ghost" aria-label="Remove insert" onClick={() => remove(w.id)} data-testid="media-insert-remove">
                <X className="size-3" />
              </Button>
            </div>
            {src?.mediaType === 'video' ? (
              <div className="flex items-center gap-1" role="group" aria-label="Sound during the insert">
                <Label className="w-12 text-[11px]">Sound</Label>
                {(['source', 'mute'] as const).map((a) => (
                  <Button key={a} size="xs" variant={w.audio === a ? 'default' : 'outline'} onClick={() => patch(w.id, { audio: a })} data-testid={`media-insert-audio-${a}`}>
                    {a === 'source' ? 'Clip' : 'Mute'}
                  </Button>
                ))}
              </div>
            ) : null}
            {w.gap ? null : (
            <div className="flex items-center gap-1" role="group" aria-label="Framing">
              <Label className="w-12 text-[11px]">Frame</Label>
              {(['cover', 'contain'] as const).map((f) => (
                <Button key={f} size="xs" variant={w.fit === f ? 'default' : 'outline'} onClick={() => patch(w.id, { fit: f })}>
                  {f === 'cover' ? 'Fill' : 'Fit'}
                </Button>
              ))}
            </div>
            )}
            {src?.mediaType === 'video' && !w.freeze && !w.gap ? (
              // G4cfix: scene split on inserted media (splits this insert into consecutive inserts).
              <MediaSceneSplit
                edits={edits}
                kind="insert"
                id={w.id}
                url={mediaUrlFor(media.items, src.refId)}
                inMs={w.inMs}
                outMs={w.inMs + w.durMs}
                onCommit={onEdits}
              />
            ) : null}
            <SliderRow
              label="Length"
              value={w.durMs / 1000}
              min={INSERT_MIN_MS / 1000}
              max={Math.max(INSERT_MIN_MS, maxMs) / 1000}
              step={0.1}
              unit=" s"
              testId="media-insert-length"
              onCommit={(v) => patch(w.id, { durMs: Math.round(v * 1000) })}
            />
            {myWords.length ? (
              <div className="flex flex-wrap gap-0.5" data-testid="media-insert-words">
                {myWords.map((x) => (
                  <input
                    key={x.i}
                    defaultValue={x.w}
                    aria-label="Word"
                    size={Math.max(2, x.w.length)}
                    className="rounded border-0 bg-muted/50 px-0.5 text-[11px] focus:bg-background focus:outline-1"
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== x.w) fixWord(x.i, v)
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
