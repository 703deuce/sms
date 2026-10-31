'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  ADJUST_KEYS_ALL,
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
import { coalescePush, type CoalesceBurst } from '@/lib/clips/editor/undo-coalesce'
import { addAdjustLayer, patchAdjustLayer, removeAdjustLayer } from '@/lib/clips/editor/adjust-layers'
import { COLOR_PROPS, type KeyframeTarget } from '@/lib/clips/editor/motion-schema'
import { targetOriginMs } from '@/lib/clips/editor/keyframes'
import { KeyframeInspector } from '@/components/clips/editor/timeline/keyframe-inspector'
import { ColorWheels, CurvesEditor, FxControls, HslControls } from '@/components/clips/editor/g4/grade-controls'
import { LutPicker } from '@/components/clips/editor/g4/lut-picker'
import { ScopesPanel } from '@/components/clips/editor/g4/scopes-panel'

/** What the Color panel edits: the whole video, one Video-lane item (source range) or one B-roll item. */
export type ColorTarget =
  | { kind: 'video' }
  | { kind: 'segment'; fromMs: number; toMs: number; label: string }
  | { kind: 'broll'; id: string; label: string }
  | { kind: 'adjust'; id: string; label: string }

function specFor(edits: ClipEditsV2, t: ColorTarget): ColorSpec {
  if (t.kind === 'adjust') return edits.adjustLayers?.find((l) => l.id === t.id)?.spec ?? {}
  if (t.kind === 'broll') return edits.color?.broll?.[t.id] ?? {}
  if (t.kind === 'segment') {
    const own = edits.color?.segments?.find((s) => s.fromMs === t.fromMs && s.toMs === t.toMs)
    return own?.spec ?? videoSpecAtSource(edits.color, t.fromMs) ?? {}
  }
  return edits.color?.video ?? {}
}

function withSpec(edits: ClipEditsV2, t: ColorTarget, spec: ColorSpec | null): ClipEditsV2 {
  const clean = spec ? normalizeColorSpec(spec) ?? null : null
  if (t.kind === 'adjust') return { ...edits, adjustLayers: patchAdjustLayer(edits.adjustLayers, t.id, { spec: clean ?? {} }) }
  let color = edits.color
  if (t.kind === 'video') color = setVideoLook(color, clean)
  else if (t.kind === 'segment') color = setSegmentLook(color, t.fromMs, t.toMs, clean ?? {})
  else color = setBrollLook(color, t.id, clean)
  return { ...edits, color }
}

/**
 * E4fix: Reset only touches the scope being edited. Whole video → the global look (per-item and
 * B-roll looks stay); a Video item → drops its own override (it follows the whole-video look again);
 * a B-roll item → its look. "Reset all" (explicit) clears every look.
 */
export function resetScope(edits: ClipEditsV2, t: ColorTarget): ClipEditsV2 {
  if (t.kind === 'adjust') return { ...edits, adjustLayers: patchAdjustLayer(edits.adjustLayers, t.id, { spec: {} }) }
  let color = edits.color
  if (t.kind === 'video') color = setVideoLook(color, null)
  else if (t.kind === 'segment') color = setSegmentLook(color, t.fromMs, t.toMs, null)
  else color = setBrollLook(color, t.id, null)
  return { ...edits, color }
}

