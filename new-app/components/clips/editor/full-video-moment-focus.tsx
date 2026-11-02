'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { clampPickDrag } from '@/lib/clips/editor/highlights'
import { formatMomentMs } from '@/lib/clips/format-moment-ms'
import { deriveClipFromEditor } from '@/lib/clips-api'

export type FullVideoMomentFocus = {
  fromClipId: string
  startMs: number
  endMs: number
  title: string
  onRangeChange: (next: { startMs: number; endMs: number }) => void
  onMakeClip: () => void
}

/** Q5 CL-05: open-in-full-video lands with a draggable moment range (even without highlights lane). */
export function useFullVideoMomentFocus(
  fullVideo: boolean,
  durationMs: number,
): FullVideoMomentFocus | null {
  const searchParams = useSearchParams()
  const router = useRouter()
  const fromClipId = searchParams.get('fromClip') ?? searchParams.get('focusClip')
  const momentIn = Number(searchParams.get('momentIn'))
  const momentOut = Number(searchParams.get('momentOut'))
  const titleParam = searchParams.get('momentTitle') ?? 'Clip moment'

  const [range, setRange] = useState<{ startMs: number; endMs: number } | null>(null)

  useEffect(() => {
    if (!fullVideo || !fromClipId) {
      setRange(null)
      return
    }
    const startMs = Number.isFinite(momentIn) ? momentIn : 0
    const endMs = Number.isFinite(momentOut) && momentOut > startMs ? momentOut : startMs + 5000
    setRange({ startMs, endMs })
  }, [fullVideo, fromClipId, momentIn, momentOut])

  const onRangeChange = useCallback((next: { startMs: number; endMs: number }) => {
    setRange(next)
  }, [])

  const onMakeClip = useCallback(() => {
    if (!fromClipId || !range) return
    void (async () => {
      try {
        const res = await deriveClipFromEditor(fromClipId, {
          trimIn: range.startMs,
          trimOut: range.endMs,
          title: titleParam.slice(0, 120),
        })
        toast.success('New clip created', {
          action: {
            label: 'Open',
            onClick: () => router.push(`/app/clips/${res.projectId}/edit/${res.clipId}`),
          },
        })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Make clip failed')
      }
    })()
  }, [fromClipId, range, router, titleParam])

  return useMemo(() => {
    if (!fullVideo || !fromClipId || !range) return null
    return {
      fromClipId,
      startMs: range.startMs,
      endMs: range.endMs,
      title: titleParam,
      onRangeChange,
      onMakeClip,
    }
  }, [fullVideo, fromClipId, range, titleParam, onRangeChange, onMakeClip])
}

export type MomentFocusLaneProps = {
  durationMs: number
  pxPerMs: number
  offsetPx: number
  focus: FullVideoMomentFocus
  onSeek: (ms: number) => void
}

export function FullVideoMomentLane({ durationMs, pxPerMs, offsetPx, focus, onSeek }: MomentFocusLaneProps) {
  const xs = (ms: number) => offsetPx + ms * pxPerMs
  const left = xs(focus.startMs)
  const w = Math.max(6, xs(focus.endMs) - left)
  const timeLabel = `${formatMomentMs(focus.startMs)}–${formatMomentMs(focus.endMs)}`
  return (
    <div className="relative h-9 border-b border-amber-500/30 bg-amber-500/10" data-testid="full-video-moment-lane">
      <div
        className="absolute top-0.5 min-h-8 rounded-sm border border-amber-400/80 bg-amber-500/40 py-0.5 text-[9px] leading-tight text-white shadow-sm"
        style={{ left, width: w }}
        data-testid="full-video-moment-range"
      >
        <span
          className="pointer-events-none block truncate px-1 tabular-nums"
          data-testid="full-video-moment-times"
        >
          {timeLabel}
        </span>
        <span className="pointer-events-none block truncate px-1 opacity-80">{focus.title}</span>
        <button
          type="button"
          data-testid="moment-edge-start"
          className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-white/50"
          onPointerDown={(e) => {
            e.stopPropagation()
            const x0 = e.clientX
            const start0 = focus.startMs
            const move = (ev: PointerEvent) => {
              const next = clampPickDrag(
                { startMs: start0, endMs: focus.endMs },
                'start',
                start0 + (ev.clientX - x0) / pxPerMs,
                durationMs,
              )
              focus.onRangeChange(next)
            }
            const up = () => {
              window.removeEventListener('pointermove', move)
              window.removeEventListener('pointerup', up)
            }
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', up)
          }}
        />
        <button
          type="button"
          data-testid="moment-edge-end"
          className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-white/50"
          onPointerDown={(e) => {
            e.stopPropagation()
            const x0 = e.clientX
            const end0 = focus.endMs
            const move = (ev: PointerEvent) => {
              const next = clampPickDrag(
                { startMs: focus.startMs, endMs: end0 },
                'end',
                end0 + (ev.clientX - x0) / pxPerMs,
                durationMs,
              )
              focus.onRangeChange(next)
            }
            const up = () => {
              window.removeEventListener('pointermove', move)
              window.removeEventListener('pointerup', up)
            }
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', up)
          }}
        />
        <div
          className="absolute left-0 top-full z-20 mt-1 flex gap-1 rounded-md border border-border bg-popover p-2 text-[10px] shadow-md"
          data-testid="full-video-moment-popover"
        >
          <button
            type="button"
            className="rounded bg-primary px-2 py-0.5 text-primary-foreground"
            data-testid="moment-make-clip"
            onClick={() => focus.onMakeClip()}
          >
            Make clip
          </button>
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5"
            onClick={() => onSeek(focus.startMs)}
          >
            Seek
          </button>
        </div>
      </div>
    </div>
  )
}
