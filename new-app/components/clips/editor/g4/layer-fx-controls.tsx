'use client'

/**
 * G4b B-roll layer effects (Properties → Video for a B-roll item): shape mask with feather and
 * keyframes, chroma key, blend mode, reverse. Manual only, no credits; stored in edits.layerFx
 * (additive JSON), rendered by the export (layer_fx.py) and mirrored by the preview.
 */
import { Diamond, RotateCcw } from 'lucide-react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  BLEND_LABELS,
  BLEND_MODES,
  DEFAULT_KEY,
  DEFAULT_MASK,
  FX_FEATURES,
  MASK_LABELS,
  MASK_SHAPES,
  MASK_STEP_MS,
  REVERSE_MAX_MS,
  fxTargetOf,
  layerFxOf,
  maskGeomAt,
  setLayerFx,
  chromaKeyAt,
  chromaParamsAt,
  type ChromaKey,
  type FxTargetKind,
  type LayerFx,
  type LayerMask,
  type MaskGeom,
  TEXT_FX_MAX,
  textFxRowCount,
} from '@/lib/clips/editor/layer-fx'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'

const btn =
  'inline-flex h-7 items-center gap-1 rounded border border-border px-2 text-[11px] hover:bg-muted disabled:pointer-events-none disabled:opacity-35'
const on = 'bg-primary text-primary-foreground hover:bg-primary'

const GEOM_ROWS: { k: keyof MaskGeom; label: string; min: number; max: number; unit: string }[] = [
  { k: 'x', label: 'Center X', min: -50, max: 150, unit: '%' },
  { k: 'y', label: 'Center Y', min: -50, max: 150, unit: '%' },
  { k: 'w', label: 'Width', min: 1, max: 200, unit: '%' },
  { k: 'h', label: 'Height', min: 1, max: 200, unit: '%' },
  { k: 'rot', label: 'Rotation', min: -180, max: 180, unit: '°' },
  { k: 'feather', label: 'Feather', min: 0, max: 100, unit: '' },
]

/** Keyframe time for item-local ms (the 100 ms step both renderers use). */
export const maskKeyMs = (localMs: number) => Math.floor(Math.max(0, localMs) / MASK_STEP_MS) * MASK_STEP_MS

/** Set one geometry value: updates the key at the playhead when the mask is keyframed. */
export function setMaskGeom(mask: LayerMask, k: keyof MaskGeom, v: number, localMs: number): LayerMask {
  if (!mask.keys?.length) return { ...mask, [k]: v }
  const ms = maskKeyMs(localMs)
  const cur = maskGeomAt(mask, ms)
  const keys = mask.keys.filter((x) => x.ms !== ms)
  keys.push({ ...cur, [k]: v, ms })
  keys.sort((a, b) => a.ms - b.ms)
  return { ...mask, keys }
}

export function toggleChromaKey(key: ChromaKey, localMs: number): ChromaKey {
  const ms = maskKeyMs(localMs)
  const has = key.keys?.some((x) => x.ms === ms)
  if (has) {
    const keys = key.keys!.filter((x) => x.ms !== ms)
    if (keys.length) return { ...key, keys }
    const { keys: _k, ...rest } = key
    return { ...rest, ...chromaKeyAt(key, ms) }
  }
  return { ...key, keys: [...(key.keys ?? []), { ms, sim: chromaKeyAt(key, ms).sim, blend: chromaKeyAt(key, ms).blend, spill: chromaKeyAt(key, ms).spill }].sort((a, b) => a.ms - b.ms) }
}

export function setChromaParam(key: ChromaKey, localMs: number, patch: Partial<Pick<ChromaKey, 'sim' | 'blend' | 'spill'>>): ChromaKey {
  const ms = maskKeyMs(localMs)
  const cur = chromaKeyAt(key, ms)
  const next = { ...cur, ...patch }
  if (!key.keys?.length) return { ...key, ...patch }
  const keys = key.keys.filter((x) => x.ms !== ms)
  keys.push({ ms, sim: next.sim, blend: next.blend, spill: next.spill })
  keys.sort((a, b) => a.ms - b.ms)
  return { ...key, keys }
}

export function toggleMaskKey(mask: LayerMask, localMs: number): LayerMask {
  const ms = maskKeyMs(localMs)
  const has = mask.keys?.some((x) => x.ms === ms)
  if (has) {
    const keys = mask.keys!.filter((x) => x.ms !== ms)
    if (keys.length) return { ...mask, keys }
    const { keys: _k, ...rest } = mask
    return { ...rest, ...maskGeomAt(mask, ms) }
  }
  return { ...mask, keys: [...(mask.keys ?? []), { ...maskGeomAt(mask, ms), ms }].sort((a, b) => a.ms - b.ms) }
}

