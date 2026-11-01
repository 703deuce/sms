'use client'

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'
import { clipsFetch } from '@/lib/clips-api'
import {
  appliedCutProposals,
  auditionEditsForProposals,
  clarityProposals,
  fillerProposals,
  gapProposals,
  retakeProposals,
  type CleanupProposal,
} from '@/lib/clips/editor/cleanup-proposals'
import { deletedEditorWordIds, editorWordsForClipFillerReview } from '@/lib/clips/editor/filler-review-words'
import { maxPlausibleGapMsForTrim, sourceWordsForClipEditing } from '@/lib/clips/editor/clip-editor-word-scope'
import type { ClipGapToolSettings } from '@/components/clips/editor/clip-shorten-gaps-panel'
import { TrimRangeBar } from '@/components/clips/editor/trim-range-bar'
import { nudgeTrimIn, nudgeTrimOut } from '@/lib/clips/editor/nudge'
import type { ClipBounds } from '@/lib/clips/edits'
import { findRetakes } from '@/lib/clips/editor/retakes'
import { clipsFetch } from '@/lib/clips-api'
import { toast } from 'sonner'

export function CleanupPanel({
  clipId,
  bounds,
  edits,
  words,
  gapSettings,
  aiExtras = false,
  onApplyProposal,
  onRestoreProposal,
  onCommitTrim,
  onAuditionChange,
  onSeek,
  aiExtras = false,
}: {
  clipId: string
  bounds: ClipBounds
  edits: ClipEditsV2
  words: SourceWord[]
  gapSettings: ClipGapToolSettings
  aiExtras?: boolean
  onApplyProposal: (proposal: CleanupProposal) => void
  onRestoreProposal: (proposal: CleanupProposal) => void
  onCommitTrim: (trim: { in: number; out: number }) => void
  onAuditionChange: (edits: ClipEditsV2 | null) => void
  onSeek: (sourceMs: number) => void
  aiExtras?: boolean
}) {
  const [auditionIds, setAuditionIds] = useState<Set<string>>(new Set())
<<<<<<< HEAD
  const [retakeBusy, setRetakeBusy] = useState(false)
  const [retakeExtras, setRetakeExtras] = useState<CleanupProposal[]>([])
=======
  const [clarityRows, setClarityRows] = useState<CleanupProposal[]>([])
  const [clarityLoading, setClarityLoading] = useState(false)
  const [clarityEmpty, setClarityEmpty] = useState<string | null>(null)
>>>>>>> 163ffcf21 (feat(clips): REMAINING batch 2 — clarity cuts, translate captions, voiceover)

  const clipBounds = useMemo(
    () => ({ clipStartMs: bounds.clipStartMs, clipEndMs: bounds.clipEndMs }),
    [bounds.clipEndMs, bounds.clipStartMs],
  )
  const orderedWords = useMemo(
    () => editorWordsForClipFillerReview(clipId, words, edits, clipBounds),
    [clipId, words, edits.trim.in, edits.trim.out, edits.cutRanges, clipBounds],
  )
  const deletedSet = useMemo(
    () => deletedEditorWordIds(orderedWords, edits.cutRanges ?? []),
    [orderedWords, edits.cutRanges],
  )
  const scopedWords = useMemo(
    () => sourceWordsForClipEditing(words, edits, clipBounds),
    [words, edits, clipBounds],
  )
  const wordSpans = useMemo(
    () =>
      scopedWords.map((w) => {
        const { startMs, endMs } = wordSourceMs(w)
        return { s: startMs / 1000, e: endMs / 1000 }
      }),
    [scopedWords],
  )
  const maxPlausibleGapMs = useMemo(() => maxPlausibleGapMsForTrim(edits.trim), [edits.trim.in, edits.trim.out])

  const filler = useMemo(() => fillerProposals(orderedWords, deletedSet), [orderedWords, deletedSet])
  const gaps = useMemo(
    () =>
      gapProposals(orderedWords, edits.cutRanges ?? [], {
        mode: gapSettings.mode,
        minGapMs: Math.round(gapSettings.minGapSec * 1000),
        maxGapMs: Math.round(gapSettings.maxGapSec * 1000),
        targetGapMs: Math.round(gapSettings.targetGapSec * 1000),
        maxPlausibleGapMs,
        wordSpans,
      }),
    [orderedWords, edits.cutRanges, gapSettings, maxPlausibleGapMs, wordSpans],
  )
  const applied = useMemo(
    () => appliedCutProposals(edits, orderedWords, deletedSet),
    [edits, orderedWords, deletedSet],
  )
<<<<<<< HEAD
  const fillerGap = useMemo(() => [...filler, ...gaps], [filler, gaps])
  const proposed = useMemo(() => [...fillerGap, ...retakeExtras], [fillerGap, retakeExtras])

  const runRetakes = async () => {
    setRetakeBusy(true)
    try {
      const retakeWords = scopedWords.map((w) => {
        const { startMs, endMs } = wordSourceMs(w)
        return { w: w.w, s: startMs / 1000, e: endMs / 1000 }
      })
      let groups = findRetakes(retakeWords)
      if (!groups.length) {
        toast.message('No repeated sentences found')
        setRetakeExtras([])
        return
      }
      if (aiExtras) {
        try {
          const res = await clipsFetch<{ confirmed: boolean[] | null }>(
            `/api/clips/clips/${clipId}/retakes/verify`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                groups: groups.map((g) => ({ attempts: g.attempts.map((a) => a.text) })),
              }),
            },
          )
          if (res.confirmed?.length) {
            groups = groups.filter((_, i) => res.confirmed![i] !== false)
          }
        } catch {
          /* keep deterministic groups */
        }
      }
      const props = retakeProposals(groups, edits.cutRanges ?? [])
      setRetakeExtras(props)
      if (!props.length) toast.message('Retakes already cut or none left')
      else toast.success(`${props.length} retake cut(s) ready — review below`)
    } finally {
      setRetakeBusy(false)
    }
  }
