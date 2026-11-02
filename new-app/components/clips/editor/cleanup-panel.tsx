'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'
import { clipsFetch, getProjectStatus, retranscribeProject } from '@/lib/clips-api'
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
import { findRetakes, retakeGroupWithKeepIndex, type RetakeGroup } from '@/lib/clips/editor/retakes'
import { cleanupPassLabel, cleanupRestorePassLabel } from '@/lib/clips/editor/history-labels'
import { orderedKeepSegments, remapTime } from '@/lib/clips/edits'
import { formatTimecode } from '@/lib/clips/format'
import { excerptPartsForCutRange } from '@/lib/clips/editor/cleanup-text'
import {
  DEFAULT_CLEANUP_STRENGTH,
  OPT_IN_FILLER_WORDS,
  type CleanupStrength,
} from '@/lib/clips/editor/cleanup-strength'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { useAudioPeaks } from '@/components/clips/editor/use-audio-peaks'
import { rmsSamplesFromPeaks } from '@/lib/clips/gap-audio-trim'
import {
  cleanupPassConfirmMessage,
  cleanupPassNeedsConfirm,
  mergedCutRemovalMs,
} from '@/lib/clips/gap-audio-trim'
import { FreeToolBadge } from '@/components/clips/ui/free-tool-badge'
import { AiCreditBadge } from '@/components/clips/ui/ai-credit-badge'

