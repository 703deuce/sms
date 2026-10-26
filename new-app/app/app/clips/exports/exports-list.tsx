'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { EmptyState, Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { AspectGlyph } from '@/components/clips/ui/aspect-glyph'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { ExportRenderRow } from '@/lib/clips-api'
import { retryExportRender } from '@/lib/clips-api'
import { Download, RotateCcw } from 'lucide-react'

type Filter = 'all' | 'ready' | 'failed'

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
}

function formatSize(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function parseResolution(res: string): '720p' | '1080p' {
  return res.includes('1080') ? '1080p' : '720p'
}

function parseAspect(aspect: string): '9:16' | '1:1' | '16:9' {
  if (aspect === '1:1' || aspect === '16:9') return aspect
  return '9:16'
}

export function formatUtcFallback(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { ...DATE_OPTS, timeZone: 'UTC' }).format(new Date(iso))
  } catch {
    return '—'
  }
}

function ClientTime({ iso }: { iso: string | null }) {
  const [text, setText] = useState(() => (iso ? formatUtcFallback(iso) : '—'))
  useEffect(() => {
    if (!iso) {
      setText('—')
      return
    }
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) {
      setText('—')
      return
    }
    try {
      setText(new Intl.DateTimeFormat(undefined, DATE_OPTS).format(d))
    } catch {
      setText('—')
    }
  }, [iso])
  return (
    <time dateTime={iso ?? undefined} suppressHydrationWarning>
      {text}
    </time>
  )
}

function AspectResolution({ aspect, resolution }: { aspect: string; resolution: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
        <AspectGlyph ratio={aspect} />
        {aspect}
      </span>
      <span className="tabular-nums">{resolution}</span>
    </span>
  )
}

export function ExportsList({
  initialRows,
  filter,
}: {
  initialRows: ExportRenderRow[]
  filter: Filter
}) {
  const router = useRouter()
  const rows = initialRows
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const readyIds = useMemo(() => rows.filter((r) => r.status === 'READY' && r.downloadUrl).map((r) => r.id), [rows])

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllReady = () => {
    setSelected((prev) => {
      if (prev.size === readyIds.length) return new Set()
      return new Set(readyIds)
    })
  }

  const downloadSelected = () => {
    const picks = rows.filter((r) => selected.has(r.id) && r.downloadUrl)
    if (!picks.length) {
      toast.error('No ready downloads selected')
      return
    }
    for (const r of picks) {
      const a = document.createElement('a')
      a.href = r.downloadUrl!
      a.download = r.filename
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
    toast.success(`Started ${picks.length} download${picks.length === 1 ? '' : 's'}`)
  }

  const onRetry = async (r: ExportRenderRow) => {
    try {
      await retryExportRender(r.clipId, {
        resolution: parseResolution(r.resolution),
        aspect: parseAspect(r.aspectRatio),
        watermark: r.watermark,
      })
      toast.success('Export re-queued', {
        action: { label: 'View', onClick: () => router.push('/app/clips/exports') },
      })
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Retry failed')
    }
  }

  if (!rows.length) {
    return (
      <EmptyState
        icon={Download}
        title="No exports yet"
        description="Exports appear here after you download clips from a project."
      />
    )
  }

  return (
    <Panel title="Exports" description="Rendered downloads for your workspace.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['all', 'ready', 'failed'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            render={
              <Link
                href={f === 'all' ? '/app/clips/exports' : `/app/clips/exports?status=${f}`}
              />
            }
          >
            {f === 'all' ? 'All' : f === 'ready' ? 'Ready' : 'Failed'}
          </Button>
        ))}
        {readyIds.length > 0 ? (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={toggleAllReady}>
              {selected.size === readyIds.length ? 'Clear selection' : 'Select ready'}
            </Button>
            <Button size="sm" disabled={selected.size === 0} onClick={downloadSelected}>
              <Download className="size-4" aria-hidden />
              Download selected ({selected.size})
            </Button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => (
          <article key={r.id} className="rounded-xl border border-border bg-card p-3 shadow-xs">
            <div className="flex gap-3">
              {r.status === 'READY' && r.downloadUrl ? (
                <Checkbox
                  checked={selected.has(r.id)}
                  onCheckedChange={() => toggleRow(r.id)}
                  aria-label={`Select ${r.title}`}
                />
              ) : (
                <span className="w-4" />
              )}
              {r.posterUrl ? (
                <img src={r.posterUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="size-14 shrink-0 rounded-lg bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <Link href={r.editorUrl} className="line-clamp-2 text-sm font-medium hover:text-primary">
                  {r.title}
                </Link>
                <div className="mt-1">
                  <AspectResolution aspect={r.aspectRatio} resolution={r.resolution} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">{formatSize(r.sizeBytes)}</p>
                {r.status === 'FAILED' && r.error ? (
                  <p className="mt-2 text-xs text-destructive">{r.error}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge tone={r.status === 'READY' ? 'success' : r.status === 'FAILED' ? 'danger' : 'info'}>
                    {r.status}
                  </StatusBadge>
                  {r.downloadUrl ? (
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<a href={r.downloadUrl} download={r.filename} />}
                    >
                      Download
                    </Button>
                  ) : null}
                  {r.status === 'FAILED' ? (
                    <Button size="sm" variant="outline" onClick={() => void onRetry(r)}>
                      <RotateCcw className="size-3.5" aria-hidden />
                      Retry
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium w-10">
                {readyIds.length ? (
                  <Checkbox
                    checked={selected.size > 0 && selected.size === readyIds.length}
                    onCheckedChange={toggleAllReady}
                    aria-label="Select all ready exports"
                  />
                ) : null}
              </th>
              <th className="px-3 py-2 font-medium">Clip</th>
              <th className="px-3 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium">Format</th>
              <th className="px-3 py-2 font-medium">Watermark</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Expires</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Size</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  {r.status === 'READY' && r.downloadUrl ? (
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggleRow(r.id)}
                      aria-label={`Select ${r.title}`}
                    />
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {r.posterUrl ? (
                      <img src={r.posterUrl} alt="" className="size-10 rounded object-cover" />
                    ) : (
                      <div className="size-10 rounded bg-muted" />
                    )}
                    <div className="min-w-0">
                      <Link href={r.editorUrl} className="line-clamp-2 max-w-[180px] font-medium hover:underline">
                        {r.title}
                      </Link>
                      {r.status === 'FAILED' && r.error ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-destructive">{r.error}</p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  <Link href={`/app/clips/${r.projectId}`} className="hover:underline">
                    {r.projectId.slice(0, 12)}…
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <AspectResolution aspect={r.aspectRatio} resolution={r.resolution} />
                </td>
                <td className="px-3 py-2">{r.watermark ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  <ClientTime iso={r.createdAt} />
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  <ClientTime iso={r.expiresAt} />
                </td>
                <td className="px-3 py-2">
                  <StatusBadge
                    tone={r.status === 'READY' ? 'success' : r.status === 'FAILED' ? 'danger' : 'info'}
                  >
                    {r.status}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2 tabular-nums">{formatSize(r.sizeBytes)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {r.downloadUrl ? (
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<a href={r.downloadUrl} download={r.filename} />}
                      >
                        Download
                      </Button>
                    ) : r.status === 'FAILED' ? (
                      <Button size="sm" variant="outline" onClick={() => void onRetry(r)}>
                        <RotateCcw className="size-3.5" aria-hidden />
                        Retry
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
