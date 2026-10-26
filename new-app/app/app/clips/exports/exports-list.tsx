'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { EmptyState, Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import type { ExportRenderRow } from '@/lib/clips-api'
import { Download } from 'lucide-react'

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

export function ExportsList({
  initialRows,
  filter,
}: {
  initialRows: ExportRenderRow[]
  filter: Filter
}) {
  const rows = initialRows

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
      <div className="mb-4 flex flex-wrap gap-2">
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
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => (
          <article key={r.id} className="rounded-xl border border-border bg-card p-3 shadow-xs">
            <div className="flex gap-3">
              {r.posterUrl ? (
                <img src={r.posterUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="size-14 shrink-0 rounded-lg bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <Link href={r.editorUrl} className="line-clamp-2 text-sm font-medium hover:text-primary">
                  {r.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">{r.resolution} · {formatSize(r.sizeBytes)}</p>
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
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Clip</th>
              <th className="px-3 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium">Resolution</th>
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
                  <div className="flex items-center gap-2">
                    {r.posterUrl ? (
                      <img src={r.posterUrl} alt="" className="size-10 rounded object-cover" />
                    ) : (
                      <div className="size-10 rounded bg-muted" />
                    )}
                    <Link href={r.editorUrl} className="line-clamp-2 max-w-[180px] font-medium hover:underline">
                      {r.title}
                    </Link>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  <Link href={`/app/clips/${r.projectId}`} className="hover:underline">
                    {r.projectId.slice(0, 12)}…
                  </Link>
                </td>
                <td className="px-3 py-2 tabular-nums">{r.resolution}</td>
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
                  {r.downloadUrl ? (
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<a href={r.downloadUrl} download={r.filename} />}
                    >
                      Download
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
