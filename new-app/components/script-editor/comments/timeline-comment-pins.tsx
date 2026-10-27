'use client'

import type { CommentThreadDto } from '@/lib/server/clips/composition-comments'

export function TimelineCommentPins({
  threads,
  widthPx,
  pxPerMs,
  durationMs,
  onSeek,
}: {
  threads: CommentThreadDto[]
  widthPx: number
  pxPerMs: number
  durationMs: number
  onSeek: (outMs: number) => void
}) {
  const span = Math.max(1, durationMs)
  return (
    <div className="pointer-events-none absolute inset-0 z-20" style={{ width: widthPx }} aria-hidden>
      {threads
        .filter((t) => !t.resolvedAt)
        .map((t) => {
          const left = Math.min(span, Math.max(0, t.startOutMs)) * pxPerMs
          const initial = (t.comments[0]?.authorName ?? '?').slice(0, 1).toUpperCase()
          return (
            <button
              key={t.id}
              type="button"
              className="pointer-events-auto absolute top-0.5 size-2.5 -translate-x-1/2 rounded-full border border-background bg-lane-brand text-[8px] font-semibold leading-none text-white"
              style={{ left }}
              title={t.comments[0]?.body ?? 'Comment'}
              onClick={() => onSeek(t.startOutMs)}
            >
              {initial}
            </button>
          )
        })}
    </div>
  )
}