export function LayerFxControls({
  edits,
  target,
  localMs,
  features,
  keyDisabled,
  onCommit,
  readOnly,
}: {
  edits: ClipEditsV2
  target: string
  localMs: number
  features: (typeof FX_FEATURES)[FxTargetKind]
  keyDisabled?: string
  onCommit: (next: ClipEditsV2) => void
  readOnly: boolean
}) {
  const fx: LayerFx | undefined = layerFxOf(edits, target)
  const patch = (p: Partial<Omit<LayerFx, 'target'>>) => onCommit({ ...edits, layerFx: setLayerFx(edits.layerFx, target, p) })
  const mask = fx?.mask
  const g = mask ? maskGeomAt(mask, localMs) : null
  const keyed = Boolean(mask?.keys?.length)
  const keyHere = Boolean(mask?.keys?.some((x) => x.ms === maskKeyMs(localMs)))
  const key = fx?.key
  const keyAt = key ? chromaKeyAt(key, localMs) : null
  const chromaKeyed = Boolean(key?.keys?.length)
  const chromaKeyHere = Boolean(key?.keys?.some((x) => x.ms === maskKeyMs(localMs)))
  const setKey = (p: Partial<ChromaKey>) => patch({ key: key ? setChromaParam(key, localMs, p) : { ...(DEFAULT_KEY), ...p } })
  const brollId = fxTargetOf(target) === 'broll' ? target.slice('broll:'.length) : null
  const item = brollId ? (edits.broll ?? []).find((b) => b.id === brollId) : undefined
  const tooLong = item ? item.endMs - item.startMs > REVERSE_MAX_MS : false
  const keyOff = Boolean(keyDisabled)
  const textCap =
    fxTargetOf(target) === 'text' &&
    textFxRowCount(edits) >= TEXT_FX_MAX &&
    !fx?.mask &&
    !fx?.blend
  return (
    <div className="space-y-4" data-testid="layer-fx">
      {fxTargetOf(target) === 'text' ? (
        <p className="text-[10px] text-muted-foreground">Up to 6 text items can use masks or blends.</p>
      ) : null}
      {features.mask ? (
      <section className="space-y-1.5" data-testid="layer-fx-mask">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mask</h3>
        <div className="flex flex-wrap gap-1">
          <button type="button" className={`${btn} ${!mask ? on : ''}`} disabled={readOnly || textCap} onClick={() => patch({ mask: undefined })} data-testid="layer-fx-mask-none">
            None
          </button>
          {MASK_SHAPES.map((s) => (
            <button
              key={s}
              type="button"
              className={`${btn} ${mask?.shape === s ? on : ''}`}
              disabled={readOnly}
              onClick={() => patch({ mask: { ...(mask ?? DEFAULT_MASK), shape: s } })}
              data-testid={s === 'heart' || s === 'star' ? `mask-shape-${s}` : `layer-fx-mask-${s}`}
            >
              {MASK_LABELS[s]}
            </button>
          ))}
        </div>
        {mask && g ? (
          <>
            {GEOM_ROWS.filter((r) => !((mask.shape === 'linear' && (r.k === 'w' || r.k === 'h')) || (mask.shape === 'mirror' && r.k === 'w'))).map((r) => (
              <SliderRow
                key={r.k}
                label={r.label}
                value={Math.round(g[r.k] * 100) / 100}
                min={r.min}
                max={r.max}
                unit={r.unit}
                disabled={readOnly}
                testId={`layer-fx-mask-${r.k}`}
                onCommit={(v) => patch({ mask: setMaskGeom(mask, r.k, v, localMs) })}
              />
            ))}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={`${btn} ${mask.invert ? on : ''}`}
                aria-pressed={Boolean(mask.invert)}
                disabled={readOnly}
                onClick={() => patch({ mask: { ...mask, invert: mask.invert ? undefined : true } as LayerMask })}
                data-testid="layer-fx-mask-invert"
              >
                Invert
              </button>
              <button
                type="button"
                className={`${btn} ${keyHere ? 'border-yellow-400 bg-yellow-400/15' : ''}`}
                disabled={readOnly}
                onClick={() => patch({ mask: toggleMaskKey(mask, localMs) })}
                data-testid="layer-fx-mask-key"
                title="Keyframe the mask at the playhead (100 ms steps)"
              >
                <Diamond className="size-3" aria-hidden /> {keyHere ? 'Remove key' : 'Key here'}
              </button>
              {keyed ? (
                <button
                  type="button"
                  className={btn}
                  disabled={readOnly}
                  onClick={() => {
                    const { keys: _k, ...rest } = mask
                    patch({ mask: { ...rest, ...maskGeomAt(mask, localMs) } })
                  }}
                  data-testid="layer-fx-mask-clear-keys"
                >
                  <RotateCcw className="size-3" aria-hidden /> Clear keys
                </button>
              ) : null}
            </div>
            {keyed ? <p className="text-[10px] text-muted-foreground">{mask.keys!.length} mask key(s): sliders edit the key at the playhead.</p> : null}
          </>
        ) : null}
      </section>
      ) : null}
      {features.key ? (
      <section className="space-y-1.5" data-testid="layer-fx-key">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Chroma key</h3>
        {keyDisabled ? <p className="text-[10px] text-muted-foreground">{keyDisabled}</p> : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={`${btn} ${key ? on : ''}`} aria-pressed={Boolean(key)} disabled={readOnly || keyOff} onClick={() => patch({ key: key ? undefined : DEFAULT_KEY })} data-testid="layer-fx-key-toggle">
            {key ? 'On' : 'Off'}
          </button>
          {key ? (
            <>
              <button type="button" className={btn} disabled={readOnly || keyOff} onClick={() => setKey({ color: '#00ff00' })} data-testid="layer-fx-key-green">
                Green
              </button>
              <button type="button" className={btn} disabled={readOnly || keyOff} onClick={() => setKey({ color: '#0000ff' })} data-testid="layer-fx-key-blue">
                Blue
              </button>
              <input
                type="color"
                value={key.color}
                disabled={readOnly || keyOff}
                onChange={(e) => setKey({ color: e.target.value.toLowerCase() })}
                className="h-6 w-10 cursor-pointer rounded border border-border bg-transparent"
                aria-label="Key color"
                data-testid="layer-fx-key-color"
              />
            </>
          ) : null}
        </div>
        {key ? (
          <>
            <SliderRow label="Strength" value={keyAt?.sim ?? key.sim} min={0} max={100} disabled={readOnly || keyOff} testId="layer-fx-key-sim" onCommit={(v) => setKey({ sim: v })} />
            <SliderRow label="Edge softness" value={keyAt?.blend ?? key.blend} min={0} max={100} disabled={readOnly || keyOff} testId="layer-fx-key-blend" onCommit={(v) => setKey({ blend: v })} />
            <SliderRow label="Spill removal" value={keyAt?.spill ?? key.spill} min={0} max={100} disabled={readOnly || keyOff} testId="layer-fx-key-spill" onCommit={(v) => setKey({ spill: v })} />
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={`${btn} ${chromaKeyHere ? 'border-yellow-400 bg-yellow-400/15' : ''}`}
                disabled={readOnly || keyOff}
                onClick={() => key && patch({ key: toggleChromaKey(key, localMs) })}
                data-testid="layer-fx-key-kf"
                title="Keyframe chroma settings at the playhead (100 ms steps)"
              >
                <Diamond className="size-3" aria-hidden /> {chromaKeyHere ? 'Remove key' : 'Key here'}
              </button>
              {chromaKeyed ? (
                <button
                  type="button"
                  className={btn}
                  disabled={readOnly || keyOff}
                  onClick={() => {
                    if (!key) return
                    const { keys: _k, ...rest } = key
                    patch({ key: { ...rest, ...chromaKeyAt(key, localMs) } })
                  }}
                  data-testid="layer-fx-key-clear-keys"
                >
                  <RotateCcw className="size-3" aria-hidden /> Clear keys
                </button>
              ) : null}
            </div>
            {chromaKeyed ? <p className="text-[10px] text-muted-foreground">{key!.keys!.length} chroma key(s): sliders edit the key at the playhead.</p> : null}
          </>
        ) : null}
      </section>
      ) : null}
      {features.blend ? (
      <section className="space-y-1.5" data-testid="layer-fx-blend">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Blend</h3>
        <div className="flex flex-wrap gap-1">
          {BLEND_MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={`${btn} ${(fx?.blend ?? 'normal') === m ? on : ''}`}
              disabled={readOnly}
              onClick={() => patch({ blend: m === 'normal' ? undefined : m })}
              data-testid={`layer-fx-blend-${m}`}
            >
              {BLEND_LABELS[m]}
            </button>
          ))}
        </div>
      </section>
      ) : null}
      {features.reverse ? (
      <section className="space-y-1.5" data-testid="layer-fx-reverse">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reverse</h3>
          <button
            type="button"
            className={`${btn} ${fx?.reverse ? on : ''}`}
            aria-pressed={Boolean(fx?.reverse)}
            disabled={readOnly}
            onClick={() => patch({ reverse: fx?.reverse ? undefined : true })}
            data-testid="layer-fx-reverse-toggle"
          >
            {fx?.reverse ? 'Reversed' : 'Play backwards'}
          </button>
          {tooLong ? <p className="text-[10px] text-muted-foreground">Only the first {REVERSE_MAX_MS / 1000} s are reversed on export.</p> : null}
        </section>
      ) : null}
    </div>
  )
}
