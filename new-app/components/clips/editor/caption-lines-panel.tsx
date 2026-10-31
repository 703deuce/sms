'use client'

import { useMemo, useRef, useState } from 'react'
import { Download, FileUp, GitMerge, Plus, Scissors, Trash2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { buildCaptionWords, type CaptionSourceWord } from '@/lib/clips/caption-words'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import {
  addTypedLines,
  appendCaptionLines,
  CAPTION_LINE_MAX_CHARS,
  captionLinesFromWords,
  captionLinesToSrt,
  captionLinesToTxt,
  captionLinesToVtt,
  mergeCaptionLineWithNext,
  normalizeCaptionLinesEdits,
  parseSubtitles,
  rechunkCaptionLines,
  splitCaptionLine,
  type CaptionLine,
} from '@/lib/clips/editor/caption-lines'

/**
 * G3a: manual captions (Descript / CapCut "Captions → manual"): type lines, import SRT / VTT, turn
 * the auto captions into editable lines, edit / split / merge / delete, and download SRT / VTT / TXT.
 * Lines replace the transcript words in the burned captions; style + position above still apply.
 * Everything here is local (no AI, nothing charged).
 */

type Layout = { id: string; label: string; captions: Partial<ClipEditsV2['captions']> }

/** Caption layouts per frame shape (16:9-native lower third etc.); export clamps to the same safe area. */
export function captionLayoutsFor(aspect: string | undefined): Layout[] {
  switch (aspect) {
    case '16:9':
      return [
        { id: 'lower_third', label: 'Lower third', captions: { position: 'bottom', marginVPct: 7, size: 5.5, wordsPerLine: 6 } },
        { id: 'subtitle', label: 'Film subtitle', captions: { position: 'bottom', marginVPct: 6, size: 4.5, wordsPerLine: 8 } },
        { id: 'top_banner', label: 'Top', captions: { position: 'top', marginVPct: 6, size: 5.5, wordsPerLine: 6 } },
      ]
    case '1:1':
      return [
        { id: 'square_bottom', label: 'Bottom', captions: { position: 'bottom', marginVPct: 9, size: 6, wordsPerLine: 4 } },
        { id: 'square_middle', label: 'Middle', captions: { position: 'middle', size: 7, wordsPerLine: 3 } },
      ]
    case '4:5':
      return [
        { id: 'feed_bottom', label: 'Bottom', captions: { position: 'bottom', marginVPct: 11, size: 6, wordsPerLine: 4 } },
        { id: 'feed_middle', label: 'Middle', captions: { position: 'middle', size: 7, wordsPerLine: 3 } },
      ]
    default:
      return [
        { id: 'shorts_safe', label: 'Shorts safe', captions: { position: 'bottom', marginVPct: 20, wordsPerLine: 3 } },
        { id: 'vertical_middle', label: 'Middle', captions: { position: 'middle', wordsPerLine: 2 } },
      ]
  }
}

const fmt = (ms: number) => {
  const s = Math.max(0, ms) / 1000
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
}

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function LineRow({
  line,
  selected,
  canMerge,
  onSelect,
  onText,
  onSplit,
  onMerge,
  onDelete,
}: {
  line: CaptionLine
  selected: boolean
  canMerge: boolean
  onSelect: () => void
  onText: (t: string) => void
  onSplit: (caret: number | undefined) => void
  onMerge: () => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  const shown = draft ?? line.text
  const commit = () => {
    if (draft !== null && draft.trim() && draft !== line.text) onText(draft)
    setDraft(null)
  }
  return (
    <li
      className={cn('space-y-1 rounded-md border px-2 py-1.5', selected ? 'border-primary bg-primary/5' : 'border-border')}
      data-testid={`caption-line-${line.id}`}
    >
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <button type="button" className="tabular-nums hover:text-foreground" onClick={onSelect} data-testid={`caption-line-time-${line.id}`}>
          {fmt(line.startMs)} – {fmt(line.endMs)}
        </button>
        <span className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="size-6" title="Split at the cursor" aria-label="Split line" onClick={() => onSplit(ref.current?.selectionStart ?? undefined)} data-testid={`caption-line-split-${line.id}`}>
            <Scissors className="size-3.5" aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" className="size-6" title="Merge with the next line" aria-label="Merge with next" disabled={!canMerge} onClick={onMerge} data-testid={`caption-line-merge-${line.id}`}>
            <GitMerge className="size-3.5" aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" className="size-6 text-destructive" title="Delete line" aria-label="Delete line" onClick={onDelete} data-testid={`caption-line-delete-${line.id}`}>
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </span>
      </div>
      {/* G3afix: a line keeps its own line breaks (Shift+Enter) and <i>/<b> tags. */}
      <Textarea
        ref={ref}
        value={shown}
        rows={Math.min(3, shown.split('\n').length)}
        maxLength={CAPTION_LINE_MAX_CHARS + 40}
        onFocus={onSelect}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') setDraft(null)
        }}
        className="min-h-7 resize-none px-2 py-1 text-xs"
        data-testid={`caption-line-text-${line.id}`}
      />
    </li>
  )
}

