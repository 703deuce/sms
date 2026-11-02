'use client'

/**
 * G4c main-video tools (Properties → Video when the Video layer is selected): stabilize for the
 * selected Video item, scene split (browser shot detection → Video-lane splits you confirm) and blur
 * regions (manual keyframed mask or auto faces). Manual only, no credits.
 */
import { useEffect, useRef, useState } from 'react'
import { Diamond, Scissors, Trash2 } from 'lucide-react'
import { normalizeVideoSplits, orderedKeepSegments, type ClipEditsV2 } from '@/lib/clips/edits'
import { setStabilize, stabilizeFor, STAB_DEFAULT } from '@/lib/clips/editor/stabilize'
import { itemReversed, toggleItemReverse } from '@/lib/clips/editor/video-reverse'
import { REVERSE_MAX_MS } from '@/lib/clips/editor/layer-fx'
import {
  addBlurRegion,
  BLUR_MAX_REGIONS,
  blurRegionsAt,
  patchBlurRegion,
  type BlurRegion,
} from '@/lib/clips/editor/blur-regions'
import { MASK_LABELS, MASK_SHAPES, maskGeomAt, type LayerMask, type MaskGeom } from '@/lib/clips/editor/layer-fx'
import { clipRanges, usableCuts } from '@/lib/clips/editor/scene-detect'
import { splitBrollAtMedia, splitInsertAtMedia } from '@/lib/clips/editor/scene-items'
import { sourceToOutput, timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { videoTimeFromSourceMs } from '@/lib/clips/editor-playback'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'
import { maskKeyMs, setMaskGeom, toggleMaskKey } from './layer-fx-controls'
import { stageFrame } from './grade-preview'
import { scanSceneCuts } from './scene-scan'
import { BgRemovalSection } from './bg-removal-section'
import { bgRemovalUiEnabled } from '@/lib/clips/editor/bg-removal'

const btn =
  'inline-flex h-7 items-center gap-1 rounded border border-border px-2 text-[11px] hover:bg-muted disabled:pointer-events-none disabled:opacity-35'
const on = 'bg-primary text-primary-foreground hover:bg-primary'
/** Scene cuts closer than this to a segment edge / another split are not offered. */
export const SCENE_MIN_SEG_MS = 500

export function fmtMs(ms: number): string {
  const s = Math.max(0, ms) / 1000
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId: string }) {
  return (
    <section className="space-y-1.5" data-testid={testId}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

// ── stabilize ──────────────────────────────────────────────────────────────

export function StabilizeControl({
  edits,
  srcInMs,
  srcOutMs,
  onCommit,
  readOnly,
}: {
  edits: ClipEditsV2
  srcInMs: number
  srcOutMs: number
  onCommit: (next: ClipEditsV2) => void
  readOnly?: boolean
}) {
  const amount = stabilizeFor(edits.stabilize, srcInMs, srcOutMs)
  const set = (a: number | null) => onCommit({ ...edits, stabilize: setStabilize(edits.stabilize, srcInMs, srcOutMs, a) })
  return (
    <div className="space-y-1.5" data-testid="stabilize">
      <div className="flex items-center gap-1.5">
        <button type="button" className={`${btn} ${amount == null ? on : ''}`} disabled={readOnly} onClick={() => set(null)} data-testid="stabilize-off">
          Off
        </button>
        <button
          type="button"
          className={`${btn} ${amount != null ? on : ''}`}
          disabled={readOnly}
          onClick={() => amount == null && set(STAB_DEFAULT)}
          data-testid="stabilize-on"
        >
          Stabilize
        </button>
      </div>
      {amount != null ? (
        <SliderRow label="Strength" value={amount} min={1} max={100} disabled={readOnly} testId="stabilize-amount" onCommit={(v) => set(v)} />
      ) : null}
      <p className="text-[10px] text-muted-foreground" data-testid="stabilize-note">
        Smooths camera shake of this Video item on export (the preview shows the original). Stronger settings zoom in
        slightly to hide the moving edges.
      </p>
    </div>
  )
}

export function ReverseControl({
  edits,
  srcInMs,
  srcOutMs,
  onCommit,
  readOnly,
}: {
  edits: ClipEditsV2
  srcInMs: number
  srcOutMs: number
  onCommit: (next: ClipEditsV2) => void
  readOnly?: boolean
}) {
  const tooLong = srcOutMs - srcInMs > REVERSE_MAX_MS
  const reversed = itemReversed(edits, srcInMs, srcOutMs)
  return (
    <div className="space-y-1">
      <button
        type="button"
        className={`${btn} ${reversed ? on : ''}`}
        aria-pressed={reversed}
        disabled={readOnly || tooLong}
        data-testid="video-reverse-toggle"
        onClick={() => onCommit(toggleItemReverse(edits, srcInMs, srcOutMs))}
      >
        {reversed ? 'Reversed' : 'Play backwards'}
      </button>
      <p className="text-[10px] text-muted-foreground">Sound is muted while reversed.</p>
      {tooLong ? <p className="text-[10px] text-muted-foreground">Split it under 60 s to reverse.</p> : null}
    </div>
  )
}

// ── scene split ────────────────────────────────────────────────────────────

type Cand = { src: number; score: number; on: boolean }

export function SceneSplitSection({
  edits,
  onCommit,
  onSeekOutput,
  readOnly,
  videoItem = null,
}: {
  edits: ClipEditsV2
  onCommit: (next: ClipEditsV2) => void
  onSeekOutput: (ms: number) => void
  readOnly?: boolean
  /** G4cfix: the selected Video item — scanned alone by default (a 12-min clip took minutes). */
  videoItem?: { srcInMs: number; srcOutMs: number } | null
}) {
  const [phase, setPhase] = useState<'idle' | 'scan' | 'done'>('idle')
  const [progress, setProgress] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)
  const [cands, setCands] = useState<Cand[]>([])
  const [scope, setScope] = useState<'item' | 'all'>('item')
  const stop = useRef(false)
  useEffect(() => () => void (stop.current = true), [])
  const tb = timebaseFor(edits)
  const outOf = (src: number) => sourceToOutput(tb, src)
  const useItem = scope === 'item' && videoItem != null

  const scan = async () => {
    const v = stageFrame.video
    const url = v ? v.currentSrc || v.src : ''
    setMsg(null)
    setCands([])
    stop.current = false
    setPhase('scan')
    setProgress(0)
    const off = stageFrame.offsetMs ?? 0
    const segs = orderedKeepSegments(edits)
    const ranges = useItem ? clipRanges(segs, videoItem.srcInMs, videoItem.srcOutMs) : segs
    const r = await scanSceneCuts({
      url,
      ranges,
      toVideoSec: (t) => videoTimeFromSourceMs(t, off),
      onProgress: setProgress,
      stopped: () => stop.current,
    })
    if ('stopped' in r) {
      setPhase('idle')
      return
    }
    if ('error' in r) {
      setPhase('idle')
      setMsg(r.error)
      return
    }
    const refined: Cand[] = r.cuts.map((c) => ({ src: c.t, score: c.score, on: true }))
    const keep = new Set(usableCuts(refined.map((x) => x.src), segs, edits.videoSplits ?? [], SCENE_MIN_SEG_MS))
    const list = refined.filter((x) => keep.has(x.src))
    setCands(list)
    setPhase('done')
    setProgress(100)
    setMsg(list.length ? null : 'No scene changes found.')
  }

  const apply = () => {
    const pick = cands.filter((c) => c.on).map((c) => c.src)
    if (!pick.length) return
    const splits = normalizeVideoSplits([...(edits.videoSplits ?? []), ...pick], edits.trim.in, edits.trim.out)
    onCommit({ ...edits, videoSplits: splits })
    setCands([])
    setPhase('idle')
    setMsg(`Split the Video lane at ${pick.length} scene change${pick.length === 1 ? '' : 's'}.`)
  }

  return (
    <Section title="Scene split" testId="scene-split">
      <div className="flex flex-wrap items-center gap-1.5">
        {phase === 'scan' ? (
          <>
            <span className="text-[11px] tabular-nums" data-testid="scene-split-progress">
              Scanning… {progress}%
            </span>
            <button type="button" className={btn} onClick={() => (stop.current = true)} data-testid="scene-split-cancel">
              Cancel
            </button>
          </>
        ) : (
          <>
            {videoItem ? (
              <div className="flex overflow-hidden rounded border border-border" role="radiogroup" aria-label="Scan range" data-testid="scene-split-scope">
                {(['item', 'all'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={scope === k}
                    onClick={() => setScope(k)}
                    className={`h-7 px-2 text-[11px] ${scope === k ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    data-testid={`scene-split-scope-${k}`}
                  >
                    {k === 'item' ? 'Selected item' : 'Whole clip'}
                  </button>
                ))}
              </div>
            ) : null}
            <button type="button" className={btn} disabled={readOnly} onClick={() => void scan()} data-testid="scene-split-detect">
              <Scissors className="size-3" aria-hidden /> Detect scenes
            </button>
          </>
        )}
      </div>
      {cands.length ? (
        <div className="space-y-1" data-testid="scene-split-list">
          {cands.map((c, i) => {
            const out = outOf(c.src)
            return (
              <label key={c.src} className="flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={c.on}
                  onChange={() => setCands(cands.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
                  data-testid={`scene-split-cand-${i}`}
                />
                <button type="button" className="tabular-nums underline-offset-2 hover:underline" onClick={() => out != null && onSeekOutput(out)}>
                  {out != null ? fmtMs(out) : fmtMs(c.src)}
                </button>
                <span className="text-muted-foreground">change {Math.round(c.score * 100)}</span>
              </label>
            )
          })}
          <button type="button" className={`${btn} ${on}`} disabled={readOnly || !cands.some((c) => c.on)} onClick={apply} data-testid="scene-split-apply">
            Split at {cands.filter((c) => c.on).length} cut{cands.filter((c) => c.on).length === 1 ? '' : 's'}
          </button>
        </div>
      ) : null}
      {msg ? (
        <p className="text-[10px] text-muted-foreground" data-testid="scene-split-msg">
          {msg}
        </p>
      ) : null}
      <p className="text-[10px] text-muted-foreground">
        Finds shot changes in this browser (no credits) and splits the Video lane there after you confirm; each part can then be
        trimmed, deleted or graded on its own.
      </p>
    </Section>
  )
}

// ── blur regions ───────────────────────────────────────────────────────────

const GEOM: { k: keyof MaskGeom; label: string; min: number; max: number }[] = [
  { k: 'x', label: 'Center X', min: -50, max: 150 },
  { k: 'y', label: 'Center Y', min: -50, max: 150 },
  { k: 'w', label: 'Width', min: 1, max: 200 },
  { k: 'h', label: 'Height', min: 1, max: 200 },
  { k: 'rot', label: 'Rotation', min: -180, max: 180 },
  { k: 'feather', label: 'Feather', min: 0, max: 100 },
]

export function BlurRegionsSection({
  edits,
  outputMs,
  durationMs,
  onCommit,
  onSeekOutput,
  readOnly,
}: {
  edits: ClipEditsV2
  outputMs: number
  durationMs: number
  onCommit: (next: ClipEditsV2) => void
  onSeekOutput: (ms: number) => void
  readOnly?: boolean
}) {
  const list = edits.blurRegions ?? []
  const [selId, setSelId] = useState<string | null>(null)
  const here = blurRegionsAt(list, outputMs)
  const sel: BlurRegion | undefined = list.find((r) => r.id === selId) ?? here[0]
  const commit = (next: BlurRegion[] | undefined) => onCommit({ ...edits, blurRegions: next })
  const patch = (p: Partial<Omit<BlurRegion, 'id'>>) => sel && commit(patchBlurRegion(list, sel.id, p))
  const local = sel ? outputMs - sel.startMs : 0
  const mask = sel?.mask
  const g = mask ? maskGeomAt(mask, local) : null
  const keyHere = Boolean(mask?.keys?.some((x) => x.ms === maskKeyMs(local)))
  const inside = sel ? sel.startMs <= outputMs && outputMs < sel.endMs : false
  return (
    <Section title="Blur regions" testId="blur-regions">
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className={btn}
          disabled={readOnly || list.length >= BLUR_MAX_REGIONS}
          onClick={() => {
            const r = addBlurRegion(list, outputMs, durationMs)
            if (!r) return
            commit(r.list)
            setSelId(r.id)
          }}
          data-testid="blur-add"
        >
          + Blur at playhead
        </button>
        {list.map((r, i) => (
          <button
            key={r.id}
            type="button"
            className={`${btn} ${sel?.id === r.id ? on : ''}`}
            onClick={() => {
              setSelId(r.id)
              if (!(r.startMs <= outputMs && outputMs < r.endMs)) onSeekOutput(r.startMs)
            }}
            data-testid={`blur-item-${r.id}`}
          >
            Blur {i + 1} · {fmtMs(r.startMs)}–{fmtMs(r.endMs)}
          </button>
        ))}
      </div>
      {sel && mask && g ? (
        <div className="space-y-1.5 rounded-md border border-border/60 p-2" data-testid="blur-editor" data-blur-id={sel.id}>
          <div className="flex flex-wrap gap-1">
            <button type="button" className={`${btn} ${sel.mode === 'manual' ? on : ''}`} disabled={readOnly} onClick={() => patch({ mode: 'manual' })} data-testid="blur-mode-manual">
              Manual mask
            </button>
            <button type="button" className={`${btn} ${sel.mode === 'faces' ? on : ''}`} disabled={readOnly} onClick={() => patch({ mode: 'faces' })} data-testid="blur-mode-faces">
              Auto faces
            </button>
          </div>
          {sel.mode === 'faces' ? (
            <p className="text-[10px] text-muted-foreground" data-testid="blur-faces-note">
              Every face in this time range is found and blurred on export (on-device face detector, no credits). The preview
              shows the mask below as a stand-in; it is also used if no face detector is available.
            </p>
          ) : null}
          <SliderRow label="Strength" value={sel.amount} min={1} max={100} disabled={readOnly} testId="blur-amount" onCommit={(v) => patch({ amount: v })} />
          <div className="flex flex-wrap gap-1">
            <button type="button" className={btn} disabled={readOnly || outputMs >= sel.endMs - 100} onClick={() => patch({ startMs: Math.round(outputMs) })} data-testid="blur-set-start">
              Start here
            </button>
            <button type="button" className={btn} disabled={readOnly || outputMs <= sel.startMs + 100} onClick={() => patch({ endMs: Math.round(outputMs) })} data-testid="blur-set-end">
              End here
            </button>
            <button type="button" className={btn} onClick={() => onSeekOutput(sel.startMs)} data-testid="blur-go-start">
              Go to start
            </button>
            <button type="button" className={btn} disabled={readOnly} onClick={() => (commit(patchBlurRegion(list, sel.id, null)), setSelId(null))} data-testid="blur-delete">
              <Trash2 className="size-3" aria-hidden /> Delete
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {MASK_SHAPES.filter((s) => s === 'rect' || s === 'ellipse').map((s) => (
              <button key={s} type="button" className={`${btn} ${mask.shape === s ? on : ''}`} disabled={readOnly} onClick={() => patch({ mask: { ...mask, shape: s } })} data-testid={`blur-shape-${s}`}>
                {MASK_LABELS[s]}
              </button>
            ))}
            <button
              type="button"
              className={`${btn} ${mask.invert ? on : ''}`}
              aria-pressed={Boolean(mask.invert)}
              disabled={readOnly}
              onClick={() => patch({ mask: { ...mask, invert: mask.invert ? undefined : true } as LayerMask })}
              data-testid="blur-invert"
            >
              Invert
            </button>
            <button
              type="button"
              className={`${btn} ${keyHere ? 'border-yellow-400 bg-yellow-400/15' : ''}`}
              disabled={readOnly || !inside}
              onClick={() => patch({ mask: toggleMaskKey(mask, local) })}
              title="Keyframe the mask at the playhead (100 ms steps) — move the playhead and the mask to track a subject"
              data-testid="blur-key"
            >
              <Diamond className="size-3" aria-hidden /> {keyHere ? 'Remove key' : 'Key here'}
            </button>
          </div>
          {GEOM.map((r) => (
            <SliderRow
              key={r.k}
              label={r.label}
              value={Math.round(g[r.k] * 100) / 100}
              min={r.min}
              max={r.max}
              disabled={readOnly}
              testId={`blur-mask-${r.k}`}
              onCommit={(v) => patch({ mask: setMaskGeom(mask, r.k, v, Math.max(0, local)) })}
            />
          ))}
          {mask.keys?.length ? (
            <p className="text-[10px] text-muted-foreground">{mask.keys.length} mask key(s): sliders edit the key at the playhead.</p>
          ) : null}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">Blur a face, plate or screen on the main video. Add keys while moving the playhead to follow it.</p>
      )}
    </Section>
  )
}

export function MainVideoTools({
  edits,
  videoItem,
  outputMs,
  durationMs,
  onCommit,
  onSeekOutput,
  readOnly,
}: {
  edits: ClipEditsV2
  videoItem: { srcInMs: number; srcOutMs: number } | null
  outputMs: number
  durationMs: number
  onCommit: (next: ClipEditsV2) => void
  onSeekOutput: (ms: number) => void
  readOnly?: boolean
}) {
  return (
    <div className="space-y-4" data-testid="main-video-tools">
      {bgRemovalUiEnabled() ? (
        <Section title="Remove background" testId="bg-removal-section">
          <BgRemovalSection edits={edits} onCommit={onCommit} readOnly={readOnly} />
        </Section>
      ) : null}
      <Section title="Stabilize" testId="stabilize-section">
        {videoItem ? (
          <StabilizeControl edits={edits} srcInMs={videoItem.srcInMs} srcOutMs={videoItem.srcOutMs} onCommit={onCommit} readOnly={readOnly} />
        ) : (
          <p className="text-[10px] text-muted-foreground">Select a Video item on the timeline to stabilize it.</p>
        )}
      </Section>
      <Section title="Reverse" testId="video-reverse-section">
        {videoItem ? (
          <ReverseControl edits={edits} srcInMs={videoItem.srcInMs} srcOutMs={videoItem.srcOutMs} onCommit={onCommit} readOnly={readOnly} />
        ) : (
          <p className="text-[10px] text-muted-foreground">Select a Video item on the timeline to reverse it.</p>
        )}
      </Section>
      <SceneSplitSection edits={edits} onCommit={onCommit} onSeekOutput={onSeekOutput} readOnly={readOnly} videoItem={videoItem} />
      <BlurRegionsSection edits={edits} outputMs={outputMs} durationMs={durationMs} onCommit={onCommit} onSeekOutput={onSeekOutput} readOnly={readOnly} />
    </div>
  )
}

/**
 * G4cfix: scene split for one B-roll item or inserted clip — scans its own file over the used
 * media range and splits it into pieces at the cuts you keep (manual, no credits).
 */
export function MediaSceneSplit({
  edits,
  kind,
  id,
  url,
  inMs,
  outMs,
  onCommit,
  readOnly,
}: {
  edits: ClipEditsV2
  kind: 'broll' | 'insert'
  id: string
  url: string | null | undefined
  /** Used media range (ms in the item's file). */
  inMs: number
  outMs: number
  onCommit: (next: ClipEditsV2) => void
  readOnly?: boolean
}) {
  const [busy, setBusy] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [cands, setCands] = useState<{ t: number; on: boolean }[]>([])
  const stop = useRef(false)
  useEffect(() => () => void (stop.current = true), [])
  const scan = async () => {
    if (!url) return
    stop.current = false
    setMsg(null)
    setCands([])
    setBusy(0)
    const r = await scanSceneCuts({ url, ranges: [[inMs, outMs]], toVideoSec: (t) => t / 1000, onProgress: setBusy, stopped: () => stop.current })
    setBusy(null)
    if ('stopped' in r) return
    if ('error' in r) return setMsg(r.error)
    const keep = usableCuts(r.cuts.map((c) => c.t), [[inMs, outMs]], [], SCENE_MIN_SEG_MS)
    setCands(keep.map((t) => ({ t, on: true })))
    if (!keep.length) setMsg('No scene changes found.')
  }
  const apply = () => {
    const pick = cands.filter((c) => c.on).map((c) => c.t)
    if (!pick.length) return
    onCommit(kind === 'broll' ? splitBrollAtMedia(edits, id, pick) : splitInsertAtMedia(edits, id, pick))
    setCands([])
    setMsg(`Split into ${pick.length + 1} parts.`)
  }
  return (
    <div className="space-y-1" data-testid={`media-scene-split-${kind}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {busy != null ? (
          <>
            <span className="text-[11px] tabular-nums" data-testid="media-scene-split-progress">Scanning… {busy}%</span>
            <button type="button" className={btn} onClick={() => (stop.current = true)}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className={btn} disabled={readOnly || !url} onClick={() => void scan()} data-testid="media-scene-split-detect">
            <Scissors className="size-3" aria-hidden /> Detect scenes
          </button>
        )}
        {cands.length ? (
          <button type="button" className={`${btn} ${on}`} disabled={readOnly || !cands.some((c) => c.on)} onClick={apply} data-testid="media-scene-split-apply">
            Split at {cands.filter((c) => c.on).length}
          </button>
        ) : null}
      </div>
      {cands.length ? (
        <div className="flex flex-wrap gap-2 text-[11px]">
          {cands.map((c, i) => (
            <label key={c.t} className="flex items-center gap-1 tabular-nums">
              <input type="checkbox" checked={c.on} onChange={() => setCands(cands.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} />
              {fmtMs(c.t)}
            </label>
          ))}
        </div>
      ) : null}
      {msg ? <p className="text-[10px] text-muted-foreground" data-testid="media-scene-split-msg">{msg}</p> : null}
    </div>
  )
}
