'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CUT_ONLY_TRANSITIONS,
  MASK_TRANSITIONS,
  TRANSITION_INFO,
  TRANSITIONS,
  xfadeBWeight,
  TRANSITION_DEFAULT_MS,
  TRANSITION_MAX_MS,
  TRANSITION_MIN_MS,
  type TransitionSpec,
  type TransitionType,
} from '@/lib/clips/editor/transitions'
import { Slider } from '@/components/ui/slider'

const GROUPS = ['Basic', 'Push', 'Wipe', 'Soft wipe', 'Shape', 'Slice', 'Zoom & blur', 'Slide', 'Stylized'] as const

const thumbCache = new Map<string, string | null>()
/** G4b: mask transitions draw their real xfade mask (mid-way) as the thumbnail. */
function maskThumb(type: TransitionType): string | null {
  if (thumbCache.has(type)) return thumbCache.get(type)!
  let url: string | null = null
  try {
    const c = document.createElement('canvas')
    c.width = 40
    c.height = 28
    const ctx = c.getContext('2d')
    if (ctx) {
      const img = ctx.createImageData(40, 28)
      for (let y = 0; y < 28; y++)
        for (let x = 0; x < 40; x++) {
          const w = xfadeBWeight(TRANSITION_INFO[type].xfade, 0.55, x, y, 40, 28)
          const i = (y * 40 + x) * 4
          img.data[i] = Math.round(14 * (1 - w) + 217 * w)
          img.data[i + 1] = Math.round(165 * (1 - w) + 70 * w)
          img.data[i + 2] = Math.round(233 * (1 - w) + 239 * w)
          img.data[i + 3] = 255
        }
      ctx.putImageData(img, 0, 0)
      url = c.toDataURL()
    }
  } catch {
    url = null
  }
  thumbCache.set(type, url)
  return url
}

/** Tiny CSS thumbnails so the grid reads like CapCut's transition panel. */
function Thumb({ type }: { type: TransitionType | 'none' }) {
  const a = 'bg-sky-500'
  const b = 'bg-fuchsia-500'
  const base = 'relative h-7 w-10 overflow-hidden rounded-sm'
  if (type === 'none') return <div className={`${base} ${a}`} />
  if (MASK_TRANSITIONS.has(type)) {
    const url = typeof document === 'undefined' ? null : maskThumb(type)
    return url ? (
      <img src={url} alt="" className={base} draggable={false} />
    ) : (
      <div className={`${base} bg-gradient-to-br from-sky-500 to-fuchsia-500`} />
    )
  }
  if (type === 'dip_black' || type === 'dip_white') {
    return (
      <div className={`${base} flex`}>
        <div className={`h-full w-1/3 ${a}`} />
        <div className={`h-full w-1/3 ${type === 'dip_black' ? 'bg-black' : 'bg-white'}`} />
        <div className={`h-full w-1/3 ${b}`} />
      </div>
    )
  }
  if (type.startsWith('push_') || type.startsWith('wipe_')) {
    const dir = type.split('_')[1]
    const vertical = dir === 'up' || dir === 'down'
    return (
      <div className={`${base} flex ${vertical ? 'flex-col' : ''} ${dir === 'right' || dir === 'down' ? 'flex-row-reverse' : ''}`}>
        <div className={`${vertical ? 'h-1/2 w-full' : 'h-full w-1/2'} ${a}`} />
        <div className={`${vertical ? 'h-1/2 w-full' : 'h-full w-1/2'} ${b} ${type.startsWith('wipe_') ? 'opacity-90' : ''}`} />
      </div>
    )
  }
  if (type === 'zoom_in' || type === 'zoom_out') {
    return (
      <div className={`${base} ${a} flex items-center justify-center`}>
        <div className={`${type === 'zoom_in' ? 'size-5' : 'size-3'} rounded-sm ${b}`} />
      </div>
    )
  }
  if (type === 'blur') return <div className={`${base} bg-gradient-to-r from-sky-500 via-violet-400 to-fuchsia-500 blur-[1px]`} />
  return <div className={`${base} bg-gradient-to-r from-sky-500 to-fuchsia-500`} />
}

/**
 * Transition picker opened from a cut point (CapCut convention): tile grid, duration slider,
 * Apply to all, Remove. Picking a tile applies immediately (one undo step); the duration slider
 * commits on release.
 */
