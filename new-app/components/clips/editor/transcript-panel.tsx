'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { FILLER_RE, isWordCut, wordDisplayText } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'
import { shotIndexAt, speakerLabelForWord } from '@/lib/clips/crop-shots'
import type { CropShot } from '@/lib/server/clips/clip-detail'

export type TranscriptSelection = {
  startMs: number
  endMs: number
  clear: () => void
}

export function TranscriptPanel({
  words,
  shots,
  edits,
  onSeek,
  onAddCut,
  onWordFix,
  onRestoreWord,
  selectionRef,
}: {
  words: SourceWord[]
  shots: CropShot[]
  edits: ClipEditsV2
  onSeek: (sourceMs: number) => void
  onAddCut: (range: [number, number]) => void
  onWordFix: (index: number, text: string) => void
  onRestoreWord: (word: SourceWord) => void
  selectionRef: React.MutableRefObject<TranscriptSelection | null>
}) {
  const [selStart, setSelStart] = useState<number | null>(null)
  const [selEnd, setSelEnd] = useState<number | null>(null)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (editingIdx !== null) inputRef.current?.focus()
  }, [editingIdx])

  const deleteSelection = () => {
    if (selStart === null || selEnd === null) return
    const a = Math.min(selStart, selEnd)
    const b = Math.max(selStart, selEnd)
    onAddCut([a, b])
    setSelStart(null)
    setSelEnd(null)
  }

  const removeFillers = () => {
    for (const w of words) {
      const text = wordDisplayText(w, edits.wordFixes)
      if (FILLER_RE.test(text.trim())) {
        const { startMs, endMs } = wordSourceMs(w)
        onAddCut([Math.round(startMs), Math.round(endMs)])
      }
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={deleteSelection}>Delete selection</Button>
        <Button size="sm" variant="outline" onClick={removeFillers}>Remove filler words</Button>
      </div>
      <div className="max-h-[min(50vh,420px)] overflow-y-auto text-sm leading-relaxed">
        {words.map((w) => {
          const { startMs, endMs, midMs } = wordSourceMs(w)
          const cut = isWordCut(w, edits.cutRanges)
          const display = wordDisplayText(w, edits.wordFixes)
          const shotI = shotIndexAt(shots, midMs)
          const spk = speakerLabelForWord(shots, midMs)
          const selected =
            selStart !== null &&
            selEnd !== null &&
            startMs >= Math.min(selStart, selEnd) &&
            endMs <= Math.max(selStart, selEnd)

          if (editingIdx === w.idx) {
            return (
              <span key={w.idx} className="mr-1 inline-flex items-center gap-1">
                <input
                  ref={inputRef}
                  className="w-24 rounded border border-border bg-background px-1 py-0.5 text-sm"
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (editDraft.trim()) onWordFix(w.idx, editDraft.trim())
                      setEditingIdx(null)
                    }
                    if (e.key === 'Escape') setEditingIdx(null)
                  }}
                  onBlur={() => {
                    if (editDraft.trim()) onWordFix(w.idx, editDraft.trim())
                    setEditingIdx(null)
                  }}
                />
              </span>
            )
          }

          return (
            <span key={w.idx} className="mr-1 inline">
              <span className="text-[10px] text-muted-foreground">
                S{shotI + 1}
                {spk} 
              </span>
              <button
                type="button"
                className={`rounded px-0.5 hover:bg-muted ${cut ? 'line-through opacity-50' : ''} ${
                  selected ? 'bg-primary/20' : ''
                }`}
                onClick={(e) => {
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
                  setEditingIdx(w.idx)
                  setEditDraft(display)
                }}
              >
                {display}
              </button>
              {cut ? (
                <button type="button" className="ml-0.5 text-[10px] text-primary" onClick={() => onRestoreWord(w)}>
                  Restore
                </button>
              ) : null}
            </span>
          )
        })}
      </div>
    </div>
  )
}