export function CaptionLinesPanel({
  edits,
  words,
  playheadMs,
  durationMs,
  selectedId,
  onSelect,
  onEdits,
  onSeekOutput,
}: {
  edits: ClipEditsV2
  words: CaptionSourceWord[]
  playheadMs: number
  durationMs: number
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  onEdits: (e: ClipEditsV2) => void
  onSeekOutput?: (ms: number) => void
}) {
  const lines = edits.captionLines ?? []
  const [typed, setTyped] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  // G3afix: an import over existing manual lines waits for Replace / Append.
  const [pending, setPending] = useState<CaptionLine[] | null>(null)
  const [rechunk, setRechunk] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const wpl = Math.max(1, Math.round(edits.captions?.wordsPerLine ?? 3))
  const autoLines = useMemo(() => {
    if (lines.length || !words.length) return []
    const w = buildCaptionWords(words, editorPreviewEdits(edits, words))
    return captionLinesFromWords(w, edits.captions?.wordsPerLine ?? 3)
  }, [edits, words, lines.length])

  const write = (next: CaptionLine[]) => {
    const list = normalizeCaptionLinesEdits(next)
    // Lines only show when captions are on — turning lines on turns captions on.
    onEdits({ ...edits, captionLines: list, captions: list?.length ? { ...edits.captions, enabled: true } : edits.captions })
  }
  const layouts = captionLayoutsFor(edits.aspectRatio)

  return (
    <section className="space-y-3 border-t p-3 text-sm" data-testid="caption-lines-panel">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manual captions</p>
        <p className="text-[11px] text-muted-foreground">
          Type or import your own lines. They replace the auto captions in the video; the style and position above still apply.
        </p>
      </div>

      <div className="space-y-1.5">
        <Textarea
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="One caption per line…"
          className="min-h-[56px] text-xs"
          data-testid="caption-lines-type"
        />
        <Button
          size="sm"
          className="w-full gap-1.5"
          disabled={!typed.trim()}
          onClick={() => {
            const next = addTypedLines(lines, typed, playheadMs, durationMs)
            if (next.length === lines.length) setMsg('No room at the playhead — move the playhead or trim a line.')
            else {
              setMsg(null)
              setTyped('')
            }
            write(next)
          }}
          data-testid="caption-lines-add"
        >
          <Plus className="size-4" aria-hidden />
          Add at playhead
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()} data-testid="caption-lines-import">
          <FileUp className="size-4" aria-hidden />
          Import SRT / VTT
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".srt,.vtt,text/vtt,application/x-subrip"
          className="hidden"
          data-testid="caption-lines-file"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            const raw = parseSubtitles(await f.text(), { durationMs })
            const parsed = rechunk ? rechunkCaptionLines(raw, wpl) : raw
            if (!parsed.length) {
              setPending(null)
              setMsg('No subtitle cues found in that file.')
              return
            }
            if (lines.length) {
              setMsg(null)
              setPending(parsed)
              return
            }
            setMsg(`Imported ${parsed.length} line${parsed.length === 1 ? '' : 's'}.`)
            write(parsed)
          }}
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!autoLines.length}
          title="Copy the current auto captions into editable lines"
          onClick={() => write(autoLines)}
          data-testid="caption-lines-from-auto"
        >
          <Wand2 className="size-4" aria-hidden />
          Edit auto captions
        </Button>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-muted-foreground" data-testid="caption-lines-rechunk">
        <input type="checkbox" checked={rechunk} onChange={(e) => setRechunk(e.target.checked)} data-testid="caption-lines-rechunk-toggle" />
        On import, re-split cues into {wpl} word{wpl === 1 ? '' : 's'} per caption (otherwise each cue keeps its own lines)
      </label>
      {pending ? (
        <div className="space-y-1.5 rounded-md border border-primary/50 bg-primary/5 p-2 text-[11px]" data-testid="caption-lines-import-choice">
          <p>
            The file has {pending.length} line{pending.length === 1 ? '' : 's'}; you already have {lines.length} manual line{lines.length === 1 ? '' : 's'}.
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <Button
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => {
                setMsg(`Replaced with ${pending.length} imported line${pending.length === 1 ? '' : 's'}.`)
                setPending(null)
                write(pending)
              }}
              data-testid="caption-lines-import-replace"
            >
              Replace
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => {
                const next = appendCaptionLines(lines, pending)
                const added = next.length - lines.length
                setMsg(added > 0 ? `Added ${added} line${added === 1 ? '' : 's'} into the gaps.` : 'No gaps for the imported lines — nothing added.')
                setPending(null)
                write(next)
              }}
              data-testid="caption-lines-import-append"
            >
              Append
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setPending(null)} data-testid="caption-lines-import-cancel">
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {msg ? <p className="text-[11px] text-muted-foreground" data-testid="caption-lines-msg">{msg}</p> : null}

      {lines.length ? (
        <ul className="max-h-80 space-y-1 overflow-y-auto" data-testid="caption-lines-list">
          {lines.map((l, i) => (
            <LineRow
              key={l.id}
              line={l}
              selected={l.id === selectedId}
              canMerge={i + 1 < lines.length}
              onSelect={() => {
                onSelect?.(l.id)
                onSeekOutput?.(l.startMs)
              }}
              onText={(t) => write(lines.map((x) => (x.id === l.id ? { ...x, text: t } : x)))}
              onSplit={(caret) => {
                const after = splitCaptionLine(lines, l.id, caret !== undefined && caret > 0 && caret < l.text.length ? { charIndex: caret } : {})
                setMsg(null)
                if (after === lines) setMsg('A line needs two words and 0.2 s to split.')
                else write(after)
              }}
              onMerge={() => write(mergeCaptionLineWithNext(lines, l.id))}
              onDelete={() => {
                const rest = lines.filter((x) => x.id !== l.id)
                if (!rest.length) setMsg(null)
                write(rest)
              }}
            />
          ))}
        </ul>
      ) : null}

      {lines.length ? (
        <Button variant="ghost" size="sm" className="w-full gap-1.5 text-destructive" onClick={() => {
            // G3afix: no stale "Imported N lines." once the lines are gone.
            setMsg(null)
            setPending(null)
            write([])
          }} data-testid="caption-lines-clear">
          <Trash2 className="size-4" aria-hidden />
          Remove manual lines (back to auto captions)
        </Button>
      ) : null}

      <div className="space-y-1">
        <p className="text-[11px] text-muted-foreground">Download subtitles</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['srt', 'SRT', 'application/x-subrip', captionLinesToSrt],
              ['vtt', 'VTT', 'text/vtt', captionLinesToVtt],
              ['txt', 'TXT', 'text/plain', captionLinesToTxt],
            ] as const
          ).map(([ext, label, type, fn]) => (
            <Button
              key={ext}
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={!lines.length && !autoLines.length}
              onClick={() => download(`captions.${ext}`, fn(lines.length ? lines : autoLines), type)}
              data-testid={`caption-lines-download-${ext}`}
            >
              <Download className="size-3.5" aria-hidden />
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] text-muted-foreground">Caption layout ({edits.aspectRatio ?? '9:16'})</p>
        <div className="flex flex-wrap gap-1.5" data-testid="caption-layouts">
          {layouts.map((l) => (
            <Button
              key={l.id}
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => onEdits({ ...edits, captions: { ...edits.captions, ...l.captions, enabled: true } })}
              data-testid={`caption-layout-${l.id}`}
            >
              {l.label}
            </Button>
          ))}
        </div>
      </div>
    </section>
  )
}
