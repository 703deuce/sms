'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Scissors, Search, Undo2, User, EyeOff, RotateCcw, Pencil, MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ClipEditsV2, CutRange } from '@/lib/clips/edits'
import { FILLER_RE, isWordCut, normalizeSectionOrder, wordDisplayText } from '@/lib/clips/edits'
import { moveSelection, sectionBlocksForEdits } from '@/lib/clips/editor/reorder'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { multicamAngles, setAngleForSourceSpan, sourceSpanFromTranscriptSelection } from '@/lib/clips/editor/multicam-manual'
import type { ClipMediaSource } from '@/lib/clips/editor/sources'
import { logEditorDecision } from '@/lib/clips/editor-decision-log'
import { SHOW_SURROUNDING_CONTEXT_MS } from '@/lib/clips/trim-bounds'
import { toast } from 'sonner'
import { gapCutBetweenSourceWords } from '@/lib/clips/gap-shorten'
import type { SourceWord } from '@/lib/clips/source-words'
import { maxPlausibleGapMsForTrim, sourceWordsForClipEditing } from '@/lib/clips/editor/clip-editor-word-scope'
import { wordSourceMs } from '@/lib/clips/source-words'
import { speakerLabelForWord } from '@/lib/clips/crop-shots'
import { findMatches, replacementFixes } from '@/lib/clips/editor/find-replace'
import {
  activeWordAt,
  collapseCutRuns,
  isWordIgnored,
  nextIgnoreState,
  paragraphStarts,
  selectionHasCuts,
  setSpeakerName,
  setWordsIgnored,
  speakerDisplayName,
} from '@/lib/clips/editor/transcript-edit'
import { clipsFetch } from '@/lib/clips-api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { VocabEntry } from '@/lib/clips/clip-export-user-types'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import type { VisualMomentRow } from '@/lib/clips/editor/highlights'

export type TranscriptSelection = {
  startMs: number
  endMs: number
  clear: () => void
}

const SPEAKER_DOT = ['bg-[#FFD400]', 'bg-[#22C55E]', 'bg-sky-500', 'bg-violet-500']

function speakerOrder(visible: SourceWord[], shots: CropShot[]) {
  const order: string[] = []
  for (const w of visible) {
    const { midMs } = wordSourceMs(w)
    const spk = speakerLabelForWord(shots, midMs)
    if (!order.includes(spk)) order.push(spk)
  }
  return order
}

