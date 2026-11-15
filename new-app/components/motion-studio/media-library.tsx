'use client'

import { useRef, useState } from 'react'
import { AudioLines, FileText, Film, ImageIcon, Loader2, Replace, ScanFace, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MediaThumb } from '@/components/clips/editor/media-panel'
import { EmptyState } from '@/components/app/page-primitives'
import { cn } from '@/lib/utils'
import { MS_UPLOAD_ACCEPT } from '@/lib/motion-studio/config'
import { formatShortClock } from '@/lib/motion-studio/format'
import type { MsAsset, MsProject } from '@/lib/motion-studio/types'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'

const KIND_ICON = { photo: ImageIcon, video: Film, audio: AudioLines, script: FileText } as const
const KIND_LABEL = { photo: 'Photo', video: 'Video', audio: 'Audio', script: 'Script' } as const

/** Adapter so the editor's existing MediaThumb renders Motion Studio assets. */
function asMediaItem(a: MsAsset): ProjectMediaItem {
  return {
    id: a.id,
    ref: 'upload',
    refId: a.id,
    mediaType: a.kind === 'photo' ? 'image' : a.kind === 'video' ? 'video' : 'audio',
    label: a.label,
    durationMs: a.durationMs ?? null,
    width: null,
    height: null,
    url: a.url ?? null,
    syncMs: null,
    syncStatus: 'none',
  }
}

/** Media Library (ST-UI-105): opens mid-production; v1 shows uploads + analysis; Replace swaps in another upload. */
export function MediaLibrary({
  project,
  busy,
  onUpload,
  onReplace,
  uploads,
}: {
  project: MsProject
  busy: string | null
  onUpload: (files: File[]) => void
  onReplace: (assetId: string, withAssetId: string) => void
  uploads: { key: string; name: string; percent: number; error?: string | null }[]
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [replacing, setReplacing] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | MsAsset['kind']>('all')
  const chapters = project.story?.chapters ?? []
  const chapterTitle = (id?: string | null) => chapters.find((c) => c.id === id)?.title ?? null
  const shown = project.assets.filter((a) => filter === 'all' || a.kind === filter)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" data-testid="ms-media-library">
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'video', 'photo', 'audio'] as const).map((f) => (
          <Button key={f} size="xs" variant={filter === f ? 'secondary' : 'ghost'} onClick={() => setFilter(f)} aria-pressed={filter === f}>
            {f === 'all' ? 'All' : KIND_LABEL[f]}
          </Button>
        ))}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => fileRef.current?.click()} data-testid="ms-library-upload">
          <Upload className="size-3.5" aria-hidden />
          Add media
        </Button>
        <input ref={fileRef} type="file" multiple accept={MS_UPLOAD_ACCEPT} className="hidden" onChange={(e) => { if (e.target.files?.length) onUpload([...e.target.files]); e.target.value = '' }} />
      </div>

      {uploads.length ? (
        <ul className="flex flex-col gap-1.5" aria-label="Uploads in progress">
          {uploads.map((u) => (
            <li key={u.key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              {u.error ? <span className="text-destructive">{u.error}</span> : <span className="tabular-nums text-muted-foreground">{u.percent}%</span>}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {!shown.length ? (
          <EmptyState icon={Film} title="No media yet" description="Upload photos, clips or music. The director uses them where they fit the story." />
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((a) => {
              const Icon = KIND_ICON[a.kind]
              const candidates = project.assets.filter((x) => x.id !== a.id && x.kind === a.kind)
              return (
                <li key={a.id} className="rounded-xl border border-border bg-card p-3" data-testid="ms-asset">
                  <div className="flex gap-3">
                    <div className="w-24 shrink-0">
                      <MediaThumb item={asMediaItem(a)} className="h-14 w-24" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <p className="truncate text-sm font-medium" title={a.label}>{a.label}</p>
                        {a.durationMs ? <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">{formatShortClock(a.durationMs)}</span> : null}
                      </div>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {a.analysis.status === 'ready' ? (
                          a.analysis.summary ?? 'Analyzed'
                        ) : a.analysis.status === 'failed' ? (
                          <span className="text-destructive">Analysis failed</span>
                        ) : (
                          <>
                            <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />
                            {a.analysis.status === 'queued' ? 'Queued for analysis' : 'Analyzing…'}
                          </>
                        )}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {a.analysis.faces ? <Badge variant="outline" className="gap-1"><ScanFace className="size-3" aria-hidden />{a.analysis.faces} face group{a.analysis.faces === 1 ? '' : 's'}</Badge> : null}
                        {a.analysis.shots ? <Badge variant="outline">{a.analysis.shots} shots</Badge> : null}
                        {(a.analysis.objects ?? []).map((o) => <Badge key={o} variant="outline">{o}</Badge>)}
                      </div>
                      {a.analysis.transcriptExcerpt ? <p className="mt-1.5 line-clamp-2 text-xs text-foreground/80 italic">{a.analysis.transcriptExcerpt}</p> : null}
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <dt className="text-muted-foreground">Intended use</dt>
                        <dd className="truncate">{a.intendedUse ?? (a.role === 'music' ? 'Music bed' : a.role === 'narration' ? 'Narration' : 'Not placed yet')}</dd>
                        <dt className="text-muted-foreground">Chapter</dt>
                        <dd className="truncate">{chapterTitle(a.chapterId) ?? '—'}</dd>
                        <dt className="text-muted-foreground">Used in</dt>
                        <dd className="tabular-nums">{a.sceneIds.length ? `${a.sceneIds.length} scene${a.sceneIds.length === 1 ? '' : 's'}` : '—'}</dd>
                        <dt className="text-muted-foreground">Source</dt>
                        <dd>Your upload</dd>
                      </dl>
                    </div>
                  </div>
                  {a.kind !== 'script' ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/70 pt-2">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={!candidates.length || busy != null || !a.sceneIds.length}
                        onClick={() => setReplacing(replacing === a.id ? null : a.id)}
                        aria-expanded={replacing === a.id}
                        data-testid="ms-asset-replace"
                        title={!a.sceneIds.length ? 'Not used in any scene yet' : !candidates.length ? `Upload another ${KIND_LABEL[a.kind].toLowerCase()} to replace this one` : undefined}
                      >
                        <Replace className="size-3" aria-hidden />
                        Replace
                      </Button>
                      {replacing === a.id ? (
                        <div className="flex flex-wrap gap-1" role="group" aria-label={`Replace ${a.label} with`}>
                          {candidates.map((c) => (
                            <Button
                              key={c.id}
                              size="xs"
                              variant="secondary"
                              onClick={() => {
                                onReplace(a.id, c.id)
                                setReplacing(null)
                              }}
                            >
                              {c.label}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}

        {project.missingVisuals.length ? (
          <section className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-3" aria-labelledby="ms-missing-title">
            <h3 id="ms-missing-title" className="text-sm font-medium">Missing visuals</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {project.missingVisuals.map((m) => (
                <li key={m.id} className={cn('text-xs leading-relaxed text-foreground/90')}>
                  <span className="font-medium">{chapterTitle(m.chapterId) ?? 'Chapter'}:</span> {m.description}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}