export function CleanupPanel({
  clipId,
  projectId,
  bounds,
  edits,
  words,
  gapSettings,
  aiExtras = false,
  videoUrl = null,
  peaksUrl = null,
  onApplyProposal,
  onApplyPass,
  onRestoreProposal,
  onRestorePass,
  onCommitTrim,
  onAuditionChange,
  onSeek,
  onReloadWords,
}: {
  clipId: string
  projectId: string
  bounds: ClipBounds
  edits: ClipEditsV2
  words: SourceWord[]
  gapSettings: ClipGapToolSettings
  aiExtras?: boolean
  videoUrl?: string | null
  peaksUrl?: string | null
  onApplyProposal: (proposal: CleanupProposal) => void
  onApplyPass?: (proposals: CleanupProposal[], label: string) => void
  onRestoreProposal: (proposal: CleanupProposal) => void
  onRestorePass?: (proposals: CleanupProposal[], label: string) => void
  onCommitTrim: (trim: { in: number; out: number }) => void
  onAuditionChange: (edits: ClipEditsV2 | null) => void
  onSeek: (sourceMs: number) => void
  /** Refetch clip transcript after re-transcribe completes. */
  onReloadWords?: () => Promise<void> | void
}) {
  const [auditionIds, setAuditionIds] = useState<Set<string>>(new Set())
  const [retakeBusy, setRetakeBusy] = useState(false)
  const [retakeExtras, setRetakeExtras] = useState<CleanupProposal[]>([])
  const [retakeGroups, setRetakeGroups] = useState<RetakeGroup[]>([])
  const [retakeUnverified, setRetakeUnverified] = useState(false)
  const [clarityRows, setClarityRows] = useState<CleanupProposal[]>([])
  const [clarityLoading, setClarityLoading] = useState(false)
  const [clarityEmpty, setClarityEmpty] = useState<string | null>(null)
  const [strength, setStrength] = useState<CleanupStrength>(DEFAULT_CLEANUP_STRENGTH)
  const [enabledOptIn, setEnabledOptIn] = useState<Set<string>>(new Set())
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
  const [retranscribeBusy, setRetranscribeBusy] = useState(false)

  const clipBounds = useMemo(
    () => ({ clipStartMs: bounds.clipStartMs, clipEndMs: bounds.clipEndMs }),
    [bounds.clipEndMs, bounds.clipStartMs],
  )
  const orderedWords = useMemo(
    () => editorWordsForClipFillerReview(clipId, words, edits, clipBounds),
    [clipId, words, edits.trim.in, edits.trim.out, edits.cutRanges, clipBounds],
  )
  const deletedSet = useMemo(
    () => deletedEditorWordIds(orderedWords, edits.cutRanges ?? [], edits),
    [orderedWords, edits.cutRanges, edits.trim, edits.sectionOrder],
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

  const audioPeaks = useAudioPeaks(videoUrl, 40, 12_000, { peaksUrl, skipDecode: !videoUrl && !peaksUrl })
  const rmsSamples = useMemo(
    () => (audioPeaks.peaks.length ? rmsSamplesFromPeaks(audioPeaks.peaks, audioPeaks.peaksPerSec) : []),
    [audioPeaks.peaks, audioPeaks.peaksPerSec],
  )

  const filler = useMemo(
    () => fillerProposals(orderedWords, deletedSet, { strength, enabledOptInFillers: enabledOptIn }),
    [orderedWords, deletedSet, strength, enabledOptIn],
  )
  const gaps = useMemo(
    () =>
      gapProposals(orderedWords, edits.cutRanges ?? [], {
        mode: gapSettings.mode,
        minGapMs: Math.round(gapSettings.minGapSec * 1000),
        maxGapMs: Math.round(gapSettings.maxGapSec * 1000),
        targetGapMs: Math.round(gapSettings.targetGapSec * 1000),
        maxPlausibleGapMs,
        wordSpans,
        strength,
        rmsSamples,
      }),
    [orderedWords, edits.cutRanges, gapSettings, maxPlausibleGapMs, wordSpans, strength, rmsSamples],
  )
  const applied = useMemo(
    () => appliedCutProposals(edits, orderedWords, deletedSet),
    [edits, orderedWords, deletedSet],
  )
  const proposed = useMemo(
    () => [...filler, ...gaps, ...retakeExtras, ...clarityRows].filter((p) => !skippedIds.has(p.id)),
    [filler, gaps, retakeExtras, clarityRows, skippedIds],
  )

  const previewCutAudition = (p: CleanupProposal) => {
    onSeek(Math.max(bounds.clipStartMs, p.range[0] - 1000))
    onAuditionChange(auditionEditsForProposals(edits, [p], wordSpans))
  }

  const applyAllFillers = () => {
    const rows = proposed.filter((row) => row.kind === 'filler' || row.kind === 'repeat')
    if (!rows.length) return
    if (onApplyPass) onApplyPass(rows, cleanupPassLabel('filler', rows.length))
    else for (const p of rows) onApplyProposal(p)
    setSkippedIds(new Set())
    setAuditionIds(new Set())
    onAuditionChange(null)
  }

  const applyAllOfKind = (kind: CleanupProposal['kind']) => {
    const rows = proposed.filter((row) => row.kind === kind)
    if (!rows.length) return
    if (kind === 'gap') {
      const sourceDur = Math.max(1, bounds.trimMaxMs - bounds.trimMinMs)
      const removed = mergedCutRemovalMs(
        rows.map((r) => r.range),
        bounds.trimMinMs,
        bounds.trimMaxMs,
      )
      if (cleanupPassNeedsConfirm(removed, sourceDur)) {
        const ok = window.confirm(cleanupPassConfirmMessage(removed, sourceDur))
        if (!ok) return
      }
    }
    if (onApplyPass) onApplyPass(rows, cleanupPassLabel(kind, rows.length))
    else for (const p of rows) onApplyProposal(p)
    if (kind === 'filler' || kind === 'gap') setSkippedIds(new Set())
    if (kind === 'clarity') setClarityRows([])
    if (kind === 'retake') setRetakeExtras([])
    setAuditionIds(new Set())
    onAuditionChange(null)
  }

  const restoreAllOfKind = (kind: CleanupProposal['kind']) => {
    const rows = applied.filter((row) => row.kind === kind)
    if (!rows.length) return
    const label = cleanupRestorePassLabel(kind, rows.length)
    if (onRestorePass) onRestorePass(rows, label)
    else for (const p of rows) onRestoreProposal(p)
  }

  const proposalOutputMs = (p: CleanupProposal) => {
    const segs = orderedKeepSegments(edits)
    return remapTime(p.range[0], segs) ?? Math.max(0, p.range[0] - bounds.clipStartMs)
  }

  const seekToProposal = (p: CleanupProposal) => {
    onSeek(Math.max(bounds.clipStartMs, p.range[0]))
  }

  const proposedFillers = useMemo(
    () => proposed.filter((row) => row.kind === 'filler' || row.kind === 'repeat'),
    [proposed],
  )
  const proposedGaps = useMemo(() => proposed.filter((row) => row.kind === 'gap'), [proposed])

  const retakeRemovalMs = useMemo(() => {
    return retakeProposals(retakeGroups, edits.cutRanges ?? []).reduce(
      (sum, p) => sum + Math.abs(p.range[1] - p.range[0]),
      0,
    )
  }, [retakeGroups, edits.cutRanges])

  const runRetakes = async () => {
    setRetakeBusy(true)
    try {
      const retakeWords = scopedWords.map((w) => {
        const { startMs, endMs } = wordSourceMs(w)
        return { w: w.w, s: startMs / 1000, e: endMs / 1000 }
      })
      let groups = findRetakes(retakeWords, edits.cutRanges ?? [])
      if (!groups.length) {
        toast.message('No retakes found')
        setRetakeExtras([])
        setRetakeGroups([])
        setRetakeUnverified(false)
        return
      }
      setRetakeUnverified(false)
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
          if (res.confirmed === null) {
            setRetakeUnverified(true)
          } else if (res.confirmed.length) {
            groups = groups.filter((_, i) => res.confirmed![i] !== false)
          }
        } catch {
          setRetakeUnverified(true)
        }
      }
      const props = retakeProposals(groups, edits.cutRanges ?? [])
      setRetakeGroups(groups)
      setRetakeExtras(props)
      if (!props.length) toast.message('No retakes found')
      else toast.success(`${props.length} retake cut(s) ready — review below`)
    } finally {
      setRetakeBusy(false)
    }
  }

  useEffect(() => {
    if (!retakeGroups.length) return
    setRetakeExtras(retakeProposals(retakeGroups, edits.cutRanges ?? []))
  }, [edits.cutRanges, retakeGroups])

  const pollRetranscribeUntilReady = async () => {
    const deadline = Date.now() + 15 * 60 * 1000
    while (Date.now() < deadline) {
      await new Promise((r) => window.setTimeout(r, 4000))
      try {
        const st = await getProjectStatus(projectId)
        if (st.status === 'READY' && st.wordCount > 0) {
          await onReloadWords?.()
          toast.success('Re-transcribe complete — transcript updated.')
          return
        }
        if (st.status === 'FAILED') {
          toast.error(st.error ?? 'Re-transcribe failed')
          return
        }
      } catch {
        /* keep polling */
      }
    }
    toast.message('Re-transcribe still running — we will keep your page open; try Refresh if words look stale.')
  }

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
        orderedWords,
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
    applyAllOfKind('clarity')
  }

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
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Cleanup</h3>
      </div>

      <div
        className="sticky top-0 z-10 -mx-3 flex flex-wrap gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        data-testid="cleanup-bulk-actions"
      >
        {proposedFillers.length ? (
          <Button type="button" size="sm" variant="secondary" onClick={applyAllFillers}>
            Accept all fillers
            <FreeToolBadge className="ml-1.5" />
          </Button>
        ) : null}
        {proposedGaps.length ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => applyAllOfKind('gap')}>
            Accept all gaps
            <FreeToolBadge className="ml-1.5" />
          </Button>
        ) : null}
        {retakeExtras.length && !retakeUnverified ? (
          <Button type="button" size="sm" data-testid="retake-apply-all-sticky" onClick={() => applyAllOfKind('retake')}>
            Apply all retakes
          </Button>
        ) : null}
        {clarityRows.length ? (
          <Button type="button" size="sm" data-testid="clarity-apply-all-sticky" onClick={applyAllClarity}>
            Apply all clarity
          </Button>
        ) : null}
      </div>

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

      <div className="space-y-2 rounded-md border border-border p-2">
        <Label className="text-xs">Cleanup strength</Label>
        <div className="flex flex-wrap gap-2">
          {(['light', 'normal', 'aggressive'] as const).map((level) => (
            <Button
              key={level}
              type="button"
              size="sm"
              variant={strength === level ? 'default' : 'outline'}
              data-testid={`cleanup-strength-${level}`}
              onClick={() => setStrength(level)}
            >
              {level[0].toUpperCase() + level.slice(1)}
            </Button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">Opt-in fillers (never cut unless checked):</p>
        <div className="flex flex-wrap gap-3">
          {OPT_IN_FILLER_WORDS.map((word) => (
            <label key={word} className="flex items-center gap-1 text-[10px]">
              <Checkbox
                checked={enabledOptIn.has(word)}
                onCheckedChange={(on) => {
                  setEnabledOptIn((prev) => {
                    const next = new Set(prev)
                    if (on) next.add(word)
                    else next.delete(word)
                    return next
                  })
                }}
              />
              {word}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border p-2 text-xs text-muted-foreground">
        <p className="mb-2">Missing um/uh in the script? Re-run ASR with disfluencies preserved (Deepgram filler_words).</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={retranscribeBusy}
          data-testid="retranscribe-verbatim"
          onClick={() => {
            setRetranscribeBusy(true)
            void retranscribeProject(projectId)
              .then(() => {
                toast.message('Re-transcribe queued — updating when ready…')
                return pollRetranscribeUntilReady()
              })
              .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not queue re-transcribe'))
              .finally(() => setRetranscribeBusy(false))
          }}
        >
          {retranscribeBusy ? <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden /> : null}
          Re-transcribe (verbatim)
        </Button>
      </div>

      <div className="space-y-2 rounded-md border border-border p-2" data-testid="cleanup-ai-tools">
        <p className="text-xs font-medium">More cleanup</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={retakeBusy}
            data-testid="retake-run"
            onClick={() => void runRetakes()}
          >
            Remove retakes
            <FreeToolBadge className="ml-1.5" />
          </Button>
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
            <span className="ml-1.5 inline-flex">
              <AiCreditBadge credits={2} />
            </span>
          </Button>
          {clarityRows.length ? (
            <Button type="button" size="sm" data-testid="clarity-apply-all" onClick={applyAllClarity}>
              Apply all clarity
            </Button>
          ) : null}
          {clarityEmpty ? <span className="text-xs text-muted-foreground">{clarityEmpty}</span> : null}
        </div>
      </div>

      {retakeGroups.length ? (
        <div className="space-y-2 rounded-md border border-border p-2" data-testid="retake-review">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium">Retake groups</p>
              {retakeRemovalMs > 0 ? (
                <p className="text-[11px] text-muted-foreground" data-testid="retake-total-removal">
                  Would remove {formatTimecode(retakeRemovalMs)} total
                </p>
              ) : null}
            </div>
            {retakeUnverified ? (
              <span className="text-xs text-amber-600 dark:text-amber-400" data-testid="retake-unverified">
                Unverified — review each take before applying
              </span>
            ) : null}
          </div>
          {retakeGroups.map((group, gi) => {
            const groupProposal = retakeProposals([group], edits.cutRanges ?? [])[0]
            return (
            <div key={gi} className="space-y-1 rounded bg-muted/40 p-2 text-xs">
              {groupProposal ? (
                <div className="flex items-center gap-2 pb-1">
                  <span
                    className="rounded bg-muted px-1.5 py-0.5 font-mono tabular-nums text-[10px]"
                    data-testid="retake-cut-range"
                  >
                    {formatTimecode(groupProposal.range[0])}–{formatTimecode(groupProposal.range[1])}
                  </span>
                </div>
              ) : null}
              {group.attempts.map((a, ai) => (
                <div key={ai} className="flex items-center justify-between gap-2">
                  <span className={ai === group.keepIndex ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                    {ai === group.keepIndex ? 'Keep · ' : ''}
                    {a.text.slice(0, 80)}
                    {a.text.length > 80 ? '…' : ''}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => onSeek(a.startMs)}>
                      Play
                    </Button>
                    {ai !== group.keepIndex ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const next = retakeGroupWithKeepIndex(group, ai)
                          setRetakeGroups((rows) => rows.map((g, ix) => (ix === gi ? next : g)))
                        }}
                      >
                        Keep this take
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              {groupProposal ? (
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    size="sm"
                    data-testid="retake-apply-group"
                    onClick={() => onApplyProposal(groupProposal)}
                  >
                    Apply
                  </Button>
                </div>
              ) : null}
            </div>
          )})}
        </div>
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
                outputTimeMs={proposalOutputMs(p)}
                orderedWords={orderedWords}
                auditioning={auditionIds.has(p.id)}
                onSeekMain={() => seekToProposal(p)}
                onAudition={() => toggleAudition(p)}
                onPreview={() => previewCutAudition(p)}
                onSkip={() => setSkippedIds((s) => new Set(s).add(p.id))}
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
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-90"
                  onClick={() => seekToProposal(p)}
                >
                  <span
                    className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono tabular-nums text-[10px] text-foreground"
                    data-testid="cleanup-applied-time"
                  >
                    {formatTimecode(proposalOutputMs(p))}
                  </span>
                  <span className="line-clamp-2">
                    {p.label} · {p.kind}
                  </span>
                </button>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => onRestoreProposal(p)}>
                    Restore
                  </Button>
                </div>
              </div>
            ))
          )}
          {applied.some((p) => p.kind === 'filler' || p.kind === 'repeat' || p.kind === 'gap' || p.kind === 'retake' || p.kind === 'clarity') ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {applied.some((p) => p.kind === 'filler') ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="cleanup-restore-fillers"
                  onClick={() => restoreAllOfKind('filler')}
                >
                  Restore fillers
                </Button>
              ) : null}
              {applied.some((p) => p.kind === 'repeat') ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="cleanup-restore-repeats"
                  onClick={() => restoreAllOfKind('repeat')}
                >
                  Restore repeats
                </Button>
              ) : null}
              {applied.some((p) => p.kind === 'gap') ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="cleanup-restore-gaps"
                  onClick={() => restoreAllOfKind('gap')}
                >
                  Restore gaps
                </Button>
              ) : null}
              {applied.some((p) => p.kind === 'retake') ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="cleanup-restore-retakes"
                  onClick={() => restoreAllOfKind('retake')}
                >
                  Restore retakes
                </Button>
              ) : null}
              {applied.some((p) => p.kind === 'clarity') ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="cleanup-restore-clarity"
                  onClick={() => restoreAllOfKind('clarity')}
                >
                  Restore clarity
                </Button>
              ) : null}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ProposalRow({
  proposal,
  outputTimeMs,
  orderedWords,
  auditioning,
  onSeekMain,
  onAudition,
  onPreview,
  onSkip,
  onApply,
  testId,
}: {
  proposal: CleanupProposal
  outputTimeMs: number
  orderedWords: ReturnType<typeof editorWordsForClipFillerReview>
  auditioning: boolean
  onSeekMain: () => void
  onAudition: () => void
  onPreview: () => void
  onSkip: () => void
  onApply: () => void
  testId?: string
}) {
  const clarityParts =
    proposal.kind === 'clarity' ? excerptPartsForCutRange(orderedWords, proposal.range) : null
  const clarityReason = proposal.kind === 'clarity' ? proposal.label.replace(/^Clarity · /, '').split(' — ')[0] : null

  return (
    <div
      className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
      data-testid={testId}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-2 text-left hover:opacity-90"
        onClick={onSeekMain}
      >
        <span
          className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono tabular-nums text-[10px] text-foreground"
          data-testid="cleanup-proposal-time"
        >
          {formatTimecode(outputTimeMs)}
        </span>
        <span className="line-clamp-3 min-w-0 flex-1">
        {proposal.kind === 'clarity' && clarityParts ? (
          <>
            <span className="font-medium">Clarity · {clarityReason}</span>
            <span className="text-muted-foreground">
              {clarityParts.before ? ` …${clarityParts.before} ` : ' '}
              <span className="line-through decoration-destructive/80">{clarityParts.removed}</span>
              {clarityParts.after ? ` ${clarityParts.after}…` : null}
            </span>
          </>
        ) : (
          <>
            {proposal.label}
            {proposal.kind !== 'clarity' ? ` · ${proposal.kind}` : ''}
          </>
        )}
      </span>
      </button>
      <div className="flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="outline" onClick={onPreview} data-testid="cleanup-preview-cut">
          Preview 2s
        </Button>
        <Button type="button" size="sm" variant={auditioning ? 'default' : 'outline'} onClick={onAudition}>
          Audition
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onSkip}>
          Skip
        </Button>
        <Button type="button" size="sm" onClick={onApply}>
          Apply
        </Button>
      </div>
    </div>
  )
}
