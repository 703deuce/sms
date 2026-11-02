'use client'

import { useEffect, useMemo, useState } from 'react'
import { FreeToolBadge } from '@/components/clips/ui/free-tool-badge'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SpeechSearchHit } from '@/lib/clips/editor/speech-search'
import { insertMediaAt } from '@/lib/clips/editor/media-add'
import type { ProjectMediaApi } from '@/components/clips/editor/use-project-media'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { MediaTranscribeControl } from '@/components/clips/editor/media-transcribe-control'
import { clipsFetch } from '@/lib/clips-api'

export function SpeechSearchSection({
  projectId,
  edits,
  media,
  playheadSourceMs,
  onSeekSource,
  onEdits,
  onAddToSelects,
}: {
  projectId: string
  edits: ClipEditsV2
  media: ProjectMediaApi
  playheadSourceMs: number
  onSeekSource: (sourceMs: number) => void
  onEdits: (next: ClipEditsV2) => void
  onAddToSelects?: (hit: SpeechSearchHit) => void | Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [hits, setHits] = useState<SpeechSearchHit[]>([])
  const [untranscribed, setUntranscribed] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 300)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (debounced.length < 2) {
      setHits([])
      setUntranscribed(0)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await clipsFetch<{ hits: SpeechSearchHit[]; untranscribed: number }>(
          `/api/clips/projects/${projectId}/speech-search?q=${encodeURIComponent(debounced)}`,
        )
        if (cancelled) return
        setHits(res.hits ?? [])
        setUntranscribed(res.untranscribed ?? 0)
      } catch {
        if (!cancelled) {
          setHits([])
          setUntranscribed(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [debounced, projectId])

  const untranscribedItems = useMemo(
    () =>
      media.items.filter((item) => {
        if (item.isMain || item.mediaType !== 'video') return false
        const tr = media.transcripts?.find((t) => t.refId === item.refId && t.ref === item.ref)
        return tr?.status !== 'done'
      }),
    [media.items, media.transcripts],
  )

  const mainInsideTrim = (hit: SpeechSearchHit) => {
    const ms = hit.startS * 1000
    return ms >= edits.trim.in && ms < edits.trim.out
  }

  const resolveMediaItem = (hit: SpeechSearchHit): ProjectMediaItem | undefined => {
    if (hit.kind === 'main') return undefined
    return media.items.find((m) => `${m.ref}:${m.refId}` === hit.sourceId)
  }

  const insertHit = (hit: SpeechSearchHit) => {
    const item = resolveMediaItem(hit)
    if (!item) return
    const spanMs = Math.max(500, Math.round((hit.endS - hit.startS) * 1000 + 1000))
    const res = insertMediaAt(edits, item, playheadSourceMs, 'insert', () => crypto.randomUUID(), spanMs)
    if (!res.edits) {
      toast.message(res.message ?? 'Could not insert')
      return
    }
    onEdits(res.edits)
    toast.message(
      res.message ??
        `Inserted ${item.label} at the playhead (full clip — trim to the phrase manually if needed)`,
    )
  }

  return (
    <section className="space-y-2 rounded-md border p-2" data-testid="speech-search-section">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <span>Search what was said</span>
        <FreeToolBadge />
      </div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Phrase across this project…"
        data-testid="speech-search-input"
        className="h-8 text-xs"
      />
      {loading && debounced.length >= 2 ? (
        <p className="text-[11px] text-muted-foreground">Searching…</p>
      ) : null}
      {!loading && debounced.length >= 2 && hits.length === 0 ? (
        <p className="text-[11px] text-muted-foreground" data-testid="speech-search-no-matches">
          No matches
        </p>
      ) : null}
      {untranscribed > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {untranscribed} media not searchable yet
        </p>
      ) : null}
      {untranscribedItems.slice(0, 3).map((item) => (
        <div key={item.id} className="flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{item.label}</span>
          <MediaTranscribeControl media={media} item={item} />
        </div>
      ))}
      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {hits.map((hit, i) => (
          <li
            key={`${hit.sourceId}-${hit.startS}-${i}`}
            className="flex items-start justify-between gap-2 rounded border border-border/60 px-2 py-1 text-[11px]"
            data-testid="speech-search-hit"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{hit.label}</div>
              <div className="text-muted-foreground">{hit.snippet}</div>
              {hit.kind === 'main' && !mainInsideTrim(hit) ? (
                <span className="text-[10px] text-amber-600">Outside this clip</span>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              {onAddToSelects ? (
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  data-testid="speech-search-add-select"
                  onClick={() => void onAddToSelects(hit)}
                >
                  Add to selects
                </Button>
              ) : null}
              {hit.kind === 'main' ? (
                mainInsideTrim(hit) ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => onSeekSource(Math.round(hit.startS * 1000))}
                  >
                    Go
                  </Button>
                ) : null
              ) : (
                <Button type="button" size="xs" variant="outline" onClick={() => insertHit(hit)}>
                  Insert at playhead
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
