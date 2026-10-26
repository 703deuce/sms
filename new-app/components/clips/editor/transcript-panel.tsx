'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ClipEditsV2, ClipWord } from '@/lib/clips/edits'
import { FILLER_RE } from '@/lib/clips/edits'

function isCut(word: ClipWord, cuts: ClipEditsV2['cutRanges']) {
  const mid = ((word.s + word.e) / 2) * 1000
  return cuts.some(([s, e]) => mid >= s && mid < e)
}

export function TranscriptPanel({
  words,
  edits,
  onSeek,
  onAddCut,
  onWordFix,
  onRestoreCut,
}: {
  words: ClipWord[]
  edits: ClipEditsV2
  onSeek: (ms: number) => void
  onAddCut: (range: [number, number]) => void
  onWordFix: (index: number, text: string) => void
  onRestoreCut: (range: [number, number]) => void
}) {
  const [selStart, setSelStart] = useState<number | null>(null)
  const [selEnd, setSelEnd] = useState<number | null>(null)

  const deleteSelection = () => {
    if (selStart === null || selEnd === null) return
    const a = Math.min(selStart, selEnd)
    const b = Math.max(selStart, selEnd)
    onAddCut([a, b])
    setSelStart(null)
    setSelEnd(null)
  }

  const removeFillers = () => {
    for (let i = 0; i < words.length; i++) {
      const w = words[i]
      const fixed = edits.wordFixes[String(i)]
      const text = fixed ?? w.w
      if (FILLER_RE.test(text.trim())) {
        onAddCut([Math.round(w.s * 1000), Math.round(w.e * 1000)])
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={deleteSelection}>Delete selection</Button>
        <Button size="sm" variant="outline" onClick={removeFillers}>Remove filler words</Button>
      </div>
      <div className="max-h-[360px] overflow-y-auto rounded-lg border border-border p-3 text-sm leading-relaxed">
        {words.map((w, i) => {
          const cut = isCut(w, edits.cutRanges)
          const display = edits.wordFixes[String(i)] ?? w.w
          const spk = w.spk ?? 0
          return (
            <span key={`${i}-${w.s}`} className="mr-1 inline">
              <span className="text-[10px] text-muted-foreground">S{spk + 1} </span>
              <button
                type="button"
                className={`rounded px-0.5 hover:bg-muted ${cut ? 'line-through opacity-50' : ''} ${
                  selStart !== null && selEnd !== null &&
                  Math.min(w.s * 1000, w.e * 1000) >= Math.min(selStart, selEnd) &&
                  Math.max(w.s * 1000, w.e * 1000) <= Math.max(selStart, selEnd)
                    ? 'bg-primary/20'
                    : ''
                }`}
                onClick={(e) => {
                  if (e.shiftKey && selStart !== null) {
                    setSelEnd(Math.round(w.e * 1000))
                  } else {
                    setSelStart(Math.round(w.s * 1000))
                    setSelEnd(Math.round(w.e * 1000))
                    onSeek(Math.round(w.s * 1000))
                  }
                }}
                onDoubleClick={() => {
                  const next = window.prompt('Edit word', display)
                  if (next != null && next.trim()) onWordFix(i, next.trim())
                }}
              >
                {display}
              </button>
              {cut ? (
                <button
                  type="button"
                  className="ml-0.5 text-[10px] text-primary"
                  onClick={() =>
                    onRestoreCut([Math.round(w.s * 1000), Math.round(w.e * 1000)])
                  }
                >
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
