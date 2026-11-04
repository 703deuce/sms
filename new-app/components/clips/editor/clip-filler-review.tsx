'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ScriptFillerReviewBar,
  type FillerReviewAction,
  type FillerSearchOptions,
} from '@/components/script-editor/script-filler-review-bar'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { listFillerHits, type FillerFilter } from '@/lib/clips/script-editor/filler-hits'
import {
  deletedEditorWordIds,
  editorWordsForClipFillerReview,
} from '@/lib/clips/editor/filler-review-words'
import {
  proposalId,
  type CleanupProposal,
} from '@/lib/clips/editor/cleanup-proposals'
import { toast } from 'sonner'

const DEFAULT_SEARCH_OPTIONS: FillerSearchOptions = {
  autoAdvance: true,
  previewResults: true,
  matchWholeWords: false,
  matchCase: false,
  wrapAround: true,
  onlyCurrentComposition: false,
}

export function ClipFillerReview({
  clipId,
  words,
  edits,
  open,
  onOpenChange,
  onApplyProposal,
  onSeek,
  clipBounds,
}: {
  clipId: string
  words: SourceWord[]
  edits: ClipEditsV2
  clipBounds?: { clipStartMs: number; clipEndMs: number }
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplyProposal: (proposal: CleanupProposal) => void
  onSeek: (sourceMs: number) => void
}) {
  const [fillerCursor, setFillerCursor] = useState(0)
  const [fillerFilter, setFillerFilter] = useState<FillerFilter>('all')
  const [fillerSelectionOnly, setFillerSelectionOnly] = useState(false)
  const [fillerAvoidHarsh, setFillerAvoidHarsh] = useState(false)
  const [fillerAction, setFillerAction] = useState<FillerReviewAction>('delete')
  const [searchOptions, setSearchOptions] = useState<FillerSearchOptions>(DEFAULT_SEARCH_OPTIONS)
  const lastPreviewedCursor = useRef<number | null>(null)

  const orderedWords = useMemo(
    () => editorWordsForClipFillerReview(clipId, words, edits, clipBounds),
    [clipId, words, edits.trim.in, edits.trim.out, edits.cutRanges, clipBounds],
  )
  const cutRanges = edits.cutRanges ?? []
  const deletedSet = useMemo(
    () => deletedEditorWordIds(orderedWords, cutRanges, edits),
    [orderedWords, cutRanges, edits],
  )

  const fillerHits = useMemo(
    () =>
      listFillerHits(orderedWords, deletedSet, {
        filter: fillerFilter,
        selectionOnly: fillerSelectionOnly,
        avoidHarshCuts: fillerAvoidHarsh,
      }),
    [orderedWords, deletedSet, fillerFilter, fillerSelectionOnly, fillerAvoidHarsh],
  )

  useEffect(() => {
    if (fillerCursor >= fillerHits.length) setFillerCursor(Math.max(0, fillerHits.length - 1))
  }, [fillerCursor, fillerHits.length])

  useEffect(() => {
    if (!open) {
      lastPreviewedCursor.current = null
      return
    }
    // Undo and caption updates may recalculate hits: do not keep rewinding live playback.
    if (lastPreviewedCursor.current === fillerCursor) return
    lastPreviewedCursor.current = fillerCursor
    const hit = fillerHits[fillerCursor]
    if (hit) onSeek(hit.word.t0Ms)
  }, [open, fillerCursor, fillerHits, onSeek])

  useEffect(() => {
    if (!open) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onOpenChange(false)
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [open, onOpenChange])

  const applyHits = useCallback(
    (action: FillerReviewAction, hits: { word: { t0Ms: number; t1Ms: number } }[]) => {
      if (!hits.length) return
      if (action === 'delete') {
        for (const h of hits) {
          const range: [number, number] = [h.word.t0Ms, h.word.t1Ms]
          onApplyProposal({
            id: proposalId(range),
            kind: 'filler',
            range,
            label: h.word.text.trim() || 'filler',
          })
        }
        toast.success(`Removed ${hits.length} filler word(s). Undo`)
        return
      }
      if (action === 'ignore') {
        toast.message('Skipped')
        return
      }
      toast.message('Only delete is supported in clip editor')
    },
    [onApplyProposal],
  )

  const onSkipOne = useCallback(() => {
    if (!fillerHits.length) return
    setFillerCursor((c) => (c >= fillerHits.length - 1 ? 0 : c + 1))
  }, [fillerHits.length])

  const onRemoveOne = useCallback(() => {
    const hit = fillerHits[fillerCursor]
    if (!hit) return
    applyHits('delete', [hit])
    if (searchOptions.autoAdvance) setFillerCursor((c) => Math.min(c, Math.max(0, fillerHits.length - 2)))
  }, [applyHits, fillerCursor, fillerHits, searchOptions.autoAdvance])

  const onRemoveAll = useCallback(() => {
    applyHits('delete', fillerHits)
    onOpenChange(false)
  }, [applyHits, fillerHits, onOpenChange])

  if (!open) return null

  return (
    <ScriptFillerReviewBar
      variant="clip"
      mode="filler"
      searchMode="filler"
      onSearchModeChange={() => {}}
      onSkipOne={onSkipOne}
      searchQuery=""
      onSearchQueryChange={() => {}}
      searchOptions={searchOptions}
      onSearchOptionsChange={(patch) => setSearchOptions((o) => ({ ...o, ...patch }))}
      total={fillerHits.length}
      cursor={fillerCursor}
      filter={fillerFilter}
      action={fillerAction}
      onActionChange={setFillerAction}
      onFilterChange={setFillerFilter}
      selectionOnly={fillerSelectionOnly}
      onSelectionOnlyChange={setFillerSelectionOnly}
      avoidHarshCuts={fillerAvoidHarsh}
      onAvoidHarshCutsChange={setFillerAvoidHarsh}
      targetGapSec={0.5}
      onTargetGapSecChange={() => {}}
      onPrev={() => setFillerCursor((c) => (c <= 0 ? fillerHits.length - 1 : c - 1))}
      onNext={() => setFillerCursor((c) => (c >= fillerHits.length - 1 ? 0 : c + 1))}
      onRemoveOne={onRemoveOne}
      onRemoveAll={onRemoveAll}
      onClose={() => onOpenChange(false)}
    />
  )
}
