'use client'

import { Copy, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { chapterText, MARKER_COLORS, MARKER_HEX, MARKER_LABEL_MAX, type Marker } from '@/lib/clips/editor/markers'

/** TC1 (TL-28): marker list — rename, recolor, chapter flag, delete, jump; "Copy chapters". */
export function MarkerList({
  markers,
  focusId,
  durationMs,
  editable,
  onPatch,
  onSeek,
  onClose,
}: {
  markers: readonly Marker[] | undefined
  focusId: string | null
  durationMs: number
  editable: boolean
  onPatch: (id: string, patch: Partial<Omit<Marker, 'id'>> | null) => void
  onSeek: (ms: number) => void
  onClose: () => void
}) {
  const list = markers ?? []
  const copy = async () => {
    const text = chapterText(list, durationMs)
    if (!text) {
      toast.message('Tick “Chapter” on at least one marker first', { id: 'markers' })
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.message('Chapters copied — paste them into the video description', { id: 'markers' })
    } catch {
      toast.message(text, { id: 'markers' })
    }
  }
  return (
    <div className="absolute right-2 top-9 z-50 w-72 rounded-md border border-border bg-popover p-2 text-xs shadow-lg" role="dialog" aria-label="Markers" data-testid="marker-list">
      <div className="mb-1 flex items-center gap-1">
        <span className="flex-1 font-semibold">Markers</span>
        <button type="button" className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted" onClick={copy} data-testid="marker-copy-chapters" title="Copy a YouTube chapter list (0:00 Intro …) from the markers ticked as chapters">
          <Copy className="size-3" /> Copy chapters
        </button>
        <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={onClose} aria-label="Close markers">
          <X className="size-3.5" />
        </button>
      </div>
      {!list.length ? <p className="text-muted-foreground">No markers yet — press M at the playhead.</p> : null}
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {list.map((m) => (
          <div key={m.id} className={`space-y-1 rounded border p-1 ${focusId === m.id ? 'border-primary' : 'border-border'}`} data-testid="marker-row">
            <div className="flex items-center gap-1">
              <button type="button" className="tabular-nums text-primary hover:underline" onClick={() => onSeek(m.ms)}>
                {(m.ms / 1000).toFixed(2)} s
              </button>
              <input
                key={`${m.id}:${m.label ?? ''}`}
                defaultValue={m.label ?? ''}
                maxLength={MARKER_LABEL_MAX}
                placeholder="Label"
                aria-label="Marker label"
                autoFocus={focusId === m.id}
                disabled={!editable}
                className="min-w-0 flex-1 rounded border border-border bg-background px-1 py-0.5"
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v !== (m.label ?? '')) onPatch(m.id, { label: v || undefined })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                data-testid="marker-label"
              />
              <button type="button" className="rounded p-0.5 hover:bg-muted disabled:opacity-40" disabled={!editable} onClick={() => onPatch(m.id, null)} aria-label="Delete marker" data-testid="marker-delete">
                <Trash2 className="size-3" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              {MARKER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={!editable}
                  className={`size-3.5 rounded-full ${m.color === c ? 'ring-2 ring-foreground ring-offset-1' : ''}`}
                  style={{ background: MARKER_HEX[c] }}
                  onClick={() => onPatch(m.id, { color: c })}
                  aria-label={`Color ${c}`}
                  aria-pressed={m.color === c}
                />
              ))}
              <label className="ml-auto inline-flex items-center gap-1">
                <input type="checkbox" checked={Boolean(m.chapter)} disabled={!editable} onChange={(e) => onPatch(m.id, { chapter: e.target.checked ? true : undefined })} data-testid="marker-chapter" />
                Chapter
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
