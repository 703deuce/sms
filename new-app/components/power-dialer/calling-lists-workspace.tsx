'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/app/page-primitives'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { createPowerList, fetchPowerLists, type PowerListDto } from '@/lib/phone-api'
import { formatWhen } from '@/lib/format'
import { CsvImportWizard } from '@/components/power-dialer/csv-import-wizard'
import { CrmImportDialog } from '@/components/power-dialer/crm-import-dialog'

export function CallingListsWorkspace() {
  const [rows, setRows] = useState<PowerListDto[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [importListId, setImportListId] = useState<string | null>(null)
  const [crmImportListId, setCrmImportListId] = useState<string | null>(null)
  const [crmConnected, setCrmConnected] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    void fetchPowerLists()
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load lists'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    void fetch('/api/phone/power-dialer/lists/crm-sources')
      .then((r) => r.json())
      .then((j) => setCrmConnected((j.data?.connected?.length ?? 0) > 0))
      .catch(() => setCrmConnected(false))
  }, [])

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true
    const s = q.toLowerCase()
    return r.name.toLowerCase().includes(s) || r.source.toLowerCase().includes(s)
  })

  const onCreate = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    try {
      await createPowerList(name.trim(), description.trim() || undefined)
      toast.success('List created')
      setCreateOpen(false)
      setName('')
      setDescription('')
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    }
  }

  return (
    <>
      <Panel
        title="Calling lists"
        description="List membership is stored here; contact records live in shared Contacts."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus />
              New list
            </Button>
          </div>
        }
      >
        <div className="mb-4">
          <Input
            className="max-w-xs"
            placeholder="Search lists"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search lists"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium" scope="col">Name</th>
                <th className="px-3 py-2 font-medium" scope="col">Contacts</th>
                <th className="px-3 py-2 font-medium" scope="col">Source</th>
                <th className="px-3 py-2 font-medium" scope="col">Updated</th>
                <th className="px-3 py-2 font-medium" scope="col">Campaigns</th>
                <th className="px-3 py-2 font-medium" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className="px-3 py-8 text-muted-foreground" colSpan={6}>Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td className="px-3 py-8 text-muted-foreground" colSpan={6}>No lists yet.</td></tr>
              )}
              {filtered.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="px-3 py-3 font-medium">
                    <Link href={`/app/power-dialer/calling-lists/${l.id}`} className="hover:text-primary">
                      {l.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{l.total}</td>
                  <td className="px-3 py-3 text-muted-foreground">{l.source}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{formatWhen(l.updated)}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {l.campaignUsage?.length ? l.campaignUsage.map((c) => c.name).join(', ') : '—'}
                  </td>
                  <td className="px-3 py-3 flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setImportListId(l.id)}>
                      <Upload className="size-4" />
                      Import CSV
                    </Button>
                    {crmConnected && (
                      <Button variant="ghost" size="sm" onClick={() => setCrmImportListId(l.id)}>
                        Import from CRM
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New calling list</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input placeholder="List name" value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => void onCreate()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {crmImportListId && (
        <CrmImportDialog
          listId={crmImportListId}
          open={!!crmImportListId}
          onOpenChange={(open) => { if (!open) setCrmImportListId(null) }}
          onDone={() => { setCrmImportListId(null); reload() }}
        />
      )}
      {importListId && (
        <CsvImportWizard
          listId={importListId}
          open={!!importListId}
          onOpenChange={(open) => { if (!open) setImportListId(null) }}
          onComplete={() => { setImportListId(null); reload() }}
        />
      )}
    </>
  )
}
