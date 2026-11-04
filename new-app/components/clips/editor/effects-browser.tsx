'use client'

/**
 * EFFECTS1b: CapCut-style browser in the left panel (rail → Effects). Tabs:
 *  - Effects: the existing Color panel (preset tiles + sliders; applies to the clip / layer picked in its target menu).
 *  - Transitions: tiles that reuse the timeline's own apply functions (setCutTransition /
 *    applyCutTransitionToAll) on the cut nearest the playhead. Greyed with a hint when there are no cuts.
 * Nothing here renders video; preview + export stay the existing paths.
 */
import { useMemo, useState, type ReactNode } from 'react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { keepSegments } from '@/lib/clips/edits'
import {
  TRANSITIONS,
  applyCutTransitionToAll,
  cutMatchToleranceMs,
  setCutTransition,
  type TransitionGroup,
} from '@/lib/clips/editor/transitions'
import { Thumb } from '@/components/clips/editor/timeline/transition-popover'
import { newTemplateItems, TEXT_MAX_ITEMS, TITLE_TEMPLATES } from '@/lib/clips/editor/text-items'
import { TEMPLATE_CATEGORIES } from '@/lib/clips/editor/text-templates-catalog'

type Tab = 'effects' | 'transitions' | 'templates'
const TABS: { id: Tab; label: string }[] = [
  { id: 'effects', label: 'Effects' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'templates', label: 'Templates' },
]
const mkTplId = () => `tpl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
const DEFAULT_DUR_MS = 500

export function EffectsBrowser({
  edits,
  onEdits,
  playheadSourceMs,
  outputMs = 0,
  outputDurationMs = 0,
  onSeekOutput,
  children,
}: {
  edits: ClipEditsV2
  onEdits: (next: ClipEditsV2) => void
  playheadSourceMs: number
  outputMs?: number
  outputDurationMs?: number
  onSeekOutput?: (ms: number) => void
  children: ReactNode
}) {
  const [tab, setTab] = useState<Tab>('effects')
  const segs = useMemo(
    () => keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges) as [number, number][],
    [edits.trim.in, edits.trim.out, edits.cutRanges],
  )
  const cuts = useMemo(() => segs.slice(1).map(([b0]) => b0), [segs])
  const nearestCut = useMemo(() => {
    if (!cuts.length) return null
    return cuts.reduce((best, c) => (Math.abs(c - playheadSourceMs) < Math.abs(best - playheadSourceMs) ? c : best), cuts[0]!)
  }, [cuts, playheadSourceMs])
  const tol = cutMatchToleranceMs()
  const current = nearestCut == null ? null : (edits.transitions ?? []).find((t) => Math.abs(t.srcMs - nearestCut) <= tol) ?? null
  const groups = useMemo(() => Array.from(new Set(TRANSITIONS.map((t) => t.group))) as TransitionGroup[], [])
  const noCuts = nearestCut == null
  const hint = 'No cuts yet: split or cut the clip first, then pick a transition (it goes on the cut nearest the playhead).'

  return (
    <div className="flex min-h-0 flex-col" data-testid="effects-browser">
      <div className="mb-2 flex gap-1 border-b border-border pb-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`rounded px-2 py-1 text-xs ${tab === t.id ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted'}`}
            onClick={() => setTab(t.id)}
            data-testid={`effects-browser-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={tab === 'effects' ? undefined : 'hidden'}>{children}</div>
      {tab === 'templates' ? (
        <div className="space-y-2" data-testid="effects-browser-templates">
          <p className="text-[11px] text-muted-foreground">Click to add at the playhead. Every piece stays an editable text / shape item.</p>
          {(['Basics', ...TEMPLATE_CATEGORIES] as string[]).map((cat) => {
            const list = TITLE_TEMPLATES.filter((t) => (t.category ?? 'Basics') === cat)
            if (!list.length) return null
            return (
              <div key={cat}>
                <p className="px-1 text-[11px] uppercase tracking-wide text-muted-foreground">{cat}</p>
                <div className="grid grid-cols-2 gap-1">
                  {list.map((t) => {
                    const full = (edits.textItems?.length ?? 0) + t.parts.length > TEXT_MAX_ITEMS
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={full || outputDurationMs <= 0}
                        title={full ? `Text lane is full (${TEXT_MAX_ITEMS} items): delete some first` : `Add “${t.label}” at the playhead`}
                        className="rounded border border-border bg-muted/40 px-2 py-2 text-left text-[11px] hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => {
                          const items = newTemplateItems(t.id, mkTplId, outputMs, outputDurationMs)
                          if (items.length) {
                            onEdits({ ...edits, textItems: [...(edits.textItems ?? []), ...items] })
                            const settle = Math.max(...items.map((i) => Math.min(i.endMs - 1, i.startMs + (i.anim?.in?.durMs ?? 0) + 50)))
                            onSeekOutput?.(settle)
                          }
                        }}
                        data-testid={`effects-browser-template-${t.id}`}
                      >
                        {t.label}
                        <span className="block text-[11px] text-muted-foreground">{t.parts.length} layer{t.parts.length > 1 ? 's' : ''}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
      {tab === 'transitions' ? (
        <div className="space-y-2" data-testid="effects-browser-transitions">
          <p className="text-[11px] text-muted-foreground">
            {noCuts ? hint : 'Click a tile: it goes on the cut nearest the playhead. Edit or remove it by clicking the cut on the timeline.'}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-40"
              disabled={noCuts || !current}
              title={noCuts ? hint : 'Remove the transition on this cut'}
              onClick={() => nearestCut != null && onEdits(setCutTransition(edits, nearestCut, null))}
              data-testid="effects-browser-transition-remove"
            >
              Remove
            </button>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-40"
              disabled={noCuts || !current}
              title={noCuts ? hint : 'Use this transition on every cut'}
              onClick={() => current && onEdits(applyCutTransitionToAll(edits, segs, { type: current.type, durMs: current.durMs }))}
              data-testid="effects-browser-transition-all"
            >
              Apply to all cuts
            </button>
          </div>
          {groups.map((g) => (
            <div key={g}>
              <p className="px-1 text-[11px] uppercase tracking-wide text-muted-foreground">{g}</p>
              <div className="grid grid-cols-4 gap-0.5">
                {TRANSITIONS.filter((t) => t.group === g).map((t) => (
                  <button
                    key={t.type}
                    type="button"
                    disabled={noCuts}
                    title={noCuts ? hint : t.label}
                    aria-pressed={current?.type === t.type}
                    className={`flex flex-col items-center gap-0.5 rounded p-1 text-[11px] leading-tight hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 ${current?.type === t.type ? 'bg-muted ring-1 ring-primary' : ''}`}
                    onClick={() =>
                      nearestCut != null &&
                      onEdits(setCutTransition(edits, nearestCut, { type: t.type, durMs: current?.durMs ?? DEFAULT_DUR_MS }))
                    }
                    data-testid={`effects-browser-transition-${t.type}`}
                  >
                    <Thumb type={t.type} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
