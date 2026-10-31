'use client'

/**
 * G4a: waveform / histogram / vectorscope of the main video at the playhead (graded with the
 * export's pointwise math + active adjustment layers), plus Auto color and the white-balance
 * eyedropper. Both only write ordinary Adjust values (temperature, tint, exposure, contrast).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { ColorSpec } from '@/lib/clips/editor/color'
import type { Rgb } from '@/lib/clips/editor/color-grade'
import { adjustGradesAt, videoGradeAt } from '@/lib/clips/editor/grade-runtime'
import { computeScopes, gradePixels, VEC, type ScopeData } from '@/lib/clips/editor/scopes'
import { autoColor, samplePixels, solveNeutral } from '@/lib/clips/editor/auto-color'
import { grabFrame, type Frame } from './frame-grab'
import { stageFrame } from './grade-preview'
import { lutFor } from './lut-cache'

type Kind = 'waveform' | 'histogram' | 'vectorscope'

function drawScope(c: HTMLCanvasElement, kind: Kind, d: ScopeData) {
  const ctx = c.getContext('2d')
  if (!ctx) return
  const W = c.width
  const H = c.height
  ctx.fillStyle = '#0b0b0b'
  ctx.fillRect(0, 0, W, H)
  if (kind === 'waveform') {
    const img = ctx.createImageData(d.waveCols, 256)
    let max = 1
    for (let i = 0; i < d.wave.length; i++) max = Math.max(max, d.wave[i]!)
    for (let col = 0; col < d.waveCols; col++)
      for (let l = 0; l < 256; l++) {
        const v = d.wave[col * 256 + l]!
        if (!v) continue
        const a = Math.min(255, 60 + Math.round((Math.log1p(v) / Math.log1p(max)) * 195))
        const j = ((255 - l) * d.waveCols + col) * 4
        img.data[j] = 120
        img.data[j + 1] = 255
        img.data[j + 2] = 140
        img.data[j + 3] = a
      }
    const tmp = document.createElement('canvas')
    tmp.width = d.waveCols
    tmp.height = 256
    tmp.getContext('2d')?.putImageData(img, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(tmp, 0, 0, W, H)
  } else if (kind === 'histogram') {
    const cols = ['rgba(239,68,68,.65)', 'rgba(34,197,94,.65)', 'rgba(59,130,246,.65)', 'rgba(229,231,235,.5)']
    let max = 1
    for (const h of d.hist) for (let i = 1; i < 255; i++) max = Math.max(max, h[i]!)
    ctx.globalCompositeOperation = 'lighter'
    d.hist.forEach((h, k) => {
      ctx.fillStyle = cols[k]!
      ctx.beginPath()
      ctx.moveTo(0, H)
      for (let i = 0; i < 256; i++) ctx.lineTo((i / 255) * W, H - Math.min(1, h[i]! / max) * H)
      ctx.lineTo(W, H)
      ctx.fill()
    })
    ctx.globalCompositeOperation = 'source-over'
  } else {
    const img = ctx.createImageData(VEC, VEC)
    let max = 1
    for (let i = 0; i < d.vec.length; i++) max = Math.max(max, d.vec[i]!)
    for (let i = 0; i < d.vec.length; i++) {
      const v = d.vec[i]!
      if (!v) continue
      img.data[i * 4] = 140
      img.data[i * 4 + 1] = 255
      img.data[i * 4 + 2] = 160
      img.data[i * 4 + 3] = Math.min(255, 70 + Math.round((Math.log1p(v) / Math.log1p(max)) * 185))
    }
    const tmp = document.createElement('canvas')
    tmp.width = VEC
    tmp.height = VEC
    tmp.getContext('2d')?.putImageData(img, 0, 0)
    const s = Math.min(W, H)
    ctx.drawImage(tmp, (W - s) / 2, (H - s) / 2, s, s)
    ctx.strokeStyle = 'rgba(255,255,255,.2)'
    ctx.beginPath()
    ctx.arc(W / 2, H / 2, s / 2 - 1, 0, Math.PI * 2)
    ctx.moveTo(W / 2 - s / 2, H / 2)
    ctx.lineTo(W / 2 + s / 2, H / 2)
    ctx.moveTo(W / 2, H / 2 - s / 2)
    ctx.lineTo(W / 2, H / 2 + s / 2)
    ctx.stroke()
  }
}

export function ScopesPanel({
  edits,
  spec,
  mode,
  onCommit,
  disabled,
}: {
  edits: ClipEditsV2
  /** Spec of the Color panel target (what Auto / the eyedropper change). */
  spec: ColorSpec
  /** 'source' = target grades the raw video (whole video / Video item); 'adjust' = an adjustment
   *  layer (measured after the video grade); 'none' = B-roll (Auto / eyedropper off). */
  mode: 'source' | 'adjust' | 'none'
  onCommit: (s: ColorSpec) => void
  disabled?: boolean
}) {
  const [kind, setKind] = useState<Kind>('waveform')
  const [frame, setFrame] = useState<Frame | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pick, setPick] = useState(false)
  const scopeRef = useRef<HTMLCanvasElement | null>(null)
  const thumbRef = useRef<HTMLCanvasElement | null>(null)
  const graded = useRef<{ base: Uint8ClampedArray; out: Uint8ClampedArray } | null>(null)

  const refresh = useCallback(async () => {
    const f = await grabFrame(256)
    if ('error' in f) {
      setErr(f.error)
      return
    }
    setErr(null)
    setFrame(f)
  }, [])

  // Refresh on open, on edits, and ~3×/s while playing.
  useEffect(() => {
    void refresh()
  }, [refresh, edits])
  useEffect(() => {
    const id = setInterval(() => {
      const v = stageFrame.video
      if (v && !v.paused) void refresh()
      else if (v && frame && Math.abs(v.currentTime - frame.t) > 0.02) void refresh()
    }, 330)
    return () => clearInterval(id)
  }, [refresh, frame])

  useEffect(() => {
    if (!frame) return
    const outMs = stageFrame.outMs
    const main = videoGradeAt(edits, stageFrame.srcMs, outMs)
    const adj = adjustGradesAt(edits, outMs).map((g) => g.spec)
    const lf = (id: string) => lutFor(id)
    const afterMain = gradePixels(frame.px, [main], lf)
    const out = adj.length ? gradePixels(afterMain, adj, lf) : afterMain
    graded.current = { base: mode === 'adjust' ? afterMain : frame.px, out }
    const d = computeScopes(out, frame.w, frame.h, 128)
    if (scopeRef.current) drawScope(scopeRef.current, kind, d)
    const t = thumbRef.current
    if (t) {
      t.width = frame.w
      t.height = frame.h
      const ctx = t.getContext('2d')
      ctx?.putImageData(new ImageData(new Uint8ClampedArray(out), frame.w, frame.h), 0, 0)
    }
  }, [frame, edits, kind, mode])

  const auto = () => {
    const g = graded.current
    if (!g || !frame) return
    onCommit(autoColor(spec, samplePixels(g.base, frame.w, frame.h), spec.lut ? lutFor(spec.lut.id) : null))
  }
  const pickAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = graded.current
    if (!pick || !g || !frame) return
    const r = e.currentTarget.getBoundingClientRect()
    const cx = Math.floor(((e.clientX - r.left) / r.width) * frame.w)
    const cy = Math.floor(((e.clientY - r.top) / r.height) * frame.h)
    const acc: Rgb = [0, 0, 0]
    let n = 0
    for (let y = Math.max(0, cy - 2); y <= Math.min(frame.h - 1, cy + 2); y++)
      for (let x = Math.max(0, cx - 2); x <= Math.min(frame.w - 1, cx + 2); x++) {
        const i = (y * frame.w + x) * 4
        acc[0] += g.base[i]! / 255
        acc[1] += g.base[i + 1]! / 255
        acc[2] += g.base[i + 2]! / 255
        n++
      }
    const avg = acc.map((v) => v / n) as Rgb
    const wb = solveNeutral(spec, avg, spec.lut ? lutFor(spec.lut.id) : null)
    const adjust = { ...(spec.adjust ?? {}), temperature: wb.temperature, tint: wb.tint }
    onCommit({ ...spec, adjust })
    setPick(false)
  }

  return (
    <div className="space-y-2" data-testid="color-scopes">
      <div className="flex items-center gap-1" role="tablist" aria-label="Scope">
        {(['waveform', 'histogram', 'vectorscope'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={cn('rounded px-2 py-0.5 text-[11px] capitalize', kind === k ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            data-testid={`color-scope-${k}`}
          >
            {k}
          </button>
        ))}
        <button type="button" className="ml-auto rounded px-2 py-0.5 text-[11px] hover:bg-muted" onClick={() => void refresh()} data-testid="color-scope-refresh">
          Refresh
        </button>
      </div>
      {err ? (
        <p className="text-[11px] text-muted-foreground" data-testid="color-scope-error">
          {err}
        </p>
      ) : null}
      <canvas ref={scopeRef} width={256} height={128} className="w-full rounded border border-border" data-testid="color-scope-canvas" />
      <div className="flex items-start gap-2">
        <canvas
          ref={thumbRef}
          className={cn('w-24 rounded border border-border', pick ? 'cursor-crosshair ring-2 ring-primary' : '')}
          onClick={pickAt}
          data-testid="color-scope-frame"
          aria-label="Frame at the playhead"
        />
        <div className="flex flex-col gap-1">
          <Button size="xs" variant="outline" disabled={disabled || mode === 'none' || !frame} onClick={auto} data-testid="color-auto" title={mode === 'none' ? 'Auto color works on the main video and adjustment layers' : 'Balance white, exposure and contrast from this frame (sets the sliders)'}>
            Auto color
          </Button>
          <Button
            size="xs"
            variant={pick ? 'default' : 'outline'}
            disabled={disabled || mode === 'none' || !frame}
            onClick={() => setPick((p) => !p)}
            data-testid="color-wb-pick"
            title="Click something that should be white or gray in the frame"
          >
            {pick ? 'Click a neutral spot…' : 'WB eyedropper'}
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">Scopes show the main video at the playhead with its grade and adjustment layers (B-roll and effects not included).</p>
    </div>
  )
}
