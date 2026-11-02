'use client'

import { MARKER_HEX, type Marker } from '@/lib/clips/editor/markers'

/**
 * TC1 (TL-28): markers on the ruler — a colored flag per marker (chapters get a "Ch" tag). Click =
 * seek, double-click = edit (label / color / chapter / delete) in the marker list.
 */
export function TimelineMarkers({
  markers,
  pxPerMs,
  xOf,
  height,
  onSeek,
  onEdit,
}: {
  markers: readonly Marker[] | undefined
  pxPerMs: number
  /** TC2: base ms → lane px (export-time lanes); default ms × pxPerMs. */
  xOf?: (ms: number) => number
  height: number
  onSeek: (ms: number) => void
  onEdit: (id: string) => void
}) {
  if (!markers?.length) return null
  return (
    <>
      {markers.map((m) => (
        <button
          key={m.id}
          type="button"
          className="absolute top-0 z-[18] flex -translate-x-1/2 flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ left: xOf ? xOf(m.ms) : m.ms * pxPerMs, height }}
          title={`${m.chapter ? 'Chapter' : 'Marker'}${m.label ? `: ${m.label}` : ''} · ${(m.ms / 1000).toFixed(2)} s — click to jump, double-click to edit`}
          aria-label={`Marker ${m.label ?? ''} at ${(m.ms / 1000).toFixed(2)} seconds`}
          data-testid="timeline-marker"
          data-marker-id={m.id}
          data-ms={m.ms}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onSeek(m.ms)
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            onEdit(m.id)
          }}
        >
          <span
            className="flex h-3 min-w-2 items-center rounded-sm px-0.5 text-[11px] font-semibold leading-none text-white shadow"
            style={{ background: MARKER_HEX[m.color] }}
          >
            {m.chapter ? 'Ch' : ''}
          </span>
          <span className="w-px flex-1" style={{ background: MARKER_HEX[m.color] }} />
        </button>
      ))}
    </>
  )
}