export function TransitionPopover({
  title,
  value,
  maxMs = TRANSITION_MAX_MS,
  anchor,
  onApply,
  onApplyAll,
  onClose,
  brollEdge = false,
}: {
  title: string
  value: TransitionSpec | null
  /** Longest duration this cut can take (shorter adjacent clip). */
  maxMs?: number
  anchor: { x: number; y: number }
  onApply: (spec: TransitionSpec | null) => void
  onApplyAll?: (spec: TransitionSpec | null) => void
  onClose: () => void
  /** TR-04: B-roll in/out picker hides cut-only Slide / Stylized types. */
  brollEdge?: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const cap = Math.max(TRANSITION_MIN_MS, Math.min(TRANSITION_MAX_MS, maxMs))
  const [durMs, setDurMs] = useState(Math.min(cap, value?.durMs ?? TRANSITION_DEFAULT_MS))
  useEffect(() => setDurMs(Math.min(cap, value?.durMs ?? TRANSITION_DEFAULT_MS)), [cap, value?.durMs])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [onClose])
  // One undo step per committed duration (slider release / keyboard / ± buttons).
  const commitDur = (n: number) => {
    const d = Math.round(Math.min(cap, Math.max(TRANSITION_MIN_MS, n)))
    setDurMs(d)
    if (value && value.durMs !== d) onApply({ type: value.type, durMs: d })
  }
  const stepDur = (delta: number) => commitDur(durMs + delta)
  const left = typeof window === 'undefined' ? anchor.x : Math.max(8, Math.min(anchor.x - 150, window.innerWidth - 316))
  const top = typeof window === 'undefined' ? anchor.y : Math.max(8, Math.min(anchor.y - 330, window.innerHeight - 340))
  const tile = 'flex flex-col items-center gap-0.5 rounded p-1 text-[9px] leading-tight hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const pickerTransitions = brollEdge ? TRANSITIONS.filter((t) => !CUT_ONLY_TRANSITIONS.has(t.type)) : TRANSITIONS
  return (
    <div
      ref={ref}
      className="fixed z-50 w-[300px] rounded-md border border-border bg-popover p-2 text-xs shadow-lg"
      style={{ left, top }}
      role="dialog"
      aria-label={title}
      data-testid="transition-popover"
    >
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[11px] font-medium">{title}</p>
        <button type="button" className="rounded px-1 text-muted-foreground hover:bg-muted" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="max-h-[260px] space-y-1 overflow-y-auto">
        <div className="grid grid-cols-5 gap-0.5">
          <button
            type="button"
            className={`${tile} ${!value ? 'bg-muted ring-1 ring-primary' : ''}`}
            onClick={() => onApply(null)}
            aria-pressed={!value}
            data-testid="transition-tile-none"
          >
            <Thumb type="none" />
            Cut
          </button>
        </div>
        {GROUPS.map((g) => {
          const tiles = pickerTransitions.filter((t) => t.group === g)
          if (!tiles.length) return null
          return (
          <div key={g}>
            <p className="px-1 text-[9px] uppercase tracking-wide text-muted-foreground">{g}</p>
            <div className="grid grid-cols-5 gap-0.5">
              {tiles.map((t) => {
                const active = value?.type === t.type
                return (
                  <button
                    key={t.type}
                    type="button"
                    className={`${tile} ${active ? 'bg-muted ring-1 ring-primary' : ''}`}
                    onClick={() => onApply({ type: t.type, durMs })}
                    aria-pressed={active}
                    title={t.label}
                    data-testid={`transition-tile-${t.type}`}
                  >
                    <Thumb type={t.type} />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>
          )
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">
          Duration
        </span>
        <button
          type="button"
          className="rounded border border-border px-1 leading-4 hover:bg-muted"
          onClick={() => stepDur(-100)}
          aria-label="Shorter"
          data-testid="transition-duration-dec"
        >
          −
        </button>
        <Slider
          className="flex-1"
          min={TRANSITION_MIN_MS}
          max={cap}
          step={50}
          value={[durMs]}
          onValueChange={(v) => {
            const n = Array.isArray(v) ? v[0] : v
            if (typeof n === 'number') setDurMs(n)
          }}
          onValueCommitted={(v) => {
            const n = Array.isArray(v) ? v[0] : v
            if (typeof n === 'number') commitDur(n)
          }}
          aria-label="Transition duration"
          data-testid="transition-duration"
        />
        <button
          type="button"
          className="rounded border border-border px-1 leading-4 hover:bg-muted"
          onClick={() => stepDur(100)}
          aria-label="Longer"
          data-testid="transition-duration-inc"
        >
          +
        </button>
        <span className="w-10 text-right text-[10px] tabular-nums" data-testid="transition-duration-label">
          {(durMs / 1000).toFixed(2)}s
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        {onApplyAll ? (
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-40"
            disabled={!value}
            onClick={() => value && onApplyAll({ type: value.type, durMs })}
            data-testid="transition-apply-all"
          >
            Apply to all
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-40"
          disabled={!value}
          onClick={() => onApply(null)}
          data-testid="transition-remove"
        >
          Remove
        </button>
      </div>
    </div>
  )
}
