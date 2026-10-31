'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { Timebase } from '@/lib/clips/editor/clip-timeline'
import { DEFAULT_PACING, fixAllPacing, fixPacingFlag, normalizePacing, PACING_LIMITS, pacingFlags, type PacingSettings } from '@/lib/clips/editor/pacing'

const STORE_KEY = 'clips.pacing.v1'

function loadSettings(): PacingSettings {
  try {
    return normalizePacing(JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null'))
  } catch {
    return DEFAULT_PACING
  }
}

const fmt = (ms: number) => {
  const s = Math.max(0, ms) / 1000
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
}

/**
 * G1c pacing checker: long static shots, 1–3 frame slivers, tiny gaps. Click a row to jump;
 * slivers / gaps have a one-click fix. Pure timeline math.
 */
export function PacingPanel({
  edits,
  tb,
  onSeekOutput,
  onCommit,
  onClose,
  readOnly,
}: {
  edits: ClipEditsV2
  tb: Timebase
  onSeekOutput: (ms: number) => void
  onCommit: (next: ClipEditsV2) => void
  onClose: () => void
  readOnly?: boolean
}) {
  const [settings, setSettings] = useState<PacingSettings>(DEFAULT_PACING)
  useEffect(() => setSettings(loadSettings()), [])
  const save = (p: Partial<PacingSettings>) => {
    const next = normalizePacing({ ...settings, ...p })
    setSettings(next)
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(next))
    } catch {
      /* private mode */
    }
  }
  const flags = useMemo(() => pacingFlags(edits, tb, settings), [edits, tb, settings])
  const fixable = flags.filter((f) => f.fix)
  const num = (key: keyof PacingSettings, label: string, unit: string) => (
    <label className="flex items-center gap-1">
      {label}
      <input
        type="number"
        className="w-12 rounded border border-border bg-background px-1 py-0.5 tabular-nums"
        min={PACING_LIMITS[key][0]}
        max={PACING_LIMITS[key][1]}
        value={settings[key]}
        onChange={(e) => save({ [key]: Number(e.target.value) })}
        data-testid={`pacing-setting-${key}`}
      />
      {unit}
    </label>
  )
  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-2 text-[11px]" data-testid="pacing-panel">
      <div className="mb-1.5 flex flex-wrap items-center gap-3">
        <span className="font-medium">Pacing check</span>
        {num('staticMaxS', 'Static over', 's')}
        {num('sliverFrames', 'Slivers ≤', 'fr')}
        {num('gapFrames', 'Gaps ≤', 'fr')}
        <span className="ml-auto flex items-center gap-1">
          {fixable.length && !readOnly ? (
            <button
              type="button"
              className="rounded bg-primary px-2 py-0.5 text-primary-foreground"
              onClick={() => {
                const n = fixAllPacing(edits, fixable)
                if (n) onCommit(n)
              }}
              data-testid="pacing-fix-all"
            >
              Fix all ({fixable.length})
            </button>
          ) : null}
          <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={onClose} aria-label="Close pacing check" data-testid="pacing-close">
            <X className="size-3.5" />
          </button>
        </span>
      </div>
      {flags.length ? (
        <ul className="max-h-40 space-y-0.5 overflow-y-auto" data-testid="pacing-flags">
          {flags.map((f) => (
            <li key={f.id} className="flex items-center gap-2" data-testid={`pacing-flag-${f.kind}`}>
              <button type="button" className="flex flex-1 items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-muted" onClick={() => onSeekOutput(f.startMs)}>
                <span
                  className={cn(
                    'rounded px-1 text-[9px] font-semibold uppercase',
                    f.kind === 'static' ? 'bg-amber-500/20 text-amber-600' : f.kind === 'sliver' ? 'bg-red-500/20 text-red-600' : 'bg-sky-500/20 text-sky-600',
                  )}
                >
                  {f.kind}
                </span>
                <span className="tabular-nums text-muted-foreground">{fmt(f.startMs)}</span>
                <span>{f.label}</span>
              </button>
              {f.fix && !readOnly ? (
                <button
                  type="button"
                  className="rounded border border-border px-1.5 py-0.5 hover:bg-muted"
                  onClick={() => {
                    const n = fixPacingFlag(edits, f)
                    if (n) onCommit(n)
                  }}
                  data-testid="pacing-fix"
                >
                  {f.fix.type === 'cutSource' ? 'Remove' : f.fix.type === 'restoreSource' ? 'Restore frames' : 'Close gap'}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground" data-testid="pacing-clean">
          No pacing issues.
        </p>
      )}
    </div>
  )
}