=======
  const proposed = useMemo(() => [...filler, ...gaps, ...clarityRows], [filler, gaps, clarityRows])

  const runClarity = async () => {
    setClarityLoading(true)
    setClarityEmpty(null)
    try {
      const data = await clipsFetch<{ proposals: { startMs: number; endMs: number; reason: string }[] }>(
        `/api/clips/clips/${clipId}/clarity`,
        { method: 'POST', body: '{}' },
      )
      const props = clarityProposals(
        (data.proposals ?? []).map((p) => ({
          range: [p.startMs, p.endMs] as [number, number],
          reason: p.reason,
        })),
      )
      setClarityRows(props)
      if (!props.length) setClarityEmpty('Nothing to tighten')
    } catch {
      setClarityRows([])
      setClarityEmpty('Nothing to tighten')
    } finally {
      setClarityLoading(false)
    }
  }

  const applyAllClarity = () => {
    for (const p of clarityRows) onApplyProposal(p)
    setClarityRows([])
    setAuditionIds(new Set())
    onAuditionChange(null)
  }
>>>>>>> 163ffcf21 (feat(clips): REMAINING batch 2 — clarity cuts, translate captions, voiceover)

  const toggleAudition = (p: CleanupProposal) => {
    setAuditionIds((prev) => {
      const next = new Set(prev)
      if (next.has(p.id)) next.delete(p.id)
      else next.add(p.id)
      const selected = proposed.filter((row) => next.has(row.id))
      onAuditionChange(
        selected.length ? auditionEditsForProposals(edits, selected, wordSpans) : null,
      )
      return next
    })
    onSeek(p.range[0])
  }

  const limits = {
    clipStartMs: bounds.clipStartMs,
    clipEndMs: bounds.clipEndMs,
    trimMinMs: bounds.trimMinMs,
    trimMaxMs: bounds.trimMaxMs,
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      <TrimRangeBar bounds={bounds} trim={edits.trim} onCommitTrim={onCommitTrim} />
      {edits.trim.in !== bounds.clipStartMs || edits.trim.out !== bounds.clipEndMs ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          data-testid="reset-ai-cut"
          onClick={() => onCommitTrim({ in: bounds.clipStartMs, out: bounds.clipEndMs })}
        >
          Reset to AI cut
        </Button>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onCommitTrim(nudgeTrimIn(edits.trim, -100, limits))}>
          Nudge in −100ms
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onCommitTrim(nudgeTrimIn(edits.trim, 100, limits))}>
          Nudge in +100ms
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onCommitTrim(nudgeTrimOut(edits.trim, -100, limits))}>
          Nudge out −100ms
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onCommitTrim(nudgeTrimOut(edits.trim, 100, limits))}>
          Nudge out +100ms
        </Button>
      </div>

      {aiExtras ? (
<<<<<<< HEAD
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={retakeBusy}
          data-testid="retake-run"
          onClick={() => void runRetakes()}
        >
          Remove retakes
        </Button>
=======
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="clarity-run"
            disabled={clarityLoading}
            onClick={() => void runClarity()}
          >
            {clarityLoading ? <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden /> : null}
            Edit for clarity
          </Button>
          {clarityRows.length ? (
            <Button type="button" size="sm" onClick={applyAllClarity}>
              Apply all clarity
            </Button>
          ) : null}
          {clarityEmpty ? <span className="text-xs text-muted-foreground">{clarityEmpty}</span> : null}
        </div>
>>>>>>> 163ffcf21 (feat(clips): REMAINING batch 2 — clarity cuts, translate captions, voiceover)
      ) : null}

      <Tabs defaultValue="proposed">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="proposed">Proposed ({proposed.length})</TabsTrigger>
          <TabsTrigger value="applied">Applied ({applied.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="proposed" className="mt-3 space-y-2">
          {proposed.length === 0 ? (
            <p className="text-xs text-muted-foreground">No cleanup suggestions right now.</p>
          ) : (
            proposed.map((p) => (
              <ProposalRow
                key={p.id}
                proposal={p}
                auditioning={auditionIds.has(p.id)}
                onAudition={() => toggleAudition(p)}
                onApply={() => {
                  onApplyProposal(p)
                  setRetakeExtras((rows) => rows.filter((r) => r.id !== p.id))
                  setAuditionIds((s) => {
                    const n = new Set(s)
                    n.delete(p.id)
                    onAuditionChange(null)
                    return n
                  })
                  if (p.kind === 'clarity') setClarityRows((rows) => rows.filter((r) => r.id !== p.id))
                }}
                testId={p.kind === 'clarity' ? 'clarity-proposal' : undefined}
              />
            ))
          )}
        </TabsContent>
        <TabsContent value="applied" className="mt-3 space-y-2">
          {applied.length === 0 ? (
            <p className="text-xs text-muted-foreground">No cuts applied yet.</p>
          ) : (
            applied.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
                <span>
                  {p.label} · {p.kind}
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={() => onRestoreProposal(p)}>
                  Restore
                </Button>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ProposalRow({
  proposal,
  auditioning,
  onAudition,
  onApply,
  testId,
}: {
  proposal: CleanupProposal
  auditioning: boolean
  onAudition: () => void
  onApply: () => void
  testId?: string
}) {
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
      data-testid={testId}
    >
      <span>
        {proposal.label} · {proposal.kind}
      </span>
      <div className="flex gap-1">
        <Button type="button" size="sm" variant={auditioning ? 'default' : 'outline'} onClick={onAudition}>
          Audition
        </Button>
        <Button type="button" size="sm" onClick={onApply}>
          Apply
        </Button>
      </div>
    </div>
  )
}
