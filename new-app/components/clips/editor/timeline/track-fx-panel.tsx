'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'
import { ADJUST_KEYS, ADJUST_LABELS, COLOR_PRESET_IDS, COLOR_PRESETS, type ColorSpec } from '@/lib/clips/editor/color'
import { FX_LIMITS, isOverlayFxKey, type TrackComp, type TrackFx, type TrackVfxType } from '@/lib/clips/editor/track-fx'

type FxBody = Omit<TrackFx, 'track'>
const LUFS_CHOICES = [-14, -16, -18, -20, -23, -24] as const

function Toggle({ on, label, onChange, testId }: { on: boolean; label: string; onChange: (v: boolean) => void; testId: string }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] font-medium">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      {label}
    </label>
  )
}

/**
 * G1c: track FX inspector (track header ⋯ → Track FX…). Audio keys: NR → EQ → compressor →
 * loudness target → limiter. Overlay tracks: one color look for every item without its own.
 */
export function TrackFxPanel({
  fxKey,
  label,
  fx,
  onChange,
  onClose,
  readOnly = false,
}: {
  fxKey: string
  label: string
  fx: TrackFx | undefined
  onChange: (next: FxBody | null) => void
  onClose: () => void
  readOnly?: boolean
}) {
  const cur: FxBody = fx ? (({ track: _t, ...rest }) => rest)(fx) : {}
  const set = (patch: Partial<FxBody>) => {
    const next: FxBody = { ...cur, ...patch }
    for (const k of Object.keys(next) as (keyof FxBody)[]) if (next[k] === undefined) delete next[k]
    onChange(Object.keys(next).filter((k) => k !== 'bypass').length ? next : null)
  }
  const comp: TrackComp = cur.comp ?? {
    threshold: FX_LIMITS.threshold[2],
    ratio: FX_LIMITS.ratio[2],
    attack: FX_LIMITS.attack[2],
    release: FX_LIMITS.release[2],
    makeup: FX_LIMITS.makeup[2],
  }
  const eq = cur.eq ?? {}
  const overlay = isOverlayFxKey(fxKey)
  const voiceTrack = fxKey === 'voice'
  const vfx = cur.vfx
  const vfxType = vfx?.type
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-2 text-xs" data-testid={`track-fx-panel-${fxKey}`} role="dialog" aria-label={`${label} track FX`}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-semibold">{label} · Track FX</span>
        <Toggle on={Boolean(cur.bypass)} label="Bypass" onChange={(v) => set({ bypass: v ? true : undefined })} testId="track-fx-bypass" />
        <Button size="xs" variant="ghost" className="h-6 px-1.5 text-[10px]" disabled={readOnly || !fx} onClick={() => onChange(null)} data-testid="track-fx-reset">
          Reset
        </Button>
        <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={onClose} aria-label="Close track FX">
          <X className="size-3.5" />
        </button>
      </div>
      <fieldset disabled={readOnly} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {overlay ? (
          <OverlayColor spec={cur.color} onSpec={(color) => set({ color })} />
        ) : (
          <>
            <div className="space-y-1.5">
              <Toggle on={cur.nr != null} label="Noise reduction" onChange={(v) => set({ nr: v ? FX_LIMITS.nr[2] : undefined })} testId="track-fx-nr" />
              {cur.nr != null ? (
                <>
                  <SliderRow label="Amount" value={cur.nr} min={FX_LIMITS.nr[0]} max={FX_LIMITS.nr[1]} unit=" dB" onCommit={(v) => set({ nr: v })} testId="track-fx-nr-amount" />
                  <p className="text-[10px] text-muted-foreground">Applied on export (the preview can't denoise live).</p>
                </>
              ) : null}
              <Toggle on={cur.deess != null} label="De-ess" onChange={(v) => set({ deess: v ? FX_LIMITS.deess[2] : undefined })} testId="track-fx-deess" />
              {cur.deess != null ? (
                <>
                  <SliderRow label="Intensity" value={cur.deess} min={0} max={100} unit="%" onCommit={(v) => set({ deess: v })} testId="track-fx-deess-amount" />
                  <p className="text-[10px] text-muted-foreground">De-ess and Noise reduction apply on export only.</p>
                </>
              ) : null}
              <div className="space-y-1">
                <label className="text-[11px] font-medium" htmlFor="track-fx-vfx-select">
                  Voice effect
                </label>
                <select
                  id="track-fx-vfx-select"
                  className="h-7 w-full rounded border border-border bg-background px-1 text-[11px]"
                  value={vfxType ?? ''}
                  data-testid="track-fx-vfx"
                  onChange={(e) => {
                    const t = e.target.value as TrackVfxType | ''
                    if (!t) set({ vfx: undefined })
                    else set({ vfx: { type: t, amount: t === 'telephone' ? undefined : FX_LIMITS.vfxAmount[2] } })
                  }}
                >
                  <option value="">Off</option>
                  <option value="echo">Echo</option>
                  <option value="reverb">Reverb</option>
                  <option value="robot">Robot</option>
                  <option value="telephone">Telephone</option>
                </select>
                {vfxType && vfxType !== 'telephone' ? (
                  <SliderRow
                    label="Amount"
                    value={vfx?.amount ?? FX_LIMITS.vfxAmount[2]}
                    min={0}
                    max={100}
                    unit="%"
                    onCommit={(v) => set({ vfx: { type: vfxType, amount: v } })}
                    testId="track-fx-vfx-amount"
                  />
                ) : null}
              </div>
              {voiceTrack ? (
                <SliderRow
                  label="Pan"
                  value={cur.pan ?? 0}
                  min={-100}
                  max={100}
                  step={1}
                  format={(v) => (v === 0 ? 'C' : v < 0 ? `L${Math.abs(v)}` : `R${v}`)}
                  onCommit={(v) => set({ pan: v || undefined })}
                  testId="track-fx-pan"
                />
              ) : null}
              <Toggle on={eq.hp != null} label="High-pass" onChange={(v) => set({ eq: { ...eq, hp: v ? FX_LIMITS.hp[2] : undefined } })} testId="track-fx-hp" />
              {eq.hp != null ? <SliderRow label="Cutoff" value={eq.hp} min={FX_LIMITS.hp[0]} max={FX_LIMITS.hp[1]} unit=" Hz" onCommit={(v) => set({ eq: { ...eq, hp: v } })} testId="track-fx-hp-hz" /> : null}
            </div>
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium">EQ</div>
              <SliderRow label="Low (120 Hz)" value={eq.low ?? 0} min={-12} max={12} step={0.5} unit=" dB" onCommit={(v) => set({ eq: { ...eq, low: v || undefined } })} testId="track-fx-low" />
              <SliderRow label={`Mid (${eq.midHz ?? FX_LIMITS.midHz[2]} Hz)`} value={eq.mid ?? 0} min={-12} max={12} step={0.5} unit=" dB" onCommit={(v) => set({ eq: { ...eq, mid: v || undefined } })} testId="track-fx-mid" />
              {eq.mid != null ? (
                <SliderRow label="Mid frequency" value={eq.midHz ?? FX_LIMITS.midHz[2]} min={FX_LIMITS.midHz[0]} max={FX_LIMITS.midHz[1]} step={50} unit=" Hz" onCommit={(v) => set({ eq: { ...eq, midHz: v } })} testId="track-fx-midhz" />
              ) : null}
              <SliderRow label="High (8 kHz)" value={eq.high ?? 0} min={-12} max={12} step={0.5} unit=" dB" onCommit={(v) => set({ eq: { ...eq, high: v || undefined } })} testId="track-fx-high" />
            </div>
            <div className="space-y-1.5">
              <Toggle on={Boolean(cur.comp)} label="Compressor" onChange={(v) => set({ comp: v ? comp : undefined })} testId="track-fx-comp" />
              {cur.comp ? (
                <>
                  <SliderRow label="Threshold" value={comp.threshold} min={-60} max={0} unit=" dB" onCommit={(v) => set({ comp: { ...comp, threshold: v } })} testId="track-fx-comp-threshold" />
                  <SliderRow label="Ratio" value={comp.ratio} min={1} max={20} step={0.5} unit=":1" onCommit={(v) => set({ comp: { ...comp, ratio: v } })} testId="track-fx-comp-ratio" />
                  <SliderRow label="Attack" value={comp.attack} min={0.1} max={200} step={0.1} unit=" ms" onCommit={(v) => set({ comp: { ...comp, attack: v } })} testId="track-fx-comp-attack" />
                  <SliderRow label="Release" value={comp.release} min={10} max={2000} step={10} unit=" ms" onCommit={(v) => set({ comp: { ...comp, release: v } })} testId="track-fx-comp-release" />
                  <SliderRow label="Make-up" value={comp.makeup} min={0} max={24} step={0.5} unit=" dB" onCommit={(v) => set({ comp: { ...comp, makeup: v } })} testId="track-fx-comp-makeup" />
                </>
              ) : null}
              <Toggle on={cur.lufs != null} label="Loudness target" onChange={(v) => set({ lufs: v ? FX_LIMITS.lufs[2] : undefined })} testId="track-fx-lufs" />
              {cur.lufs != null ? (
                <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Target LUFS">
                  {LUFS_CHOICES.map((l) => (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={cur.lufs === l}
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${cur.lufs === l ? 'border-primary bg-primary/10' : 'border-border'}`}
                      onClick={() => set({ lufs: l })}
                      data-testid={`track-fx-lufs-${-l}`}
                    >
                      {l} LUFS
                    </button>
                  ))}
                  {fxKey === 'voice' ? <p className="w-full text-[10px] text-muted-foreground">Voice loudness is matched on export; the preview plays it unchanged.</p> : null}
                </div>
              ) : null}
              <Toggle on={cur.limit != null} label="Limiter" onChange={(v) => set({ limit: v ? FX_LIMITS.limit[2] : undefined })} testId="track-fx-limit" />
              {cur.limit != null ? <SliderRow label="Ceiling" value={cur.limit} min={-24} max={0} step={0.5} unit=" dB" onCommit={(v) => set({ limit: v })} testId="track-fx-limit-ceiling" /> : null}
            </div>
          </>
        )}
      </fieldset>
    </div>
  )
}

function OverlayColor({ spec, onSpec }: { spec: ColorSpec | undefined; onSpec: (s: ColorSpec | undefined) => void }) {
  const s = spec ?? {}
  const done = (n: ColorSpec) => onSpec(n.preset || (n.adjust && Object.values(n.adjust).some(Boolean)) ? n : undefined)
  return (
    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
      <p className="text-[10px] text-muted-foreground">One look for every clip on this track (clips with their own look keep it).</p>
      <div className="flex flex-wrap gap-1">
        <button type="button" className={`rounded border px-1.5 py-0.5 text-[10px] ${!s.preset ? 'border-primary' : 'border-border'}`} onClick={() => done({ ...s, preset: undefined })}>
          None
        </button>
        {COLOR_PRESET_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`rounded border px-1.5 py-0.5 text-[10px] ${s.preset === id ? 'border-primary bg-primary/10' : 'border-border'}`}
            onClick={() => done({ ...s, preset: id })}
            data-testid={`track-fx-color-${id}`}
          >
            {COLOR_PRESETS[id].label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {ADJUST_KEYS.map((k) => (
          <SliderRow
            key={k}
            label={ADJUST_LABELS[k]}
            value={s.adjust?.[k] ?? 0}
            min={-100}
            max={100}
            onCommit={(v) => done({ ...s, adjust: { ...(s.adjust ?? {}), [k]: v || undefined } })}
            testId={`track-fx-adjust-${k}`}
          />
        ))}
      </div>
    </div>
  )
}