export function TranscriptPanel({
  words,
  wordsLoading = false,
  shots,
  edits,
  onSeek,
  onAddCut,
  onWordFix,
  onRestoreWord,
  onExtendTrim,
  onToggleEmphasis,
  onRestoreCutRange,
  onSaveAsNewClip,
  selectionRef,
  clipStartMs,
  clipEndMs,
  applyWordFixesBatch,
  panelActive = true,
  onPatchSectionOrder,
  mediaKind,
  onSetEdits,
  angleSources,
  onBuildFromTranscript,
  playheadSourceMs,
  showSurrounding = false,
  onShowSurroundingChange,
  highlightWordIdx,
  momentRows,
  onSelectRange,
  compactToolbar = false,
  largeScript = false,
}: {
  words: SourceWord[]
  wordsLoading?: boolean
  clipStartMs?: number
  clipEndMs?: number
  shots: CropShot[]
  edits: ClipEditsV2
  onSeek: (sourceMs: number) => void
  onAddCut: (range: [number, number]) => void
  onWordFix: (index: number, text: string, meta?: { s: number; w: string }) => void
  onRestoreWord: (word: SourceWord) => void
  onExtendTrim: (sourceMs: number) => void
  onToggleEmphasis?: (wordIndex: number) => void
  onRestoreCutRange?: (range: CutRange) => void
  onSaveAsNewClip?: (trimIn: number, trimOut: number, title?: string) => void | Promise<void>
  selectionRef: React.MutableRefObject<TranscriptSelection | null>
  applyWordFixesBatch?: (
    fixes: Record<string, string>,
    meta: Record<string, { s: number; w: string }>,
  ) => void
  panelActive?: boolean
  onPatchSectionOrder?: (order: CutRange[] | undefined) => void
  mediaKind?: string
  /** G1b2: commit edits (camera angle per selected sentence / word range). */
  onSetEdits?: (next: ClipEditsV2) => void
  angleSources?: readonly ClipMediaSource[]
  /** FV4e: open the Media panel's source monitor ("Build from transcript" of an uploaded file). */
  onBuildFromTranscript?: () => void
  /** TB-15: source-ms playhead for the active word. */
  playheadSourceMs?: number
  showSurrounding?: boolean
  onShowSurroundingChange?: (on: boolean) => void
  highlightWordIdx?: Set<number>
  momentRows?: VisualMomentRow[]
  onSelectRange?: (startMs: number, endMs: number) => void
  /** Phase 2b: single-row find + overflow menu; transcript fills panel height. */
  compactToolbar?: boolean
  /** Phase 3 script view: larger transcript typography in the main split. */
  largeScript?: boolean
}) {
  const [selStart, setSelStart] = useState<number | null>(null)
  const [selEnd, setSelEnd] = useState<number | null>(null)
  const [editingI, setEditingI] = useState<number | null>(null)
  const wordFixCommittedRef = useRef(false)
  const [search, setSearch] = useState('')
  const [replace, setReplace] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const [addToVocab, setAddToVocab] = useState(false)
  const findInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pauseFollowUntil = useRef(0)
  const [follow, setFollow] = useState(true)
  const [showDeleted, setShowDeleted] = useState(true)
  const [renamingSpk, setRenamingSpk] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const ctxRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    try {
      setFollow(localStorage.getItem('transovo.script.follow') !== '0')
      setShowDeleted(localStorage.getItem('transovo.script.showDeleted') !== '0')
    } catch {
      /* private mode */
    }
  }, [])
  const persist = (k: string, v: boolean) => {
    try {
      localStorage.setItem(k, v ? '1' : '0')
    } catch {
      /* private mode */
    }
  }
  const bumpFollowPause = () => {
    pauseFollowUntil.current = Date.now() + 3000
  }
  const visible = useMemo(() => {
    if (!words.length) return []
    const bounds =
      clipStartMs != null && clipEndMs != null ? { clipStartMs, clipEndMs } : undefined
    const core = sourceWordsForClipEditing(words, edits, bounds)
    const pad = showSurrounding ? SHOW_SURROUNDING_CONTEXT_MS : 2000
    const viewMin = edits.trim.in - pad
    const viewMax = edits.trim.out + pad
    const extended = words.filter((w) => w.e * 1000 >= viewMin && w.s * 1000 <= viewMax)
    if (!core.length) return extended.length ? extended : words
    const coreIds = new Set(core.map((w) => w.i))
    const merged = [...core]
    for (const w of extended) {
      if (!coreIds.has(w.i)) merged.push(w)
    }
    merged.sort((a, b) => a.s - b.s || a.i - b.i)
    return merged
  }, [words, edits.trim.in, edits.trim.out, clipStartMs, clipEndMs, showSurrounding])
  const spkOrder = useMemo(() => speakerOrder(visible, shots), [visible, shots])
  const maxPlausibleGapMs = useMemo(() => maxPlausibleGapMsForTrim(edits.trim), [edits.trim.in, edits.trim.out])
  const reorderActive = Boolean(
    normalizeSectionOrder(edits.sectionOrder, edits.trim.in, edits.trim.out),
  )
  const outputBlocks = useMemo(
    () => sectionBlocksForEdits(edits),
    [edits.sectionOrder, edits.trim.in, edits.trim.out],
  )
  const wordSpans = useMemo(
    () =>
      visible.map((w) => {
        const { startMs, endMs } = wordSourceMs(w)
        return { startMs, endMs }
      }),
    [visible],
  )
  const activeI = useMemo(() => activeWordAt(visible, playheadSourceMs), [visible, playheadSourceMs])

  const moveSection = (dir: 'up' | 'down') => {
    if (selStart === null || selEnd === null) return
    const next = moveSelection(edits, [selStart, selEnd], dir, wordSpans)
    if (!next?.length) {
      toast.message('Select within one section')
      return
    }
    onPatchSectionOrder?.(next)
    logEditorDecision('reorder', { dir, blocks: next.length })
  }

  const phraseMatches = useMemo(
    () => (search.trim() ? findMatches(visible, edits, search) : []),
    [visible, edits, search],
  )
  const safeMatchIndex = phraseMatches.length ? matchIndex % phraseMatches.length : 0
  const activeMatch = phraseMatches[safeMatchIndex]

  useEffect(() => {
    setMatchIndex(0)
  }, [search])

  useEffect(() => {
    if (!panelActive) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        findInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelActive])

  const applyReplaceCurrent = () => {
    if (!activeMatch || !applyWordFixesBatch) return
    const { fixes, meta } = replacementFixes(visible, activeMatch, replace)
    applyWordFixesBatch(fixes, meta)
    if (addToVocab && search.trim() && replace.trim()) {
      void clipsFetch('/api/clips/export-user-preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          vocabulary: [{ from: search.trim(), to: replace.trim() }],
        }),
      }).catch(() => {})
    }
  }

  const applyReplaceAll = () => {
    if (!phraseMatches.length || !applyWordFixesBatch) return
    let fixes: Record<string, string> = {}
    let meta: Record<string, { s: number; w: string }> = {}
    for (const m of phraseMatches) {
      const rep = replacementFixes(visible, m, replace)
      fixes = { ...fixes, ...rep.fixes }
      meta = { ...meta, ...rep.meta }
    }
    applyWordFixesBatch(fixes, meta)
  }

  useEffect(() => {
    const sw = (() => {
      if (selStart === null || selEnd === null) return [] as SourceWord[]
      const a = Math.min(selStart, selEnd)
      const b = Math.max(selStart, selEnd)
      return visible.filter((w) => {
        const { startMs, endMs } = wordSourceMs(w)
        return endMs > a && startMs < b
      })
    })()
    const span = sw.length
      ? ([Math.round(wordSourceMs(sw[0]!).startMs), Math.round(wordSourceMs(sw[sw.length - 1]!).endMs)] as [number, number])
      : selStart != null && selEnd != null
        ? sourceSpanFromTranscriptSelection({ startMs: selStart, endMs: selEnd }, visible)
        : null
    selectionRef.current = {
      startMs: span?.[0] ?? selStart ?? 0,
      endMs: span?.[1] ?? selEnd ?? 0,
      clear: () => {
        setSelStart(null)
        setSelEnd(null)
      },
    }
  }, [selEnd, selStart, selectionRef, visible, edits])

  useEffect(() => {
    if (!follow || !panelActive || activeI == null || Date.now() < pauseFollowUntil.current) return
    const box = scrollRef.current
    const el = box?.querySelector<HTMLElement>(`[data-word-i="${activeI}"]`)
    if (!box || !el) return
    const b = box.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (r.top < b.top || r.bottom > b.bottom) el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [activeI, follow, panelActive])

  // G1b2: camera angle for the selected words (main-source span of the first..last word).
  const angles = onSetEdits ? multicamAngles(edits, angleSources) : []
  const angleTb = useMemo(() => timebaseFor(editorPreviewEdits(edits, visible)), [edits, visible])
  const angleSelection = (sourceId: string) => {
    if (selStart === null || selEnd === null || !onSetEdits) return
    const span = sourceSpanFromTranscriptSelection({ startMs: selStart, endMs: selEnd }, visible)
    if (!span) return
    onSetEdits(setAngleForSourceSpan(edits, angleTb, span[0], span[1], sourceId, angleSources))
  }
  const deleteSelection = () => {
    if (selStart === null || selEnd === null) return
    const a = Math.min(selStart, selEnd)
    const b = Math.max(selStart, selEnd)
    const selected = visible.filter((w) => {
      const { startMs, endMs } = wordSourceMs(w)
      return endMs > a && startMs < b
    })
    if (!selected.length) return
    const wa = selected[0]
    const wb = selected[selected.length - 1]
    onAddCut([Math.round(wa.s * 1000), Math.round(wb.e * 1000)])
    setSelStart(null)
    setSelEnd(null)
  }

  const cutCount = edits.cutRanges?.length ?? 0

  const selectionWords = (): SourceWord[] => {
    if (selStart === null || selEnd === null) return []
    const a = Math.min(selStart, selEnd)
    const b = Math.max(selStart, selEnd)
    return visible.filter((w) => {
      const { startMs, endMs } = wordSourceMs(w)
      return endMs > a && startMs < b
    })
  }
  const selRange = (): CutRange | null => {
    const sw = selectionWords()
    return sw.length ? [Math.round(sw[0]!.s * 1000), Math.round(sw[sw.length - 1]!.e * 1000)] : null
  }

  useEffect(() => {
    if (!ctxMenu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null)
    }
    const onPointer = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [ctxMenu])
  const ignoreTargets = () => selectionWords().filter((w) => !isWordCut(w, edits.cutRanges))
  const toggleIgnoreSelection = () => {
    const ws = ignoreTargets()
    if (!ws.length || !onSetEdits) {
      toast.message('Select words that are not cut')
      return
    }
    const on = nextIgnoreState(ws, edits.wordFixes)
    onSetEdits({ ...edits, ...setWordsIgnored(edits.wordFixes, edits.wordFixMeta, ws, on) })
  }
  const restoreSelection = () => {
    const r = selRange()
    if (!r || !onRestoreCutRange) return
    onRestoreCutRange(r)
    setSelStart(null)
    setSelEnd(null)
  }
  const restoreAll = () => {
    if (!onSetEdits || !cutCount) return
    if (!window.confirm(`Restore all ${cutCount} removed sections? This includes silence and filler cleanup. Undo with Ctrl+Z.`)) return
    onSetEdits({ ...edits, cutRanges: [] })
  }

  const inTrim = (w: SourceWord) => {
    const { startMs, endMs } = wordSourceMs(w)
    return endMs >= edits.trim.in && startMs <= edits.trim.out
  }

  const wordFixMetaFor = (w: SourceWord) => ({ s: Math.round(w.s * 1000), w: w.w })

  const commitWordFix = (w: SourceWord, text: string) => {
    onWordFix(w.i, text, wordFixMetaFor(w))
  }

  const beginWordEdit = (w: SourceWord) => {
    if (mutedWordForEdit(w)) return
    wordFixCommittedRef.current = false
    setEditingI(w.i)
  }

  const mutedWordForEdit = (w: SourceWord) => {
    const { midMs } = wordSourceMs(w)
    const muted = !inTrim(w)
    const surrounding = showSurrounding && muted && !isWordCut(w, edits.cutRanges)
    return surrounding || (muted && !showSurrounding)
  }

  useEffect(() => {
    if (!panelActive || editingI != null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      if (selStart === null || selEnd === null) return
      const lo = Math.min(selStart, selEnd)
      const hi = Math.max(selStart, selEnd)
      const picked = visible.filter((w) => {
        const { startMs, endMs } = wordSourceMs(w)
        return startMs >= lo && endMs <= hi && inTrim(w) && !isWordCut(w, edits.cutRanges)
      })
      if (picked.length !== 1) return
      e.preventDefault()
      beginWordEdit(picked[0]!)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelActive, editingI, selStart, selEnd, visible, edits.cutRanges, edits.trim.in, edits.trim.out, showSurrounding])

  const surroundingRunRestoreMs = useMemo(() => {
    const edges = new Map<number, number>()
    if (!showSurrounding) return edges
    let run: SourceWord[] = []
    const flush = () => {
      if (run.length < 1) return
      const last = run[run.length - 1]!
      const beforeTrim = wordSourceMs(run[0]!).startMs < edits.trim.in
      const edgeMs = beforeTrim
        ? Math.min(...run.map((x) => wordSourceMs(x).startMs))
        : Math.max(...run.map((x) => wordSourceMs(x).endMs))
      edges.set(last.i, Math.round(edgeMs))
      run = []
    }
    for (const w of visible) {
      const cut = isWordCut(w, edits.cutRanges)
      if (!inTrim(w) && !cut) run.push(w)
      else flush()
    }
    flush()
    return edges
  }, [visible, showSurrounding, edits.trim.in, edits.trim.out, edits.cutRanges])

  // FV2: full-length transcripts (thousands of words) render lazily in chunks; clips render as before.
  const longTranscript = visible.length > TRANSCRIPT_LAZY_MIN_WORDS && !reorderActive

  type Block = { spk: string; speakerNum: number; words: SourceWord[] }
  const blocks: Block[] = []
  for (const w of visible) {
    const { midMs } = wordSourceMs(w)
    const spk = speakerLabelForWord(shots, midMs)
    const speakerNum = spkOrder.indexOf(spk) + 1
    const last = blocks[blocks.length - 1]
    if (last && last.spk === spk) last.words.push(w)
    else blocks.push({ spk, speakerNum, words: [w] })
  }

  const renderGapCut = (range: CutRange) => {
    const ms = range[1] - range[0]
    const pauseLabel = ms >= 1000 ? `pause ${(ms / 1000).toFixed(1)}s` : `pause ${Math.round(ms)}ms`
    return (
      <span
        key={`gap-${range[0]}-${range[1]}`}
        className="mx-0.5 inline-flex items-center gap-1 rounded bg-amber-500/15 px-1 py-0.5 text-[11px] text-amber-900 dark:text-amber-100"
      >
        <span className="line-through decoration-amber-600/80">{pauseLabel}</span>
        {onRestoreCutRange ? (
          <button type="button" className="font-medium text-primary" onClick={() => onRestoreCutRange(range)}>
            Restore
          </button>
        ) : null}
      </span>
    )
  }

  const wordCutRange = (w: SourceWord): CutRange | null => {
    const { startMs, endMs } = wordSourceMs(w)
    for (const [s, e] of edits.cutRanges) {
      if (startMs < e && endMs > s) {
        const lo = Math.max(s, startMs)
        const hi = Math.min(e, endMs)
        if (hi - lo >= 20) return [lo, hi]
      }
    }
    return null
  }

  const renderWord = (w: SourceWord) => {
    const { startMs, endMs, midMs } = wordSourceMs(w)
    const cutRange = wordCutRange(w)
    const cut = Boolean(cutRange) || isWordCut(w, edits.cutRanges)
    const display = wordDisplayText(w, edits.wordFixes, edits.wordFixMeta)
    const ignored = isWordIgnored(w.i, edits.wordFixes)
    const active = activeI === w.i
    const isFiller = FILLER_RE.test(display.trim())
    const pickHighlight = highlightWordIdx?.has(w.i) ?? false
    const inPhraseMatch =
      activeMatch?.wordIdx.includes(w.i) &&
      phraseMatches.some((m) => m.wordIdx.includes(w.i))
    const searchHighlight = inPhraseMatch && search.trim().length > 0
    const muted = !inTrim(w)
    const surrounding = showSurrounding && muted && !cut
    const selected =
      selStart !== null && selEnd !== null && startMs >= Math.min(selStart, selEnd) && endMs <= Math.max(selStart, selEnd)

    if (editingI === w.i) {
      return (
        <span key={w.i} className="mr-1 inline-flex items-center gap-1">
          <input
            autoFocus
            className="w-24 rounded border border-border bg-background px-1 py-0.5 text-sm"
            defaultValue={display}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                wordFixCommittedRef.current = true
                commitWordFix(w, e.currentTarget.value)
                setEditingI(null)
              }
              if (e.key === 'Escape') setEditingI(null)
            }}
            onBlur={(e) => {
              if (wordFixCommittedRef.current) {
                wordFixCommittedRef.current = false
                setEditingI(null)
                return
              }
              commitWordFix(w, e.target.value)
              setEditingI(null)
            }}
          />
        </span>
      )
    }

    return (
      <span
        key={w.i}
        className={`mr-1 inline ${muted && !surrounding ? 'text-muted-foreground/50' : ''} ${surrounding ? 'text-muted-foreground/50' : ''}`}
      >
        <button
          type="button"
          disabled={muted && !surrounding}
          data-word-i={w.i}
          data-active={active ? '1' : undefined}
          data-ignored={ignored && !cut ? '1' : undefined}
          data-surrounding={surrounding ? '1' : undefined}
          data-highlight={pickHighlight ? '1' : undefined}
          className={`rounded px-1 py-0.5 transition hover:bg-accent cursor-text min-h-7 inline-flex items-center ${
            active ? 'bg-[#FFD400]/35' : ''
          } ${
            cut
              ? `text-muted-foreground/60 line-through decoration-destructive/70 decoration-2 bg-destructive/5 ${
                  isFiller ? 'decoration-muted-foreground/80' : ''
                }`
              : ''
          } ${surrounding ? 'line-through decoration-muted-foreground/70' : ''} ${pickHighlight ? 'bg-primary/15 ring-1 ring-primary/25' : ''} ${ignored && !cut ? 'text-muted-foreground/50 line-through decoration-dashed decoration-muted-foreground/70' : ''} ${selected ? 'bg-primary/30 ring-1 ring-primary/50' : ''} ${
            edits.captions?.emphasis?.includes(w.i) ? 'underline decoration-dotted decoration-lane-ai' : ''
          }`}
          onClick={(e) => {
            if (e.detail > 1) return
            if (surrounding) {
              onExtendTrim(Math.round(midMs))
              return
            }
            if (muted) {
              if (window.confirm('Extend clip to here?')) onExtendTrim(Math.round(midMs))
              return
            }
            if (e.altKey && edits.captions?.keywordHighlight && onToggleEmphasis) {
              onToggleEmphasis(w.i)
            }
            if (e.shiftKey && selStart !== null) {
              const ns = Math.min(selStart, Math.round(startMs))
              const ne = Math.max(selEnd ?? selStart, Math.round(endMs))
              setSelStart(ns)
              setSelEnd(ne)
            } else {
              setSelStart(Math.round(startMs))
              setSelEnd(Math.round(endMs))
              onSeek(Math.round(startMs))
            }
          }}
          onDoubleClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (mutedWordForEdit(w)) return
            if (ignored) {
              commitWordFix(w, '')
              return
            }
            beginWordEdit(w)
          }}
        >
          {ignored ? (
            <span title="Ignored: kept in the video, hidden from captions (double-click to unignore)">{w.w}</span>
          ) : searchHighlight ? (
            <mark className="rounded bg-lane-caption/30 text-foreground">{display}</mark>
          ) : (
            display
          )}
        </button>
        {selected && !cut && !muted && !surrounding ? (
          <button
            type="button"
            className="ml-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-accent"
            title="Edit word (Enter)"
            aria-label="Edit word"
            onClick={(e) => {
              e.stopPropagation()
              beginWordEdit(w)
            }}
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        ) : null}
        {cut ? (
          <button
            type="button"
            className="ml-0.5 text-[11px] font-medium text-primary"
            onClick={() => {
              if (cutRange && onRestoreCutRange) onRestoreCutRange(cutRange)
              else onRestoreWord(w)
            }}
          >
            Restore
          </button>
        ) : surroundingRunRestoreMs.has(w.i) ? (
          <button
            type="button"
            className="ml-0.5 text-[11px] font-medium text-primary"
            onClick={() => onExtendTrim(surroundingRunRestoreMs.get(w.i)!)}
          >
            Restore
          </button>
        ) : null}
      </span>
    )
  }

  return (
    <div
      className={cn('flex flex-col', compactToolbar ? 'h-full min-h-0 gap-2 p-3' : 'gap-3 p-3')}
      aria-busy={wordsLoading}
    >
      {wordsLoading ? (
        <p className="text-xs text-muted-foreground" role="status">Updating transcript for extended trim…</p>
      ) : null}
      {compactToolbar ? (
        <div className="flex shrink-0 items-center gap-2" data-testid="transcript-find-replace">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              ref={findInputRef}
              className="h-8 pl-8"
              placeholder="Find…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Find in transcript"
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{phraseMatches.length} matches</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2"
            disabled={!phraseMatches.length}
            aria-label="Previous match"
            onClick={() => {
              if (!phraseMatches.length) return
              const next = (safeMatchIndex - 1 + phraseMatches.length) % phraseMatches.length
              setMatchIndex(next)
              onSeek(phraseMatches[next]!.startMs)
            }}
          >
            ◀
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2"
            disabled={!phraseMatches.length}
            aria-label="Next match"
            onClick={() => {
              if (!phraseMatches.length) return
              const next = (safeMatchIndex + 1) % phraseMatches.length
              setMatchIndex(next)
              onSeek(phraseMatches[next]!.startMs)
            }}
          >
            ▶
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" size="sm" variant="outline" className="h-8 w-8 px-0" data-testid="transcript-more-menu" aria-label="More transcript actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Find & replace</DropdownMenuLabel>
                <div className="px-2 pb-2">
                  <Input
                    className="h-8"
                    placeholder="Replace…"
                    value={replace}
                    onChange={(e) => setReplace(e.target.value)}
                    aria-label="Replace with"
                  />
                </div>
                <DropdownMenuItem disabled={!activeMatch} onClick={applyReplaceCurrent}>
                  Replace
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!phraseMatches.length} onClick={applyReplaceAll}>
                  Replace all
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAddToVocab((v) => !v)}>
                  {addToVocab ? '✓ ' : ''}Add to my vocabulary
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>View</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onShowSurroundingChange?.(!showSurrounding)}>
                  {showSurrounding ? '✓ ' : ''}Show surrounding
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setShowDeleted((v) => {
                      const next = !v
                      persist('transovo.script.showDeleted', next)
                      return next
                    })
                  }}
                >
                  {showDeleted ? '✓ ' : ''}Show deleted
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setFollow((v) => {
                      const next = !v
                      persist('transovo.script.follow', next)
                      return next
                    })
                  }}
                >
                  {follow ? '✓ ' : ''}Follow playhead
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Cuts & selection</DropdownMenuLabel>
                <DropdownMenuItem disabled>{cutCount} cuts</DropdownMenuItem>
                {cutCount > 0 && onSetEdits ? (
                  <DropdownMenuItem onClick={restoreAll}>Restore all cuts</DropdownMenuItem>
                ) : null}
                {reorderActive && onPatchSectionOrder ? (
                  <DropdownMenuItem onClick={() => onPatchSectionOrder(undefined)}>Reset order</DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={deleteSelection}>Delete selection</DropdownMenuItem>
                {onBuildFromTranscript ? (
                  <DropdownMenuItem onClick={onBuildFromTranscript}>Build from transcript</DropdownMenuItem>
                ) : null}
                {onPatchSectionOrder && mediaKind !== 'composite' ? (
                  <>
                    <DropdownMenuItem disabled={selStart === null} onClick={() => moveSection('up')}>
                      Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={selStart === null} onClick={() => moveSection('down')}>
                      Move down
                    </DropdownMenuItem>
                  </>
                ) : null}
                {onSaveAsNewClip ? (
                  <DropdownMenuItem
                    disabled={selStart === null || selEnd === null}
                    onClick={() => {
                      if (selStart == null || selEnd == null) return
                      const trimIn = Math.min(selStart, selEnd)
                      const trimOut = Math.max(selStart, selEnd)
                      const title = selectionWords()
                        .map((w) => wordDisplayText(w, edits.wordFixes))
                        .join(' ')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .slice(0, 120)
                      void onSaveAsNewClip(trimIn, trimOut, title || undefined)
                    }}
                  >
                    Make clip
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
      <div className="flex flex-col gap-2" data-testid="transcript-find-replace">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[120px] flex-1">
            <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              ref={findInputRef}
              className="h-8 pl-8"
              placeholder="Find…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Find in transcript"
            />
          </div>
          <Input
            className="h-8 min-w-[120px] flex-1"
            placeholder="Replace…"
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            aria-label="Replace with"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="tabular-nums text-muted-foreground">{phraseMatches.length} matches</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7"
            disabled={!phraseMatches.length}
            onClick={() => {
              if (!phraseMatches.length) return
              const next = (safeMatchIndex - 1 + phraseMatches.length) % phraseMatches.length
              setMatchIndex(next)
              onSeek(phraseMatches[next]!.startMs)
            }}
          >
            ◀
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7"
            disabled={!phraseMatches.length}
            onClick={() => {
              if (!phraseMatches.length) return
              const next = (safeMatchIndex + 1) % phraseMatches.length
              setMatchIndex(next)
              onSeek(phraseMatches[next]!.startMs)
            }}
          >
            ▶
          </Button>
          <Button type="button" size="sm" variant="secondary" className="h-7" disabled={!activeMatch} onClick={applyReplaceCurrent}>
            Replace
          </Button>
          <Button type="button" size="sm" variant="secondary" className="h-7" disabled={!phraseMatches.length} onClick={applyReplaceAll}>
            Replace all
          </Button>
          <label className="ml-auto flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={addToVocab}
              onChange={(e) => setAddToVocab(e.target.checked)}
            />
            Add to my vocabulary
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="h-7 w-fit tabular-nums">
            {cutCount} cuts
          </Badge>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {cutCount > 0 && onSetEdits ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1"
                onClick={restoreAll}
                data-testid="transcript-restore-all"
              >
                <RotateCcw className="size-3.5" /> Restore all
              </Button>
            ) : null}
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={showSurrounding}
                data-testid="transcript-show-surrounding"
                onChange={(e) => {
                  onShowSurroundingChange?.(e.target.checked)
                }}
              />
              Show surrounding
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={showDeleted}
                data-testid="transcript-show-deleted"
                onChange={(e) => {
                  setShowDeleted(e.target.checked)
                  persist('transovo.script.showDeleted', e.target.checked)
                }}
              />
              Show deleted
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={follow}
                data-testid="transcript-follow"
                onChange={(e) => {
                  setFollow(e.target.checked)
                  persist('transovo.script.follow', e.target.checked)
                }}
              />
              Follow playhead
            </label>
          </div>
        </div>
      </div>
      )}
      {selStart !== null && selEnd !== null && (
        <div className="flex w-fit gap-1 rounded-lg border border-border bg-popover p-1 shadow-md">
          <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={deleteSelection}>
            <Scissors className="size-3.5" />
            Cut
          </Button>
          {onRestoreCutRange && (() => {
            const r = selRange()
            return r && selectionHasCuts(edits.cutRanges, r[0], r[1])
          })() ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1"
              onClick={restoreSelection}
              data-testid="transcript-restore-selection"
            >
              <RotateCcw className="size-3.5" /> Restore
            </Button>
          ) : null}
          {onSetEdits ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1"
              onClick={toggleIgnoreSelection}
              title="Strike from the script and captions; keep the video and audio. Ignoring drops any text correction on that word."
              data-testid="transcript-ignore"
            >
              <EyeOff className="size-3.5" />
              {ignoreTargets().length && !nextIgnoreState(ignoreTargets(), edits.wordFixes) ? 'Unignore' : 'Ignore'}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1"
            onClick={() => {
              setSelStart(null)
              setSelEnd(null)
            }}
          >
            <Undo2 className="size-3.5" />
            Clear
          </Button>
          {angles.length > 1
            ? angles.map((ang) => (
                <Button
                  key={ang.sourceId}
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  title={`Show ${ang.label} for the selected words`}
                  data-testid={`transcript-angle-${ang.sourceId}`}
                  onClick={() => angleSelection(ang.sourceId)}
                >
                  {ang.key}. {ang.label}
                </Button>
              ))
            : null}
        </div>
      )}
      {!compactToolbar ? (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={deleteSelection}>Delete selection</Button>
        {onBuildFromTranscript ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onBuildFromTranscript}
            title="Pick words from an uploaded video or audio file and add them to the timeline at the playhead (Media → source monitor)"
            data-testid="transcript-build-from-transcript"
          >
            Build from transcript
          </Button>
        ) : null}
        {onPatchSectionOrder && mediaKind !== 'composite' ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={selStart === null}
              onClick={() => moveSection('up')}
            >
              Move up
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selStart === null}
              onClick={() => moveSection('down')}
            >
              Move down
            </Button>
          </>
        ) : null}
        {reorderActive && onPatchSectionOrder ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onPatchSectionOrder(undefined)}
          >
            Reset order
          </Button>
        ) : null}
        {onSaveAsNewClip ? (
          <Button
            size="sm"
            variant="secondary"
            data-testid="transcript-make-clip"
            disabled={selStart === null || selEnd === null}
            onClick={() => {
              if (selStart == null || selEnd == null) return
              const trimIn = Math.min(selStart, selEnd)
              const trimOut = Math.max(selStart, selEnd)
              const title = selectionWords()
                .map((w) => wordDisplayText(w, edits.wordFixes))
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 120)
              void onSaveAsNewClip(trimIn, trimOut, title || undefined)
            }}
          >
            Make clip
          </Button>
        ) : null}
      </div>
      ) : null}
      <div
        ref={scrollRef}
        className={cn(
          'overflow-y-auto text-sm leading-relaxed',
          compactToolbar ? 'min-h-0 flex-1' : 'max-h-[min(50vh,420px)]',
          largeScript && 'max-h-none flex-1 text-[17px] leading-[1.65] [&_span]:max-w-[80ch]',
        )}
        onWheel={bumpFollowPause}
        onTouchStart={bumpFollowPause}
        onScroll={bumpFollowPause}
        onContextMenu={(e) => {
          if (selStart === null || selEnd === null || !onSetEdits || angles.length < 2) return
          if (!selectionWords().length) return
          e.preventDefault()
          setCtxMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        {!visible.length ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No transcript words for this clip yet. They appear after processing finishes.
          </p>
        ) : null}
        {reorderActive ? (
          <div className="inline">
            {outputBlocks.flatMap((range, blockIndex) => {
              const blockWords = visible
                .filter((w) => {
                  const { midMs } = wordSourceMs(w)
                  return midMs >= range[0] && midMs < range[1]
                })
                .sort((a, b) => a.s - b.s || a.i - b.i)
              const nodes: ReactNode[] = []
              if (blockIndex > 0) {
                nodes.push(
                  <div
                    key={`divider-${blockIndex}`}
                    className="my-2 block w-full border-t border-dashed border-muted-foreground/40 pt-2 text-[11px] uppercase tracking-wide text-muted-foreground"
                  >
                    Moved section
                  </div>,
                )
              }
              for (const w of blockWords) nodes.push(renderWord(w))
              return nodes
            })}
          </div>
        ) : (
        blocks.map((block, bi) => {
          const dot = SPEAKER_DOT[(block.speakerNum - 1) % SPEAKER_DOT.length]
          const prevBlockLast =
            bi > 0 ? blocks[bi - 1].words[blocks[bi - 1].words.length - 1] : null
          const paras = paragraphStarts(block.words, (x) => wordDisplayText(x, edits.wordFixes))
          const emitSlice = (slice: SourceWord[], prevBefore: SourceWord | null) => {
            const runs = showDeleted
              ? slice.map((w) => ({ kind: 'word' as const, w }))
              : collapseCutRuns(slice, (x) => isWordCut(x, edits.cutRanges))
            const nodes: ReactNode[] = []
            let prev = prevBefore
            for (const run of runs) {
              if (run.kind === 'removed') {
                nodes.push(
                  <span
                    key={`rm-${run.range[0]}`}
                    className="mx-0.5 inline-flex items-center gap-1 rounded bg-destructive/10 px-1 py-0.5 text-[11px] text-muted-foreground"
                    data-testid="transcript-removed-run"
                  >
                    ⋯ {run.words.length} word{run.words.length === 1 ? '' : 's'} removed
                    {onRestoreCutRange ? (
                      <button type="button" className="font-medium text-primary" onClick={() => onRestoreCutRange(run.range)}>
                        Restore
                      </button>
                    ) : null}
                  </span>,
                )
                continue
              }
              const w = run.w
              const wi = visible.findIndex((x) => x.i === w.i)
              if (wi >= 0 && momentRows?.length) {
                for (const row of momentRows) {
                  if (row.beforeWordIndex !== wi) continue
                  nodes.push(
                    <button
                      key={`vm-${row.pick.clipId}-${wi}`}
                      type="button"
                      data-testid="transcript-visual-moment"
                      className="my-1 block w-full rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-left text-[11px] text-foreground hover:bg-primary/15"
                      onClick={() => {
                        onSelectRange?.(row.pick.startMs, row.pick.endMs)
                        onSeek(row.pick.startMs)
                      }}
                    >
                      {row.label}
                    </button>,
                  )
                }
              }
              if (paras.has(w.i)) {
                nodes.push(
                  <span key={`p-${w.i}`} className="block h-1.5" data-testid="transcript-para-break" aria-hidden />,
                )
              }
              let gapCut = prev ? gapCutBetweenSourceWords(prev, w, edits.cutRanges ?? []) : null
              if (prev && gapCut) {
                const gapMs = wordSourceMs(w).startMs - wordSourceMs(prev).endMs
                if (gapMs > maxPlausibleGapMs) gapCut = null
              }
              nodes.push(renderWord(w))
              if (gapCut) nodes.push(renderGapCut(gapCut))
              prev = w
            }
            return nodes
          }
          return (
            <div key={`${block.spk}-${bi}`}>
              <div className="mt-3 flex items-center gap-1.5 first:mt-0">
                {renamingSpk === `${block.spk}-${bi}` && onSetEdits ? (
                  <Input
                    autoFocus
                    maxLength={32}
                    className="h-6 w-36 text-xs"
                    data-testid="transcript-speaker-input"
                    defaultValue={edits.speakerNames?.[block.spk] ?? ''}
                    placeholder={`Speaker ${block.speakerNum}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onSetEdits({ ...edits, speakerNames: setSpeakerName(edits.speakerNames, block.spk, e.currentTarget.value) })
                        setRenamingSpk(null)
                      }
                      if (e.key === 'Escape') {
                        e.stopPropagation()
                        setRenamingSpk(null)
                      }
                    }}
                    onBlur={(e) => {
                      onSetEdits({ ...edits, speakerNames: setSpeakerName(edits.speakerNames, block.spk, e.target.value) })
                      setRenamingSpk(null)
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    data-testid="transcript-speaker-chip"
                    title="Rename speaker"
                    className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted px-2 text-xs font-medium hover:bg-accent"
                    onClick={() => onSetEdits && setRenamingSpk(`${block.spk}-${bi}`)}
                  >
                    <span className={`size-1.5 rounded-full ${dot}`} aria-hidden />
                    <User className="size-3" aria-hidden />
                    {speakerDisplayName(edits.speakerNames, block.spk, block.speakerNum)}
                  </button>
                )}
              </div>
              {transcriptChunkStarts(block.words.length, longTranscript).map((from) => {
                const to = Math.min(block.words.length, from + TRANSCRIPT_CHUNK_WORDS)
                const slice = block.words.slice(from, to)
                const prevBefore = from === 0 ? prevBlockLast : block.words[from - 1]!
                const renderRange = () => emitSlice(slice, prevBefore)
                return longTranscript ? (
                  <LazyTranscriptChunk key={from} words={to - from}>
                    {renderRange}
                  </LazyTranscriptChunk>
                ) : (
                  <div key={from} className="inline">
                    {renderRange()}
                  </div>
                )
              })}
            </div>
          )
        })
        )}
      </div>
      {ctxMenu && angles.length > 1 && onSetEdits ? (
        <div
          ref={ctxRef}
          className="fixed z-50 min-w-[200px] rounded-md border border-border bg-popover p-1 text-xs shadow-lg"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          role="menu"
          aria-label="Script selection"
          data-testid="transcript-ctx-menu"
        >
          <p className="px-2 pt-1 text-[11px] font-medium text-muted-foreground">Camera ▸</p>
          {angles.map((ang) => (
            <button
              key={ang.sourceId}
              type="button"
              className="block w-full rounded px-2 py-1.5 pl-4 text-left hover:bg-muted"
              role="menuitem"
              data-testid={`transcript-ctx-angle-${ang.sourceId}`}
              onClick={() => {
                angleSelection(ang.sourceId)
                setCtxMenu(null)
              }}
            >
              {ang.key}. {ang.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** FV2: above this many words the transcript renders in lazy chunks. */
export const TRANSCRIPT_LAZY_MIN_WORDS = 2000
/** FV2: words per lazy chunk. */
export const TRANSCRIPT_CHUNK_WORDS = 300

/** Start indexes of a block's chunks (one chunk = the whole block for short transcripts). */
export function transcriptChunkStarts(n: number, chunked: boolean): number[] {
  if (!chunked || n <= TRANSCRIPT_CHUNK_WORDS) return [0]
  const out: number[] = []
  for (let i = 0; i < n; i += TRANSCRIPT_CHUNK_WORDS) out.push(i)
  return out
}

/**
 * Renders its words only while near the scroll viewport; elsewhere a placeholder keeps the scroll
 * height (estimated, then the measured height once it has been shown). Without IntersectionObserver
 * it renders everything.
 */
function LazyTranscriptChunk({ words, children }: { words: number; children: () => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')
  const heightRef = useRef<number>(Math.max(24, Math.ceil(words / 10) * 24))
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    let root: Element | null = el.parentElement
    while (root && !(root instanceof HTMLElement && /(auto|scroll)/.test(getComputedStyle(root).overflowY))) {
      root = root.parentElement
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting && el.offsetHeight > 0) heightRef.current = el.offsetHeight
          setNear(e.isIntersecting)
        }
      },
      { root, rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className="inline"
      data-testid="transcript-chunk"
      data-rendered={near ? '1' : '0'}
      style={near ? undefined : { display: 'block', height: heightRef.current }}
    >
      {near ? children() : null}
    </div>
  )
}
