'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Upload } from 'lucide-react'
import { PowerDialerSessionWorkspace } from '@/components/phone/power-dialer-session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Panel } from '@/components/app/page-primitives'
import { SimpleSelect } from '@/components/app/filters'
import { StatusBadge, type Tone } from '@/components/app/status'
import { useNumbers } from '@/components/providers/numbers-provider'
import {
  createPowerCampaign,
  createPowerList,
  fetchPowerCampaigns,
  fetchPowerLists,
  importPowerListRows,
  patchPowerCampaign,
  type PowerCampaignDto,
  type PowerListDto,
} from '@/lib/phone-api'
import { formatPhone, formatWhen } from '@/lib/format'

const CAMPAIGN_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  draft: { label: 'Draft', tone: 'muted' },
  completed: { label: 'Completed', tone: 'neutral' },
}

export function PowerDialer({ initialTab = 'session' }: { initialTab?: string }) {
  return (
    <Tabs defaultValue={initialTab} className="gap-6">
      <TabsList>
        <TabsTrigger value="session">Session</TabsTrigger>
        <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        <TabsTrigger value="lists">Lists</TabsTrigger>
      </TabsList>
      <TabsContent value="session"><PowerDialerSessionWorkspace /></TabsContent>
      <TabsContent value="campaigns"><Campaigns /></TabsContent>
      <TabsContent value="lists"><Lists /></TabsContent>
    </Tabs>
  )
}

function Campaigns() {
  const { owned } = useNumbers()
  const [rows, setRows] = useState<PowerCampaignDto[]>([])
  const [lists, setLists] = useState<PowerListDto[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [listId, setListId] = useState('')
  const [callerId, setCallerId] = useState('')

  const reload = useCallback(() => {
    void fetchPowerCampaigns().then(setRows).catch(() => undefined)
    void fetchPowerLists().then(setLists).catch(() => undefined)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const active = owned.find((n) => n.status === 'active')
    if (active && !callerId) setCallerId(active.number)
  }, [owned, callerId])

  const create = async () => {
    try {
      await createPowerCampaign({
        name,
        listId,
        callerIdE164: callerId,
        configJson: { maxAttempts: 3, retryDelayMinutes: 60 },
      })
      setOpen(false)
      setName('')
      reload()
      toast.success('Campaign created')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    }
  }

  return (
    <>
      <Panel
        title="Campaigns"
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus />
            New campaign
          </Button>
        }
        bodyClassName="p-0"
      >
        <ul className="divide-y">
          {rows.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No campaigns yet.</li>}
          {rows.map((c) => {
            const st = CAMPAIGN_STATUS[c.status] ?? CAMPAIGN_STATUS.draft
            return (
              <li key={c.id} className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-center">
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.listName}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Progress value={c.completedPct} className="h-1.5 flex-1" aria-label={`${c.completedPct}% complete`} />
                  <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{c.completedPct}%</span>
                </span>
                <span className="text-xs text-muted-foreground">{c.attempts} attempts · created {formatWhen(c.created)}</span>
                <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} />
            <SimpleSelect
              label="Calling list"
              value={listId}
              onChange={setListId}
              options={lists.map((l) => ({ value: l.id, label: l.name }))}
            />
            <SimpleSelect
              label="Caller ID"
              value={callerId}
              onChange={setCallerId}
              options={owned.filter((n) => n.status === 'active').map((n) => ({ value: n.number, label: n.nickname || n.number }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!name || !listId || !callerId} onClick={() => void create()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Lists() {
  const [rows, setRows] = useState<PowerListDto[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [listId, setListId] = useState('')
  const [csv, setCsv] = useState('')
  const [newName, setNewName] = useState('')

  const reload = () => void fetchPowerLists().then(setRows).catch(() => undefined)

  useEffect(() => {
    reload()
  }, [])

  const parseCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean)
    const rows: { name?: string; phone: string; company?: string }[] = []
    for (const line of lines) {
      const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ''))
      if (parts.length < 1) continue
      const phone = parts.find((p) => p.replace(/\D/g, '').length >= 10) || parts[0]
      const name = parts[0] !== phone ? parts[0] : parts[1]
      const company = parts.length > 2 ? parts[2] : undefined
      rows.push({ phone, name, company })
    }
    return rows
  }

  const runImport = async () => {
    if (!listId) return
    try {
      const result = await importPowerListRows(listId, parseCsv(csv))
      toast.success(`Imported ${result.imported}`, { description: result.skipped ? `${result.skipped} skipped` : undefined })
      setImportOpen(false)
      setCsv('')
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    }
  }

  const createList = async () => {
    if (!newName.trim()) return
    try {
      await createPowerList(newName.trim())
      setNewName('')
      reload()
      toast.success('List created')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create list')
    }
  }

  return (
    <>
      <Panel
        title="Call lists"
        description="Ineligible entries (opted out, blocked, invalid) are excluded automatically."
        actions={
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload />
            Import CSV
          </Button>
        }
        bodyClassName="p-0"
      >
        <div className="flex flex-wrap items-end gap-2 border-b px-5 py-3">
          <Input className="max-w-xs" placeholder="New list name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button size="sm" variant="secondary" onClick={() => void createList()}>Create list</Button>
        </div>
        <ul className="divide-y">
          {rows.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <span className="flex flex-col">
                <span className="text-sm font-medium">{l.name}</span>
                <span className="text-xs text-muted-foreground">{l.source} · updated {formatWhen(l.updated)}</span>
              </span>
              <span className="flex gap-2 text-xs">
                <StatusBadge tone="success">{l.eligible} eligible</StatusBadge>
                <StatusBadge tone="muted">{l.ineligible} excluded</StatusBadge>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import CSV</DialogTitle>
          </DialogHeader>
          <SimpleSelect
            label="Target list"
            value={listId}
            onChange={setListId}
            options={rows.map((l) => ({ value: l.id, label: l.name }))}
          />
          <Textarea rows={8} placeholder="name,phone,company" value={csv} onChange={(e) => setCsv(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button disabled={!listId || !csv.trim()} onClick={() => void runImport()}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
