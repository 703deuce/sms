'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/app/page-primitives'
import {
  archivePowerList,
  addListContactsToCampaign,
  fetchPowerCampaigns,
  fetchPowerListDetail,
  patchListMembers,
  saveListFilters,
  searchContactsApi,
  type PowerListDetailDto,
} from '@/lib/phone-api'
import { formatPhone, formatWhen } from '@/lib/format'
import { CsvImportWizard } from '@/components/power-dialer/csv-import-wizard'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ListDetailContent({ listId }: { listId: string }) {
  const [data, setData] = useState<PowerListDetailDto | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [importOpen, setImportOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [contactQ, setContactQ] = useState('')
  const [searchHits, setSearchHits] = useState<{ id: string; name: string; phone: string }[]>([])
  const [filterName, setFilterName] = useState('')
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])
  const [campaignPickOpen, setCampaignPickOpen] = useState(false)
  const [targetCampaignId, setTargetCampaignId] = useState('')

  const load = useCallback(() => {
    void fetchPowerListDetail(listId, { page, q })
      .then(setData)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load list'))
  }, [listId, page, q])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    void fetchPowerCampaigns()
      .then((rows) => setCampaigns(rows.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!contactQ.trim()) {
      setSearchHits([])
      return
    }
    void searchContactsApi(contactQ).then((rows) =>
      setSearchHits(rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone }))),
    )
  }, [contactQ])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onArchive = async () => {
    if (!confirm('Archive this list? Campaigns keep historical data.')) return
    try {
      await archivePowerList(listId)
      toast.success('List archived')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Archive failed')
    }
  }

  const bulkAddToCampaign = async () => {
    if (!selected.size || !targetCampaignId) return
    try {
      const r = await addListContactsToCampaign(listId, targetCampaignId, [...selected])
      toast.success(`Added ${r.added} contact(s) to campaign list`)
      setCampaignPickOpen(false)
      setSelected(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add to campaign failed')
    }
  }

  const bulkRemove = async () => {
    if (!selected.size) return
    try {
      await patchListMembers(listId, 'remove', [...selected])
      toast.success('Removed from list')
      setSelected(new Set())
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed')
    }
  }

  const addContact = async (contactId: string) => {
    try {
      await patchListMembers(listId, 'add', [contactId])
      toast.success('Contact added')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed')
    }
  }

  const saveFilter = async () => {
    if (!filterName.trim()) return
    const filters = Array.isArray(data?.filtersJson) ? [...(data!.filtersJson as object[])] : []
    filters.push({ name: filterName, q })
    try {
      await saveListFilters(listId, filters)
      toast.success('Filter saved')
      setFilterName('')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save filter failed')
    }
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Loading list…</p>
  }

  const pageCount = Math.max(1, Math.ceil(data.filteredTotal / data.pageSize))
  const savedFilters = Array.isArray(data.filtersJson) ? (data.filtersJson as { name: string; q?: string }[]) : []

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/app/power-dialer/calling-lists" className="text-primary hover:underline">← Calling lists</Link>
      </div>
      <Panel
        title={data.name}
        description={`${data.total} contacts · Source: ${data.source} · Updated ${formatWhen(data.updatedAt)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>Add contacts</Button>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload />
              Import CSV
            </Button>
            <a
              href={`/api/phone/power-dialer/lists/${listId}/export`}
              className="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted"
            >
              Export CSV
            </a>
            <Button size="sm" variant="ghost" onClick={() => void onArchive()}>Archive</Button>
          </div>
        }
      >
        {data.campaigns.length > 0 && (
          <p className="mb-3 text-xs text-muted-foreground">
            Used in: {data.campaigns.map((c) => c.name).join(', ')}
          </p>
        )}
        <div className="mb-4 flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Search contacts"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            aria-label="Search contacts in list"
          />
          <Input
            className="max-w-[140px]"
            placeholder="Save filter as…"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            aria-label="Saved filter name"
          />
          <Button size="sm" variant="outline" onClick={() => void saveFilter()}>Save filter</Button>
          {savedFilters.map((f) => (
            <Button key={f.name} size="sm" variant="ghost" onClick={() => { setQ(f.q || ''); setPage(1) }}>
              {f.name}
            </Button>
          ))}
        </div>
        {selected.size > 0 && (
          <div className="mb-3 flex flex-wrap gap-2 text-sm">
            <span>{selected.size} selected</span>
            <Button size="sm" variant="outline" onClick={() => setCampaignPickOpen(true)}>Add to campaign</Button>
            <Button size="sm" variant="destructive" onClick={() => void bulkRemove()}>Remove from list</Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-2 py-2" scope="col"><span className="sr-only">Select</span></th>
                <th className="px-2 py-2" scope="col">Name</th>
                <th className="px-2 py-2" scope="col">Phone</th>
                <th className="px-2 py-2" scope="col">Company</th>
                <th className="px-2 py-2" scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.contacts.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No contacts on this page.</td></tr>
              )}
              {data.contacts.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="px-2 py-2">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.phone}`} />
                  </td>
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
      <Dialog open={campaignPickOpen} onOpenChange={setCampaignPickOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add to campaign</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Copies selected contacts onto the campaign&apos;s calling list.</p>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={targetCampaignId}
            onChange={(e) => setTargetCampaignId(e.target.value)}
            aria-label="Target campaign"
          >
            <option value="">Select campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignPickOpen(false)}>Cancel</Button>
            <Button disabled={!targetCampaignId} onClick={() => void bulkAddToCampaign()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add existing contacts</DialogTitle></DialogHeader>
          <Input placeholder="Search shared contacts" value={contactQ} onChange={(e) => setContactQ(e.target.value)} />
          <ul className="max-h-48 overflow-auto text-sm">
            {searchHits.map((h) => (
              <li key={h.id} className="flex justify-between border-b py-2">
                <span>{h.name} · {formatPhone(h.phone)}</span>
                <Button size="sm" variant="outline" onClick={() => void addContact(h.id)}>Add</Button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
