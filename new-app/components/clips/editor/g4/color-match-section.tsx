'use client'

/**
 * G4c color match (Color panel): "Use as reference" stores the Lab statistics of the selected clip's
 * graded frame at the playhead; "Match to reference" solves this clip's Adjust sliders so its
 * graded frame has the same Lab mean / spread (lib/clips/editor/color-match.ts). Statistics only,
 * no AI; the result is ordinary slider values (undoable, editable, exported like any edit).
 */
import { useState, useSyncExternalStore } from 'react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { ColorSpec } from '@/lib/clips/editor/color'
import { brollGradeAt, videoGradeAt } from '@/lib/clips/editor/grade-runtime'
import { labStats, matchColor, type LabStats } from '@/lib/clips/editor/color-match'
import { samplePixels } from '@/lib/clips/editor/auto-color'
import { gradePixels } from '@/lib/clips/editor/scopes'
import { grabFrame, type Frame } from './frame-grab'
import { stageFrame } from './grade-preview'
import { lutFor } from './lut-cache'

export type MatchTarget = { kind: 'video' } | { kind: 'segment'; label: string } | { kind: 'broll'; id: string; label: string } | { kind: 'adjust' }
type Ref = { stats: LabStats; label: string }

let current: Ref | null = null
const subs = new Set<() => void>()
export function setMatchReference(r: Ref | null) {
  current = r
  subs.forEach((f) => f())
}
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => void subs.delete(f)
}

const btn =
  'inline-flex h-7 items-center gap-1 rounded border border-border px-2 text-[11px] hover:bg-muted disabled:pointer-events-none disabled:opacity-35'

function drawEl(el: HTMLVideoElement | HTMLImageElement, maxW: number): Frame | { error: string } {
  const iw = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth
  const ih = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight
  if (!iw || !ih) return { error: 'This B-roll has no frame loaded yet' }
  const sc = Math.min(1, maxW / iw)
  const w = Math.max(1, Math.round(iw * sc))
  const h = Math.max(1, Math.round(ih * sc))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { error: 'No 2D canvas' }
  try {
    ctx.drawImage(el, 0, 0, w, h)
    return { px: ctx.getImageData(0, 0, w, h).data, w, h, t: el instanceof HTMLVideoElement ? el.currentTime : 0 }
  } catch {
    return { error: 'This B-roll does not allow pixel access (CORS)' }
  }
}

/** Raw (ungraded) frame of the target at the playhead. */
export async function rawFrameFor(edits: ClipEditsV2, t: MatchTarget, outMs: number): Promise<Frame | { error: string }> {
  if (t.kind === 'adjust') return { error: 'Adjustment layers have no picture of their own — match a clip instead' }
  if (t.kind === 'broll') {
    const it = edits.broll?.find((b) => b.id === t.id)
    if (!it || outMs < it.startMs || outMs >= it.endMs) return { error: 'Move the playhead over this B-roll first' }
    const sel = `[data-testid="preview-broll"][data-broll-id="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(t.id) : t.id}"]`
    const el = document.querySelector<HTMLVideoElement | HTMLImageElement>(`${sel} video, ${sel} img`)
    if (!el) return { error: 'This B-roll is not on the preview' }
    return drawEl(el, 160)
  }
  return grabFrame(160)
}

function gradedFor(edits: ClipEditsV2, t: MatchTarget, outMs: number): ColorSpec | undefined {
  if (t.kind === 'broll') return brollGradeAt(edits, t.id, outMs)
  return videoGradeAt(edits, stageFrame.srcMs, outMs)
}

export function ColorMatchSection({
  edits,
  target,
  spec,
  outputMs,
  onCommit,
}: {
  edits: ClipEditsV2
  target: MatchTarget
  spec: ColorSpec
  outputMs: number | null
  onCommit: (spec: ColorSpec) => void
}) {
  const ref = useSyncExternalStore(subscribe, () => current, () => null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const outMs = outputMs ?? stageFrame.outMs
  const label = target.kind === 'broll' || target.kind === 'segment' ? target.label : target.kind === 'video' ? 'Whole video' : 'Adjustment layer'

  const capture = async () => {
    setBusy(true)
    const f = await rawFrameFor(edits, target, outMs)
    setBusy(false)
    if ('error' in f) return setMsg(f.error)
    const graded = gradePixels(f.px, [gradedFor(edits, target, outMs)], (id) => lutFor(id))
    setMatchReference({ stats: labStats(samplePixels(graded, f.w, f.h, 2048)), label: `${label} at ${(outMs / 1000).toFixed(1)} s` })
    setMsg('Reference set. Select another clip and press Match.')
  }
  const match = async () => {
    if (!ref) return
    setBusy(true)
    const f = await rawFrameFor(edits, target, outMs)
    if ('error' in f) {
      setBusy(false)
      return setMsg(f.error)
    }
    const r = matchColor(spec, samplePixels(f.px, f.w, f.h, 2048), ref.stats, spec.lut ? lutFor(spec.lut.id) : null)
    setBusy(false)
    if (r.after >= r.before - 1e-6) return setMsg('Already as close as the sliders allow.')
    onCommit(r.spec)
    const v = r.values
    setMsg(`Matched: exposure ${v.exposure}, contrast ${v.contrast}, saturation ${v.saturation}, temperature ${v.temperature}, tint ${v.tint}.`)
  }
  return (
    <div className="space-y-1.5" data-testid="color-match">
      <div className="flex flex-wrap gap-1">
        <button type="button" className={btn} disabled={busy || target.kind === 'adjust'} onClick={() => void capture()} data-testid="color-match-set-ref">
          Use as reference
        </button>
        <button type="button" className={btn} disabled={busy || !ref || target.kind === 'adjust'} onClick={() => void match()} data-testid="color-match-apply">
          Match to reference
        </button>
        {ref ? (
          <button type="button" className={btn} onClick={() => (setMatchReference(null), setMsg(null))} data-testid="color-match-clear">
            Clear
          </button>
        ) : null}
      </div>
      <p className="text-[10px] text-muted-foreground" data-testid="color-match-ref">
        {ref ? `Reference: ${ref.label}` : 'Pick a frame of the clip whose look you want, press Use as reference, then select the clip to change.'}
      </p>
      {msg ? (
        <p className="text-[10px] text-muted-foreground" data-testid="color-match-msg">
          {msg}
        </p>
      ) : null}
    </div>
  )
}
