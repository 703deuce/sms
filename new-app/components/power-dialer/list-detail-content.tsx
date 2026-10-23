'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/app/page-primitives'
import { archivePowerList, fetchPowerListDetail, type PowerListDetailDto } from '@/lib/phone-api'
import { formatPhone, formatWhen } from '@/lib/format'
import { CsvImportWizard } from '@/components/power-dialer/csv-import-wizard'

export function ListDetailContent({ listId }: { listId: string }) {
  const [data, setData] = useState<PowerListDetailDto | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [importOpen, setImportOpen] = useState(false)

  const load = useCallback(() => {
    void fetchPowerListDetail(listId, { page, q })
      .then(setData)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load list'))
  }, [listId, page, q])

  useEffect(() => {
    load()
  }, [load])

  const onArchive = async () => {
    if (!confirm('Archive this list? Campaigns keep historical data.')) return
    try {
      await archivePowerList(listId)
      toast.success('List archived')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Archive failed')
    }
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Loading list…</p>
  }

  const pageCount = Math.max(1, Math.ceil(data.filteredTotal / data.pageSize))

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/app/power-dialer/calling-lists" className="text-primary hover:underline">← Calling lists</Link>
      </div>
      <Panel
        title={data.name}
        description={`${data.total} contacts · Source: ${data.source} · Updated ${formatWhen(data.updatedAt)}`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload />
              Import CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void onArchive()}>Archive</Button>
          </div>
        }
      >
        {data.campaigns.length > 0 && (
          <p className="mb-3 text-xs text-muted-foreground">
            Used in: {data.campaigns.map((c) => c.name).join(', ')}
          </p>
        )}
        <Input
          className="mb-4 max-w-xs"
          placeholder="Search contacts"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1) }}
          aria-label="Search contacts in list"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-2 py-2" scope="col">Name</th>
                <th className="px-2 py-2" scope="col">Phone</th>
                <th className="px-2 py-2" scope="col">Company</th>
                <th className="px-2 py-2" scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.contacts.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No contacts on this page.</td></tr>
              )}
              {data.contacts.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="px-2 py-2">{[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-2 py-2 font-mono text-xs">{formatPhone(c.phone)}</td>
                  <td className="px-2 py-2 text-muted-foreground">{c.company || '—'}</td>
                  <td className="px-2 py-2 text-xs">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {data.page} of {pageCount} ({data.filteredTotal} matching)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Panel>
      <CsvImportWizard listId={listId} open={importOpen} onOpenChange={setImportOpen} onComplete={load} />
    </>
  )
}
