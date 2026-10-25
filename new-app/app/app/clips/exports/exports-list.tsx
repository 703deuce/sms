'use client'

import { useEffect, useState } from 'react'
import { EmptyState, Panel } from '@/components/app/page-primitives'
import { Button } from '@/components/ui/button'
import { listExports } from '@/lib/clips-api'
import { Download } from 'lucide-react'

export function ExportsList() {
  const [rows, setRows] = useState<{ id: string; title: string; filename: string | null; downloadUrl: string | null; createdAt: string }[]>([])

  useEffect(() => {
    void listExports()
      .then((d) => setRows(d.exports))
      .catch(() => setRows([]))
  }, [])

  if (!rows.length) {
    return <EmptyState icon={Download} title="No exports yet" description="Exports appear here after you download clips from a project." />
  }

  return (
    <Panel title="Recent exports" description="Signed links expire after about an hour.">
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</p>
            </div>
            {r.downloadUrl ? (
              <Button size="sm" variant="outline" render={<a href={r.downloadUrl} download={r.filename || undefined} />}>
                Download
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  )
}
