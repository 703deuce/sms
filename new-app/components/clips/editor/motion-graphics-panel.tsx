'use client'

import { useState } from 'react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { MotionPlanSchema, type MotionPlan } from '@/lib/clips/motion-graphics/contract'
import { addTextBackedMotionPlan, removeTextBackedMotionGraphics } from '@/lib/clips/motion-graphics/text-adapter'

type Style = 'minimal' | 'narrative' | 'gaming' | 'tech'
const PRESETS: { id: Style; label: string }[] = [
  { id: 'minimal', label: 'Minimal Professional' },
  { id: 'narrative', label: 'Narrative Motion' },
  { id: 'gaming', label: 'Gaming Highlights' },
  { id: 'tech', label: 'Tech Motion' },
]

export function MotionGraphicsPanel(props: {
  clipId: string
  edits: ClipEditsV2
  onEdits: (next: ClipEditsV2) => void
}) {
  const [style, setStyle] = useState<Style>('narrative')
  const [instruction, setInstruction] = useState('')
  const [plan, setPlan] = useState<MotionPlan | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sourceVersion, setSourceVersion] = useState<number | null>(null)
  const aiItems = props.edits.textItems?.filter(i => i.id.startsWith('mg_')) ?? []

  async function generate() {
    setGenerating(true); setError(''); setNotice(''); setPlan(null)
    try {
      const res = await fetch('/api/clips/clips/' + encodeURIComponent(props.clipId) + '/motion-graphics/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style, instruction }),
      })
      const body: unknown = await res.json()
      if (!res.ok) {
        const issue = (body as { error?: string })?.error
        throw new Error(issue || 'Motion graphics generation failed')
      }
      const data = (body as { data?: { plan?: unknown; basedOnEditsSaveVersion?: number } }).data
      const parsed = MotionPlanSchema.safeParse(data?.plan)
      if (!parsed.success) throw new Error('Agent returned an invalid motion graphics plan')
      setSourceVersion(data?.basedOnEditsSaveVersion ?? null)
      setPlan(parsed.data)
      setNotice(parsed.data.graphics.length
        ? 'Review these suggestions and apply them to editable Text layers.'
        : 'No useful graphic additions found for this clip.')
    } catch (e) {
      setError((e as Error).message || 'Unable to generate graphics')
    } finally {
      setGenerating(false)
    }
  }

  function apply() {
    if (!plan) return
    const result = addTextBackedMotionPlan(props.edits, plan)
    if (!result.ok) { setError(result.code + ': ' + result.detail); return }
    props.onEdits(result.edits)
    setNotice('Applied as editable Text layers. Export uses the existing text animation renderer.')
    setError(''); setPlan(null); setSourceVersion(null)
  }

  function clearGenerated() {
    const ids = aiItems.map(i => i.id.slice(3))
    props.onEdits(removeTextBackedMotionGraphics(props.edits, ids))
    setNotice('Removed generated motion text; your other editor content is unchanged.')
    setPlan(null); setError('')
  }

  return (
    <section className="space-y-4 p-3" data-testid="motion-graphics-panel" aria-label="AI Motion Graphics">
      <div>
        <h3 className="text-sm font-semibold">AI Motion Graphics</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Generate transcript-grounded, editable animated text using the existing preview and export engine.
          This first renderer supports text, highlights, and lower thirds — not charts or presenter masking.
        </p>
      </div>
      <label className="block space-y-1 text-xs">
        <span>Motion style</span>
        <select className="w-full rounded border bg-background p-2 text-sm" value={style}
          onChange={e => setStyle(e.target.value as Style)}>
          {PRESETS.map(p => <option value={p.id} key={p.id}>{p.label}</option>)}
        </select>
      </label>
      <label className="block space-y-1 text-xs">
        <span>Additional creative direction (optional)</span>
        <textarea className="min-h-20 w-full rounded border bg-background p-2 text-sm"
          value={instruction} maxLength={1000} onChange={e => setInstruction(e.target.value)}
          placeholder="Keep effects minimal; emphasize the payoff only." />
      </label>
      <button className="w-full rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
        disabled={generating} onClick={() => void generate()} type="button">
        {generating ? 'Planning motion graphics…' : 'AI Generate Motion Graphics'}
      </button>
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
      {notice ? <p className="text-xs" role="status">{notice}</p> : null}
      {plan ? (
        <div className="space-y-2 rounded border p-2">
          <p className="text-xs font-semibold">Review {plan.graphics.length} proposed graphics</p>
          <ul className="max-h-60 space-y-1 overflow-auto">
            {plan.graphics.map(g => (
              <li key={g.id} className="rounded bg-muted/50 p-2 text-xs">
                <strong>{g.text}</strong> · {(g.startMs / 1000).toFixed(1)}–{(g.endMs / 1000).toFixed(1)}s
                <div className="text-muted-foreground">{g.rationale}</div>
              </li>
            ))}
          </ul>
          {sourceVersion != null ? <p className="text-xs text-muted-foreground">
            Generated from saved edit version {sourceVersion}. Review if you've edited the timeline since then.
          </p> : null}
          <button type="button" onClick={apply} disabled={plan.graphics.length === 0}
            className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50">
            Apply to editable timeline
          </button>
        </div>
      ) : null}
      {aiItems.length ? (
        <div className="space-y-2">
          <p className="text-xs">{aiItems.length} generated text layers in this clip.</p>
          <button type="button" className="rounded border px-3 py-2 text-xs" onClick={clearGenerated}>
            Remove generated graphics
          </button>
        </div>
      ) : null}
    </section>
  )
}
