'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { EmptyState, Panel } from '@/components/app/page-primitives'
import { Button } from '@/components/ui/button'
import { listRenders, type ExportRenderRow } from '@/lib/clips-api'
import { Download } from 'lucide-react'

type Filter = 'all' | 'ready' | 'failed'

function formatSize(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function ClientTime({ iso }: { iso: string | null }) {
  const [text, setText] = useState('—')
  useEffect(() => {
    if (!iso) {
      setText('—')
      return
    }
    setText(
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZoneName: 'short',
      }).format(new Date(iso)),
    )
  }, [iso])
  return <>{text}</>
}

export function ExportsList({ initialRows }: { initialRows: ExportRenderRow[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const filter = (searchParams.get('status') || 'all') as Filter
  const [rows, setRows] = useState<ExportRenderRow[]>(initialRows)
  const [loading, setLoading] = useState(false)

  const setFilter = useCallback(
    (f: Filter) => {
      const q = new URLSearchParams(searchParams.toString())
      if (f === 'all') q.delete('status')
      else q.set('status', f)
      router.replace(`/app/clips/exports?${q.toString()}`)
    },
    [router, searchParams],
  )

  useEffect(() => {
    setLoading(true)
    void listRenders(filter)
      .then((d) => setRows(d.exports))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [filter])

  if (loading && !rows.length) {
    return (
      <Panel title="Exports" description="Rendered downloads for your workspace.">
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </Panel>
    )
  }

  if (!loading && !rows.length) {
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
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'ready' ? 'Ready' : 'Failed'}
          </Button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
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
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 tabular-nums">{formatSize(r.sizeBytes)}</td>
                <td className="px-3 py-2">
                  {r.downloadUrl ? (
                    <Button size="sm" variant="outline" render={<a href={r.downloadUrl} download={r.filename} />}>
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
