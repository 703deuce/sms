'use client'

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
}: {
  edits: ClipEditsV2
  onCommit: (next: ClipEditsV2) => void
  readOnly?: boolean
}) {
  const cur = normalizeBgRemoval(edits.bgRemoval)
  const blocked = bgRemovalBlockedReason(edits)
  const enabled = !!cur?.enabled && !blocked
  const set = (next: BgRemoval | undefined) => onCommit({ ...edits, bgRemoval: next })
  const patch = (p: Partial<BgRemoval>) => set({ ...(cur ?? BG_DEFAULT), ...p, enabled: true })
  const bg = cur?.background
  return (
    <div className="space-y-1.5" data-testid="bg-removal">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={`${btn} ${!enabled ? on : ''}`}
          disabled={readOnly}
          data-testid="bg-removal-off"
          onClick={() => cur && set({ ...cur, enabled: false })}
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
        <p className="text-[10px] text-muted-foreground" data-testid="bg-removal-blocked">
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
      <p className="text-[10px] text-muted-foreground" data-testid="bg-removal-note">
        Applied on export (the preview shows the original). Works on people; pets and objects count as background.
      </p>
    </div>
  )
}
