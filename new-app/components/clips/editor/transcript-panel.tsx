'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Scissors, Search, Undo2, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ClipEditsV2, CutRange } from '@/lib/clips/edits'
import { FILLER_RE, isWordCut, wordDisplayText } from '@/lib/clips/edits'
import { gapCutBetweenSourceWords } from '@/lib/clips/gap-shorten'
import type { SourceWord } from '@/lib/clips/source-words'
import { maxPlausibleGapMsForTrim, sourceWordsForClipEditing } from '@/lib/clips/editor/clip-editor-word-scope'
import { wordSourceMs } from '@/lib/clips/source-words'
import { speakerLabelForWord } from '@/lib/clips/crop-shots'
import { findMatches, replacementFixes } from '@/lib/clips/editor/find-replace'
import { clipsFetch } from '@/lib/clips-api'
import type { VocabEntry } from '@/lib/clips/clip-export-user-types'
import type { CropShot } from '@/lib/server/clips/clip-detail'

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
}: {
  words: SourceWord[]
  wordsLoading?: boolean
  clipStartMs?: number
  clipEndMs?: number
  shots: CropShot[]
  edits: ClipEditsV2
  onSeek: (sourceMs: number) => void
  onAddCut: (range: [number, number]) => void
  onWordFix: (index: number, text: string) => void
  onRestoreWord: (word: SourceWord) => void
  onExtendTrim: (sourceMs: number) => void
  onToggleEmphasis?: (wordIndex: number) => void
  onRestoreCutRange?: (range: CutRange) => void
  onSaveAsNewClip?: (trimIn: number, trimOut: number) => void | Promise<void>
  selectionRef: React.MutableRefObject<TranscriptSelection | null>
  applyWordFixesBatch?: (
    fixes: Record<string, string>,
    meta: Record<string, { s: number; w: string }>,
  ) => void
  panelActive?: boolean
}) {
  const [selStart, setSelStart] = useState<number | null>(null)
  const [selEnd, setSelEnd] = useState<number | null>(null)
  const [editingI, setEditingI] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [replace, setReplace] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const [addToVocab, setAddToVocab] = useState(false)
  const findInputRef = useRef<HTMLInputElement>(null)
  const visible = useMemo(() => {
    if (!words.length) return []
    const bounds =
      clipStartMs != null && clipEndMs != null ? { clipStartMs, clipEndMs } : undefined
    const core = sourceWordsForClipEditing(words, edits, bounds)
    const pad = 2000
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
  }, [words, edits.trim.in, edits.trim.out, clipStartMs, clipEndMs])
  const spkOrder = useMemo(() => speakerOrder(visible, shots), [visible, shots])
  const maxPlausibleGapMs = useMemo(() => maxPlausibleGapMsForTrim(edits.trim), [edits.trim.in, edits.trim.out])

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
    selectionRef.current = {
      startMs: selStart ?? 0,
      endMs: selEnd ?? 0,
      clear: () => {
        setSelStart(null)
        setSelEnd(null)
      },
    }
  }, [selEnd, selStart, selectionRef])

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

  const inTrim = (w: SourceWord) => {
    const { startMs, endMs } = wordSourceMs(w)
    return endMs >= edits.trim.in && startMs <= edits.trim.out
  }

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
        className="mx-0.5 inline-flex items-center gap-1 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-900 dark:text-amber-100"
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
    const display = wordDisplayText(w, edits.wordFixes)
    const hidden = String(w.i) in edits.wordFixes && edits.wordFixes[String(w.i)] === ''
    const isFiller = FILLER_RE.test(display.trim())
    const inPhraseMatch =
      activeMatch?.wordIdx.includes(w.i) &&
      phraseMatches.some((m) => m.wordIdx.includes(w.i))
    const highlight = inPhraseMatch && search.trim().length > 0
    const muted = !inTrim(w)
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
                onWordFix(w.i, e.currentTarget.value)
                setEditingI(null)
              }
              if (e.key === 'Escape') setEditingI(null)
            }}
            onBlur={(e) => {
              onWordFix(w.i, e.target.value)
              setEditingI(null)
            }}
          />
        </span>
      )
    }

    return (
      <span key={w.i} className={`mr-1 inline ${muted ? 'text-muted-foreground/50' : ''}`}>
        <button
          type="button"
          disabled={muted}
          className={`rounded px-0.5 transition hover:bg-accent cursor-text ${
            cut
              ? `text-muted-foreground/60 line-through decoration-destructive/70 decoration-2 bg-destructive/5 ${
                  isFiller ? 'decoration-muted-foreground/80' : ''
                }`
              : ''
          } ${selected ? 'bg-primary/30 ring-1 ring-primary/50' : ''} ${
            edits.captions?.emphasis?.includes(w.i) ? 'underline decoration-dotted decoration-lane-ai' : ''
          }`}
          onClick={(e) => {
            if (muted) {
              if (window.confirm('Extend clip to here?')) onExtendTrim(Math.round(midMs))
              return
            }
            if (edits.captions?.keywordHighlight && onToggleEmphasis) {
              onToggleEmphasis(w.i)
            }
            if (e.shiftKey && selStart !== null) {
              setSelEnd(Math.round(endMs))
            } else {
              setSelStart(Math.round(startMs))
              setSelEnd(Math.round(endMs))
              onSeek(Math.round(startMs))
            }
          }}
          onDoubleClick={(e) => {
            e.preventDefault()
            if (muted) return
            if (hidden) {
              onWordFix(w.i, '')
              return
            }
            setEditingI(w.i)
          }}
        >
          {hidden ? (
            <span className="text-muted-foreground/40" title="Merged into previous word — double-click to restore">
              ·
            </span>
          ) : highlight ? (
            <mark className="rounded bg-lane-caption/30 text-foreground">{display}</mark>
          ) : (
            display
          )}
        </button>
        {cut ? (
          <button
            type="button"
            className="ml-0.5 text-[10px] font-medium text-primary"
            onClick={() => {
              if (cutRange && onRestoreCutRange) onRestoreCutRange(cutRange)
              else onRestoreWord(w)
            }}
          >
            Restore
          </button>
        ) : null}
      </span>
    )
  }

  const cutCount = edits.cutRanges?.length ?? 0

  return (
    <div className="flex flex-col gap-3 p-3" aria-busy={wordsLoading}>
      {wordsLoading ? (
        <p className="text-xs text-muted-foreground" role="status">Updating transcript for extended trim…</p>
      ) : null}
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
        <Badge variant="secondary" className="h-7 w-fit tabular-nums">{cutCount} cuts</Badge>
      </div>
      {selStart !== null && selEnd !== null && (
        <div className="flex w-fit gap-1 rounded-lg border border-border bg-popover p-1 shadow-md">
          <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={deleteSelection}>
            <Scissors className="size-3.5" />
            Cut
          </Button>
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
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={deleteSelection}>Delete selection</Button>
        {onSaveAsNewClip ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const trimIn =
                selStart != null && selEnd != null
                  ? Math.min(selStart, selEnd)
                  : edits.trim.in
              const trimOut =
                selStart != null && selEnd != null
                  ? Math.max(selStart, selEnd)
                  : edits.trim.out
              void onSaveAsNewClip(trimIn, trimOut)
            }}
          >
            Save as new clip
          </Button>
        ) : null}
      </div>
      <div className="max-h-[min(50vh,420px)] overflow-y-auto text-sm leading-relaxed">
        {!visible.length ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No transcript words for this clip yet. They appear after processing finishes.
          </p>
        ) : null}
        {blocks.map((block, bi) => {
          const dot = SPEAKER_DOT[(block.speakerNum - 1) % SPEAKER_DOT.length]
          const prevBlockLast =
            bi > 0 ? blocks[bi - 1].words[blocks[bi - 1].words.length - 1] : null
          return (
            <div key={`${block.spk}-${bi}`}>
              <div className="mt-3 flex items-center gap-1.5 first:mt-0">
                <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted px-2 text-xs font-medium">
                  <span className={`size-1.5 rounded-full ${dot}`} aria-hidden />
                  <User className="size-3" aria-hidden />
                  Speaker {block.speakerNum}
                </span>
              </div>
              <div className="inline">
                {block.words.flatMap((w, wi) => {
                  const prev = wi === 0 ? prevBlockLast : block.words[wi - 1]
                  let gapCut = prev ? gapCutBetweenSourceWords(prev, w, edits.cutRanges ?? []) : null
                  if (prev && gapCut) {
                    const gapMs = wordSourceMs(w).startMs - wordSourceMs(prev).endMs
                    if (gapMs > maxPlausibleGapMs) gapCut = null
                  }
                  const nodes = [renderWord(w)]
                  if (gapCut) nodes.push(renderGapCut(gapCut))
                  return nodes
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
