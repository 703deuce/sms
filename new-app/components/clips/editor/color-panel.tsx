'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  ADJUST_KEYS,
  ADJUST_LABELS,
  ADJUST_MAX,
  ADJUST_MIN,
  COLOR_PRESET_IDS,
  COLOR_PRESETS,
  applyLook,
  lookForSpec,
  normalizeColorSpec,
  setBrollLook,
  setSegmentLook,
  setVideoLook,
  videoSpecAtSource,
  type ColorAdjustKey,
  type ColorSpec,
} from '@/lib/clips/editor/color'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'

/** What the Color panel edits: the whole video, one Video-lane item (source range) or one B-roll item. */
export type ColorTarget =
  | { kind: 'video' }
  | { kind: 'segment'; fromMs: number; toMs: number; label: string }
  | { kind: 'broll'; id: string; label: string }

function specFor(edits: ClipEditsV2, t: ColorTarget): ColorSpec {
  if (t.kind === 'broll') return edits.color?.broll?.[t.id] ?? {}
  if (t.kind === 'segment') {
    const own = edits.color?.segments?.find((s) => s.fromMs === t.fromMs && s.toMs === t.toMs)
    return own?.spec ?? videoSpecAtSource(edits.color, t.fromMs) ?? {}
  }
  return edits.color?.video ?? {}
}

function withSpec(edits: ClipEditsV2, t: ColorTarget, spec: ColorSpec | null): ClipEditsV2 {
  const clean = spec ? normalizeColorSpec(spec) ?? null : null
  let color = edits.color
  if (t.kind === 'video') color = setVideoLook(color, clean)
  else if (t.kind === 'segment') color = setSegmentLook(color, t.fromMs, t.toMs, clean ?? {})
  else color = setBrollLook(color, t.id, clean)
  return { ...edits, color }
}

/** Swatch: the look applied to a fixed 4-colour strip (same math as preview + export). */
function Swatch({ spec }: { spec: ColorSpec }) {
  const cols = useMemo(() => {
    const look = lookForSpec(spec)
    return ([[0.85, 0.55, 0.42], [0.2, 0.5, 0.8], [0.3, 0.65, 0.3], [0.9, 0.85, 0.75]] as [number, number, number][]).map((p) => {
      const [r, g, b] = applyLook(look, p)
      return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
    })
  }, [spec])
  return (
    <span className="grid h-9 w-full grid-cols-4 overflow-hidden rounded-md">
      {cols.map((c, i) => (
        <span key={i} style={{ background: c }} />
      ))}
    </span>
  )
}

/**
 * E4 Color (CapCut Filters + Adjustment). Target follows the timeline selection: a Video item →
 * that item; a B-roll item → that B-roll; nothing → the whole video. "Apply to all" copies the
 * current look to the whole video and clears per-item overrides.
 */
export function ColorPanel({
  edits,
  target,
  onEdits,
  onLive,
}: {
  edits: ClipEditsV2
  target: ColorTarget
  onEdits: (e: ClipEditsV2) => void
  onLive?: (e: ClipEditsV2 | null) => void
}) {
  const spec = specFor(edits, target)
  const commit = (s: ColorSpec | null) => {
    onLive?.(null)
    onEdits(withSpec(edits, target, s))
  }
  const live = (s: ColorSpec) => onLive?.(withSpec(edits, target, s))
  const setAdj = (k: ColorAdjustKey, v: number) => ({ ...spec, adjust: { ...(spec.adjust ?? {}), [k]: v } })
  const title =
    target.kind === 'video' ? 'Whole video' : target.kind === 'segment' ? `Video · ${target.label}` : `B-roll · ${target.label}`

  return (
    <div className="space-y-4 p-3 text-sm" data-testid="color-panel">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium" data-testid="color-target">
          {title}
        </p>
        <div className="flex gap-1">
          {target.kind !== 'broll' ? (
            <Button
              size="xs"
              variant="outline"
              data-testid="color-apply-all"
              onClick={() => onEdits({ ...edits, color: setVideoLook(edits.color, normalizeColorSpec(spec) ?? null, true) })}
            >
              Apply to all
            </Button>
          ) : null}
          <Button size="xs" variant="ghost" data-testid="color-reset" onClick={() => commit(null)}>
            Reset
          </Button>
        </div>
      </div>
      {target.kind === 'video' ? (
        <p className="text-[11px] text-muted-foreground">Select a clip or B-roll on the timeline to color just that item.</p>
      ) : null}

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            data-testid="color-filter-none"
            data-active={!spec.preset ? 'true' : 'false'}
            className={cn('rounded-lg border p-1 text-[11px]', !spec.preset ? 'border-primary ring-2 ring-primary/20' : 'border-border')}
            onClick={() => commit({ ...spec, preset: undefined, intensity: undefined })}
          >
            <Swatch spec={{ adjust: spec.adjust }} />
            None
          </button>
          {COLOR_PRESET_IDS.map((id) => {
            const active = spec.preset === id
            return (
              <button
                key={id}
                type="button"
                data-testid={`color-filter-${id}`}
                data-active={active ? 'true' : 'false'}
                className={cn('rounded-lg border p-1 text-[11px]', active ? 'border-primary ring-2 ring-primary/20' : 'border-border')}
                onClick={() => commit({ ...spec, preset: id, intensity: spec.preset === id ? spec.intensity : undefined })}
              >
                <Swatch spec={{ preset: id }} />
                {COLOR_PRESETS[id].label}
              </button>
            )
          })}
        </div>
        {spec.preset ? (
          <SliderRow
            label="Intensity"
            value={spec.intensity ?? 100}
            min={0}
            max={100}
            unit="%"
            testId="color-intensity"
            onLive={(v) => live({ ...spec, intensity: v })}
            onCommit={(v) => commit({ ...spec, intensity: v })}
          />
        ) : null}
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adjust</p>
        {ADJUST_KEYS.map((k) => (
          <SliderRow
            key={k}
            label={ADJUST_LABELS[k]}
            value={spec.adjust?.[k] ?? 0}
            min={ADJUST_MIN}
            max={ADJUST_MAX}
            testId={`color-adjust-${k}`}
            onLive={(v) => live(setAdj(k, v))}
            onCommit={(v) => commit(setAdj(k, v))}
          />
        ))}
      </section>
    </div>
  )
}