function hasOtherLooks(edits: ClipEditsV2, t: ColorTarget): boolean {
  if (t.kind === 'adjust') return false
  const c = edits.color
  if (!c) return false
  const n = (c.video ? 1 : 0) + (c.segments?.length ?? 0) + Object.keys(c.broll ?? {}).length
  const own =
    t.kind === 'video'
      ? c.video
        ? 1
        : 0
      : t.kind === 'segment'
        ? c.segments?.some((s) => s.fromMs === t.fromMs && s.toMs === t.toMs)
          ? 1
          : 0
        : c.broll?.[t.id]
          ? 1
          : 0
  return n - own > 0
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
/** Keyframe target for color props (Video items share the Video track, output time). */
export function colorKeyTarget(t: ColorTarget): KeyframeTarget {
  if (t.kind === 'broll') return `broll:${t.id}`
  if (t.kind === 'adjust') return `adjust:${t.id}`
  return 'video'
}

type Section = 'basic' | 'curves' | 'wheels' | 'hsl' | 'lut' | 'fx' | 'scopes'

function Collapsible({ id, title, open, onToggle, children }: { id: Section; title: string; open: boolean; onToggle: (id: Section) => void; children: ReactNode }) {
  return (
    <section className="space-y-2" data-testid={`color-section-${id}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        aria-expanded={open}
        onClick={() => onToggle(id)}
        data-testid={`color-section-toggle-${id}`}
      >
        {title}
        <span aria-hidden>{open ? '−' : '+'}</span>
      </button>
      {open ? children : null}
    </section>
  )
}

export function ColorPanel({
  edits,
  target,
  onEdits,
  onLive,
  outputMs,
  outputDurationMs,
  onSeekOutput,
  onTargetChange,
}: {
  edits: ClipEditsV2
  target: ColorTarget
  /** pushHistory=false folds the change into the current undo step (E4fix: slider key bursts). */
  onEdits: (e: ClipEditsV2, pushHistory?: boolean) => void
  onLive?: (e: ClipEditsV2 | null) => void
  /** G4a: playhead (output ms) for color keyframes / new adjustment layers; omitted → hidden. */
  outputMs?: number
  outputDurationMs?: number
  onSeekOutput?: (ms: number) => void
  /** G4a: select the new adjustment layer after "Add adjustment layer". */
  onTargetChange?: (t: ColorTarget) => void
}) {
  const [open, setOpen] = useState<Record<Section, boolean>>({ basic: true, curves: false, wheels: false, hsl: false, lut: false, fx: false, scopes: false })
  const toggle = (id: Section) => setOpen((o) => ({ ...o, [id]: !o[id] }))
  const spec = specFor(edits, target)
  const burst = useRef<CoalesceBurst | null>(null)
  const scopeKey =
    target.kind === 'video' ? 'video' : target.kind === 'segment' ? `seg:${target.fromMs}-${target.toMs}` : `${target.kind}:${target.id}`
  /** `key` = the slider; a burst of keyboard steps / releases on one slider is one undo step. */
  const commit = (s: ColorSpec | null, key?: string) => {
    onLive?.(null)
    const next = withSpec(edits, target, s)
    if (!key) {
      burst.current = null
      onEdits(next)
      return
    }
    const now = Date.now()
    const k = `${scopeKey}:${key}`
    const push = coalescePush(burst.current, k, now, JSON.stringify(spec))
    burst.current = { key: k, at: now, sig: JSON.stringify(specFor(next, target)) }
    onEdits(next, push)
  }
  const live = (s: ColorSpec) => onLive?.(withSpec(edits, target, s))
  const setAdj = (k: ColorAdjustKey, v: number) => ({ ...spec, adjust: { ...(spec.adjust ?? {}), [k]: v } })
  const title =
    target.kind === 'video'
      ? 'Whole video'
      : target.kind === 'segment'
        ? `Video · ${target.label}`
        : target.kind === 'adjust'
          ? `Adjustment · ${target.label}`
          : `B-roll · ${target.label}`
  const isAdjust = target.kind === 'adjust'
  const adjustLayer = isAdjust ? edits.adjustLayers?.find((l) => l.id === target.id) : undefined
  const kfTarget = colorKeyTarget(target)
  const kfOrigin = outputMs != null ? targetOriginMs(edits, kfTarget) : 0
  const kfLocal = outputMs != null ? Math.max(0, outputMs - kfOrigin) : 0
  const addLayer = () => {
    if (outputMs == null || !outputDurationMs) return
    const r = addAdjustLayer(edits.adjustLayers, outputMs, outputDurationMs)
    if (!r) return
    onEdits({ ...edits, adjustLayers: r.layers })
    onTargetChange?.({ kind: 'adjust', id: r.id, label: 'Adjustment' })
  }
  const ctl = { spec, onLive: live, onCommit: (s: ColorSpec, key?: string) => commit(s, key) }

  return (
    <div className="space-y-4 p-3 text-sm" data-testid="color-panel">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium" data-testid="color-target">
          {title}
        </p>
        <div className="flex gap-1">
          {target.kind === 'video' || target.kind === 'segment' ? (
            <Button
              size="xs"
              variant="outline"
              data-testid="color-apply-all"
              onClick={() => onEdits({ ...edits, color: setVideoLook(edits.color, normalizeColorSpec(spec) ?? null, true) })}
            >
              Apply to all
            </Button>
          ) : null}
          <Button
            size="xs"
            variant="ghost"
            data-testid="color-reset"
            title={target.kind === 'video' ? 'Reset the whole-video look (item looks stay)' : 'Reset this item to the whole-video look'}
            onClick={() => {
              onLive?.(null)
              burst.current = null
              onEdits(resetScope(edits, target))
            }}
          >
            Reset
          </Button>
          {hasOtherLooks(edits, target) ? (
            <Button
              size="xs"
              variant="ghost"
              className="text-destructive"
              data-testid="color-reset-all"
              title="Clear every color look (whole video, clips and B-roll)"
              onClick={() => {
                onLive?.(null)
                burst.current = null
                onEdits({ ...edits, color: undefined })
              }}
            >
              Reset all
            </Button>
          ) : null}
        </div>
      </div>
      {target.kind === 'video' ? (
        <p className="text-[11px] text-muted-foreground">Select a clip or B-roll on the timeline to color just that item.</p>
      ) : null}
      {isAdjust ? (
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground" data-testid="color-adjust-layer-info">
          <span>
            Grades the video and B-roll below it
            {adjustLayer ? ` · ${(adjustLayer.startMs / 1000).toFixed(1)}–${(adjustLayer.endMs / 1000).toFixed(1)}s` : ''}
          </span>
          <Button
            size="xs"
            variant="ghost"
            className="text-destructive"
            data-testid="color-adjust-layer-delete"
            onClick={() => {
              onLive?.(null)
              onEdits({
                ...edits,
                adjustLayers: removeAdjustLayer(edits.adjustLayers, target.id),
                keyframes: edits.keyframes?.filter((k) => k.target !== `adjust:${target.id}`),
              })
              onTargetChange?.({ kind: 'video' })
            }}
          >
            Delete layer
          </Button>
        </div>
      ) : outputMs != null && outputDurationMs ? (
        <Button
          size="xs"
          variant="outline"
          className="w-full"
          disabled={(edits.adjustLayers?.length ?? 0) >= 20}
          onClick={addLayer}
          data-testid="color-add-adjust-layer"
          title="A timeline item that grades everything below it for its span"
        >
          Add adjustment layer at playhead
        </Button>
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
            onCommit={(v) => commit({ ...spec, intensity: v }, 'intensity')}
          />
        ) : null}
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adjust</p>
        {ADJUST_KEYS_ALL.map((k) => (
          <SliderRow
            key={k}
            label={ADJUST_LABELS[k]}
            value={spec.adjust?.[k] ?? 0}
            min={ADJUST_MIN}
            max={ADJUST_MAX}
            testId={`color-adjust-${k}`}
            onLive={(v) => live(setAdj(k, v))}
            onCommit={(v) => commit(setAdj(k, v), k)}
          />
        ))}
      </section>

      {outputMs != null && onSeekOutput ? (
        <section className="space-y-1" data-testid="color-keyframes">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Keyframes</p>
          <p className="text-[10px] text-muted-foreground">
            A keyframed value replaces the slider while the track exists
            {target.kind === 'segment' ? ' (Video items share the whole-video track)' : ''}.
          </p>
          <KeyframeInspector
            edits={edits}
            target={kfTarget}
            label={title}
            localMs={kfLocal}
            onCommit={(next) => {
              onLive?.(null)
              burst.current = null
              onEdits(next)
            }}
            onSeekLocal={(t) => onSeekOutput(kfOrigin + t)}
            props={COLOR_PROPS}
          />
        </section>
      ) : null}

      <Collapsible id="curves" title="Curves" open={open.curves} onToggle={toggle}>
        <CurvesEditor {...ctl} />
      </Collapsible>
      <Collapsible id="wheels" title="Color wheels" open={open.wheels} onToggle={toggle}>
        <ColorWheels {...ctl} />
      </Collapsible>
      {!isAdjust ? (
        <Collapsible id="hsl" title="HSL" open={open.hsl} onToggle={toggle}>
          <HslControls {...ctl} />
        </Collapsible>
      ) : null}
      {!isAdjust ? (
        <Collapsible id="lut" title="LUT" open={open.lut} onToggle={toggle}>
          <LutPicker {...ctl} />
        </Collapsible>
      ) : null}
      <Collapsible id="fx" title="Effects" open={open.fx} onToggle={toggle}>
        <FxControls {...ctl} />
      </Collapsible>
      <Collapsible id="scopes" title="Scopes · Auto · White balance" open={open.scopes} onToggle={toggle}>
        <ScopesPanel edits={edits} spec={spec} mode={target.kind === 'broll' ? 'none' : isAdjust ? 'adjust' : 'source'} onCommit={(s) => commit(s)} />
      </Collapsible>
      {isAdjust ? <p className="text-[10px] text-muted-foreground">HSL and LUTs are per clip (not on adjustment layers).</p> : null}
    </div>
  )
}
