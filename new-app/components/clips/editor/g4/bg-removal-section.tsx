'use client'

import { useEffect, useState } from 'react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { BG_DEFAULT, bgRemovalBlockedReason, normalizeBgRemoval, type BgRemoval } from '@/lib/clips/editor/bg-removal'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'

const btn =
  'inline-flex h-7 items-center gap-1 rounded border border-border px-2 text-[11px] hover:bg-muted disabled:pointer-events-none disabled:opacity-35'
const on = 'bg-primary text-primary-foreground hover:bg-primary'
const SWATCHES = ['000000', 'ffffff', '00b140', '1e90ff', 'f5f5dc', '808080']

export function BgRemovalSection({
  edits,
  onCommit,
  readOnly,
  clipId,
}: {
  edits: ClipEditsV2
  onCommit: (next: ClipEditsV2) => void
  readOnly?: boolean
  clipId?: string
}) {
  const cur = normalizeBgRemoval(edits.bgRemoval)
  const blocked = bgRemovalBlockedReason(edits)
  const enabled = !!cur?.enabled && !blocked
  const set = (next: BgRemoval | undefined) => onCommit({ ...edits, bgRemoval: next })
  const patch = (p: Partial<BgRemoval>) => set({ ...(cur ?? BG_DEFAULT), ...p, enabled: true })
  const bg = cur?.background
  const [renderStatus, setRenderStatus] = useState<'idle' | 'queued' | 'rendering'>('idle')
  const [mattePreview, setMattePreview] = useState<{ state: string; url: string | null }>({ state: 'idle', url: null })
  const [retryToken, setRetryToken] = useState(0)
  const [previewError, setPreviewError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled || !clipId) {
      setRenderStatus('idle')
      setMattePreview({ state: 'idle', url: null })
      return
    }
    let gone = false
    const endpoint = `/api/clips/clips/${encodeURIComponent(clipId)}/bg-matte`
    const quality = cur?.quality === 'detail' ? 'detail' : 'standard'
    setMattePreview({ state: 'queued', url: null })
    // E2: create (or reuse) a real 6s mask job as soon as removal is enabled.
    // This sample is provided at 0 user credits, independent of export billing.
    const start = async () => {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quality }),
        })
        const payload = await res.json() as { data?: { state?: string; url?: string | null }; error?: string }
        if (gone) return
        if (!res.ok) {
          setMattePreview({ state: 'failed', url: null })
          setPreviewError(payload.error || 'Unable to queue matte preview')
          return
        }
        setPreviewError(null)
        setMattePreview({ state: payload.data?.state ?? 'queued', url: payload.data?.url ?? null })
      } catch {
        if (!gone) {
          setMattePreview({ state: 'failed', url: null })
          setPreviewError('Could not connect to the preview worker')
        }
      }
    }
    const check = async () => {
      try {
        const res = await fetch(`${endpoint}?quality=${quality}`, { cache: 'no-store' })
        if (res.ok) {
          const payload = await res.json() as { data?: { state?: string; url?: string | null } }
          if (!gone) {
            const next = { state: payload.data?.state ?? 'idle', url: payload.data?.url ?? null }
            setMattePreview((prev) => prev.state === next.state && prev.url === next.url ? prev : next)
          }
        }
      } catch { /* Keep last known status. User can retry a failed generation. */ }
      try {
        const res = await fetch(`/api/clips/clips/${encodeURIComponent(clipId)}/active-render`)
        if (res.ok) {
          const payload = await res.json() as { data?: { render?: { status?: string } | null } }
          if (!gone) {
            const status = payload.data?.render?.status
            setRenderStatus(status === 'RENDERING' ? 'rendering' : status === 'QUEUED' ? 'queued' : 'idle')
          }
        }
      } catch { /* Export progress is independent of the matte preview. */ }
    }
    void start().then(() => { if (!gone) void check() })
    const interval = window.setInterval(() => { void check() }, 3000)
    return () => { gone = true; window.clearInterval(interval) }
  }, [clipId, enabled, cur?.quality, retryToken])
  return (
    <div className="space-y-1.5" data-testid="bg-removal">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={`${btn} ${!enabled ? on : ''}`}
          disabled={readOnly}
          data-testid="bg-removal-off"
          onClick={() => enabled && set(undefined)}
        >
          Off
        </button>
        <button
          type="button"
          className={`${btn} ${enabled ? on : ''}`}
          disabled={readOnly || !!blocked}
          data-testid="bg-remove-toggle"
          onClick={() => !enabled && set({ ...(cur ?? BG_DEFAULT), enabled: true })}
        >
          Remove background
        </button>
      </div>
      {blocked ? (
        <p className="text-[11px] text-muted-foreground" data-testid="bg-removal-blocked">
          {blocked}
        </p>
      ) : null}
      {enabled && cur ? (
        <>
          <div className="flex items-center gap-1.5" data-testid="bg-removal-quality">
            {(['standard', 'detail'] as const).map((q) => (
              <button
                key={q}
                type="button"
                className={`${btn} ${cur.quality === q ? on : ''}`}
                disabled={readOnly}
                onClick={() => patch({ quality: q })}
                data-testid={`bg-quality-${q}`}
              >
                {q === 'standard' ? 'Standard' : 'Detail (hair)'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" data-testid="bg-removal-background">
            <button
              type="button"
              className={`${btn} ${bg?.type === 'blur' ? on : ''}`}
              disabled={readOnly}
              onClick={() => patch({ background: { type: 'blur', amount: bg?.type === 'blur' ? bg.amount : 50 } })}
              data-testid="bg-kind-blur"
            >
              Blur
            </button>
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color #${c}`}
                disabled={readOnly}
                data-testid={`bg-color-${c}`}
                className={`h-6 w-6 rounded border ${bg?.type === 'color' && bg.color === c ? 'ring-2 ring-primary' : 'border-border'}`}
                style={{ background: `#${c}` }}
                onClick={() => patch({ background: { type: 'color', color: c } })}
              />
            ))}
            <button
              type="button"
              className={`${btn} ${bg?.type === 'none' ? on : ''}`}
              disabled={readOnly}
              onClick={() => patch({ background: { type: 'none' } })}
              data-testid="bg-kind-none"
            >
              None
            </button>
          </div>
          {bg?.type === 'blur' ? (
            <SliderRow
              label="Blur"
              value={bg.amount}
              min={0}
              max={100}
              disabled={readOnly}
              testId="bg-blur-amount"
              onCommit={(v) => patch({ background: { type: 'blur', amount: v } })}
            />
          ) : null}
          <SliderRow
            label="Feather"
            value={cur.refine.feather}
            min={0}
            max={100}
            disabled={readOnly}
            testId="bg-feather"
            onCommit={(v) => patch({ refine: { ...cur.refine, feather: v } })}
          />
          <SliderRow
            label="Choke / Expand"
            value={cur.refine.choke}
            min={-100}
            max={100}
            disabled={readOnly}
            testId="bg-choke"
            onCommit={(v) => patch({ refine: { ...cur.refine, choke: v } })}
          />
        </>
      ) : null}
      <p className="text-[11px] text-muted-foreground" role="status" data-testid="bg-removal-note">
        {!enabled ? 'Off. Settings were reset; enabling starts with the default matte controls.'
          : mattePreview.state === 'ready' && mattePreview.url ? 'Subject matte ready. The main preview composites the person during the six-second sample; export applies the effect to the full clip.'
          : mattePreview.state === 'processing' ? 'Processing a 6-second subject matte (0 credits). Background color and edge controls update the composite without regenerating the subject mask…'
          : mattePreview.state === 'failed' ? (previewError || 'Matte preview generation failed. Retry below.')
          : mattePreview.state === 'queued' ? 'Person matte queued (0 credits). Multiple people may not all be retained by the current matte model…'
          : renderStatus === 'rendering' ? 'Export rendering; preparing the person matte…'
          : renderStatus === 'queued' ? 'Background matte queued with the export worker…'
          : 'Person matte preview will generate automatically (0 credits).'}
      </p>
      {enabled ? <p className="text-[11px] text-muted-foreground" data-testid="bg-matte-multi-person-note">The current subject mask may miss people in group footage. Check every person before exporting; changing blur or feather cannot recover a person absent from the matte.</p> : null}
      {enabled && mattePreview.state === 'failed' && clipId ? (
        <button type="button" className={btn} onClick={() => { setPreviewError(null); setRetryToken(v => v + 1) }} data-testid="bg-matte-retry">Retry matte preview · 0 credits</button>
      ) : null}
      {enabled && mattePreview.url ? (
        <div className="space-y-1 rounded-md border border-border/60 p-2" data-testid="bg-matte-preview">
          <p className="text-[11px] font-medium">Person matte preview (6-second grayscale mask)</p>
          <video src={mattePreview.url} controls muted playsInline preload="metadata" className="max-h-40 w-full rounded bg-black object-contain" aria-label="Generated person matte preview" />
          <p className="text-[10px] text-muted-foreground">White keeps the person; black replaces the background. The final background and other layers are composited on export.</p>
        </div>
      ) : null}
    </div>
  )
}
