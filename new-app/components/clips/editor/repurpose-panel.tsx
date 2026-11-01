'use client'

import { useState } from 'react'
import { Copy, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'
import { editsVersionHash, outputDurationMs, type ClipEditsV2 } from '@/lib/clips/edits'
import { chaptersToMarkers, formatYoutubeChapters } from '@/lib/clips/repurpose'
import { ClipPostCopy } from '@/components/clips/clip-post-copy'

type RepurposeMeta = {
  chapters?: { outMs: number; label: string }[]
  showNotes?: { summary: string; bullets: string[] }
  editsHash?: string
  generatedAt?: string
}

export function RepurposePanel({
  clipId,
  edits,
  aiMeta,
  onCommitEdits,
}: {
  clipId: string
  edits: ClipEditsV2
  aiMeta?: unknown
  onCommitEdits: (next: ClipEditsV2) => void
}) {
  const lengthMs = outputDurationMs(edits)
  const minOk = lengthMs >= 120_000
  const hash = editsVersionHash(edits)
  const stored = (aiMeta as { repurpose?: RepurposeMeta } | null)?.repurpose
  const stale = stored?.editsHash && stored.editsHash !== hash
  const [chapters, setChapters] = useState(stored?.chapters)
  const [showNotes, setShowNotes] = useState(stored?.showNotes)
  const [busy, setBusy] = useState<'chapters' | 'notes' | null>(null)
  const chapterRows = chapters ?? stored?.chapters
  const noteRows = showNotes ?? stored?.showNotes

  const run = async (kind: 'chapters' | 'show_notes') => {
    setBusy(kind === 'chapters' ? 'chapters' : 'notes')
    try {
      const res = await clipsFetch<{ chapters?: RepurposeMeta['chapters']; showNotes?: RepurposeMeta['showNotes'] }>(
        `/api/clips/clips/${clipId}/repurpose`,
        { method: 'POST', body: JSON.stringify({ kind }) },
      )
      if (res.chapters) setChapters(res.chapters)
      if (res.showNotes) setShowNotes(res.showNotes)
      toast.success('Generated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  const copyYt = async () => {
    if (!chapterRows?.length) return
    await navigator.clipboard.writeText(formatYoutubeChapters(chapterRows))
    toast.success('YouTube chapters copied')
  }

  const copyNotes = async () => {
    if (!noteRows) return
    const lines = [noteRows.summary, '', ...noteRows.bullets.filter(Boolean).map((b) => `- ${b}`)]
    if (chapterRows?.length) {
      lines.push('', '## Chapters', ...formatYoutubeChapters(chapterRows).split('\n'))
    }
    await navigator.clipboard.writeText(lines.join('\n').trim())
    toast.success('Show notes copied')
  }

  const downloadNotes = () => {
    if (!noteRows) return
    const body = [noteRows.summary, '', ...noteRows.bullets.filter(Boolean).map((b) => `- ${b}`)]
    if (chapterRows?.length) {
      body.push('', 'Chapters', formatYoutubeChapters(chapterRows))
    }
    const blob = new Blob([body.join('\n').trim()], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'show-notes.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const addMarkers = () => {
    if (!chapterRows?.length) return
    onCommitEdits(chaptersToMarkers(edits, chapterRows))
    toast.success('Markers added')
  }

  return (
    <div className="space-y-4 p-3" data-testid="repurpose-tab">
      {stale ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">Edits changed since these were generated — Regenerate</p>
      ) : null}
      <section>
        <h3 className="text-sm font-medium">Chapters</h3>
        {!minOk ? <p className="text-xs text-muted-foreground">Chapters need at least 2 minutes</p> : null}
        <Button
          size="sm"
          className="mt-2"
          disabled={!minOk || busy !== null}
          data-testid="repurpose-chapters-generate"
          onClick={() => void run('chapters')}
        >
          <Sparkles className="mr-1 size-3.5" />
          {busy === 'chapters' ? '…' : 'Generate chapters'}
        </Button>
        {chapterRows?.length ? (
          <ul className="mt-2 space-y-1 text-xs">
            {chapterRows.map((c) => (
              <li key={c.outMs}>
                {Math.floor(c.outMs / 1000)}s — {c.label}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!chapterRows?.length} data-testid="repurpose-chapters-copy-yt" onClick={() => void copyYt()}>
            <Copy className="mr-1 size-3" /> Copy for YouTube
          </Button>
          <Button size="sm" variant="outline" disabled={!chapterRows?.length} data-testid="repurpose-chapters-markers" onClick={addMarkers}>
            Add as markers
          </Button>
        </div>
      </section>
      <section>
        <h3 className="text-sm font-medium">Show notes</h3>
        <Button
          size="sm"
          className="mt-2"
          disabled={!minOk || busy !== null}
          data-testid="repurpose-notes-generate"
          onClick={() => void run('show_notes')}
        >
          {busy === 'notes' ? '…' : 'Generate show notes'}
        </Button>
        {noteRows ? (
          <div className="mt-2 text-xs text-muted-foreground">
            <p>{noteRows.summary}</p>
            <ul className="mt-1 list-disc pl-4">
              {noteRows.bullets.filter(Boolean).map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!noteRows} data-testid="repurpose-notes-copy" onClick={() => void copyNotes()}>
            <Copy className="mr-1 size-3" /> Copy show notes
          </Button>
          <Button size="sm" variant="outline" disabled={!noteRows} onClick={downloadNotes}>
            Download .txt
          </Button>
        </div>
      </section>
      <section>
        <h3 className="text-sm font-medium">Social</h3>
        <ClipPostCopy clipId={clipId} aiMeta={aiMeta} />
      </section>
    </div>
  )
}
