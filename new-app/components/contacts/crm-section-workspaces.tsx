'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Building2 } from 'lucide-react'
import { formatWhen } from '@/lib/format'
import { DealPipelineEditorSheet } from '@/components/contacts/deal-pipeline-editor-sheet'
import { DealEditorSheet } from '@/components/contacts/deal-editor-sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

async function crmGet<T>(path: string): Promise<T> {
  const r = await fetch(path)
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error || 'Request failed')
  return j.data as T
}

async function crmSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error || 'Request failed')
  return j.data as T
}

function CrmLoadError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
      {message}
    </p>
  )
}

export function CompaniesWorkspace() {
  const [rows, setRows] = useState<{ id: string; name: string; _count: { contacts: number; deals: number } }[]>([])
  const [q, setQ] = useState('')
  const [name, setName] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const load = useCallback(() => {
    setLoadError(null)
    void crmGet<typeof rows>(`/api/crm/native/companies?q=${encodeURIComponent(q)}`)
      .then((data) => {
        setRows(data)
        setLoadError(null)
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Load failed'
        setLoadError(msg)
        setRows([])
        toast.error(msg)
      })
  }, [q])
  useEffect(() => {
    load()
  }, [load])
  return (
    <Page>
      <PageHeader title="Companies" description="Accounts linked to contacts and deals." />
      <CrmLoadError message={loadError} />
      <Panel title="Add company">
        <div className="flex flex-wrap gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company name" aria-label="Company name" />
          <Button
            type="button"
            onClick={() => {
              void crmSend('/api/crm/native/companies', 'POST', { name })
                .then(() => {
                  setName('')
                  load()
                })
                .catch((e) => toast.error(e instanceof Error ? e.message : 'Create failed'))
            }}
          >
            Add
          </Button>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search companies" className="ml-auto max-w-xs" />
        </div>
      </Panel>
      <Panel title="All companies">
        {loadError ? (
          <p className="text-sm text-muted-foreground">Fix the error above and refresh the page.</p>
        ) : !rows.length ? (
          <EmptyState icon={Building2} title="No companies yet" description="Create a company or link one from a contact." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Name</TableHead>
                <TableHead scope="col">Contacts</TableHead>
                <TableHead scope="col">Deals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/app/contacts/companies/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>{c._count.contacts}</TableCell>
                  <TableCell>{c._count.deals}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </Page>
  )
}

export function CompanyDetailWorkspace({ companyId }: { companyId: string }) {
  const [data, setData] = useState<{
    name: string
    website: string | null
    contacts: { id: string; firstName: string | null; lastName: string | null; phone: string }[]
    deals: { id: string; title: string; stage: { name: string } }[]
    activity: { id: string; kind: string; title: string; body: string | null; createdAt: string; contactId: string }[]
  } | null>(null)
  useEffect(() => {
    void crmGet<NonNullable<typeof data>>(`/api/crm/native/companies/${companyId}`)
      .then(setData)
      .catch((e) => toast.error(e.message))
  }, [companyId])
  if (!data) return <Page><p className="text-sm text-muted-foreground">Loading…</p></Page>
  return (
    <Page>
      <PageHeader breadcrumbs={[{ label: 'Companies', href: '/app/contacts/companies' }, { label: data.name }]} title={data.name} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Contacts">
          <ul className="space-y-2 text-sm">
            {data.contacts.map((c) => (
              <li key={c.id}>
                <Link href={`/app/contacts/${c.id}`} className="text-primary hover:underline">
                  {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Deals">
          <ul className="space-y-2 text-sm">
            {data.deals.map((d) => (
              <li key={d.id}>{d.title} · {d.stage.name}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="Activity" className="lg:col-span-2">
          {!data.activity?.length ? (
            <p className="text-sm text-muted-foreground">No activity on linked contacts yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.activity.map((ev) => (
                <li key={ev.id} className="rounded border px-3 py-2">
                  <p className="font-medium">{ev.title}</p>
                  <p className="text-xs text-muted-foreground">{formatWhen(ev.createdAt)} · {ev.kind}</p>
                  {ev.body && <p className="mt-1 text-muted-foreground">{ev.body}</p>}
                  <Link href={`/app/contacts/${ev.contactId}`} className="mt-1 inline-block text-xs text-primary">View contact</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </Page>
  )
}

type DealRow = {
  id: string
  title: string
  stageId: string
  amountCents: number | null
  ownerUserId: string | null
  closeTargetAt: string | null
  nextStep: string | null
  contact: { id: string; firstName: string | null; lastName: string | null } | null
}

export function DealsWorkspace() {
  const [stages, setStages] = useState<{ id: string; name: string }[]>([])
  const [deals, setDeals] = useState<DealRow[]>([])
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [pipelineOpen, setPipelineOpen] = useState(false)
  const [dealTitle, setDealTitle] = useState('')
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editDeal, setEditDeal] = useState<DealRow | null>(null)
  const [dealEditorOpen, setDealEditorOpen] = useState(false)
  const [newDealStageId, setNewDealStageId] = useState('')
  const load = useCallback(() => {
    setLoadError(null)
    void crmGet<{ stages: typeof stages; deals: DealRow[] }>('/api/crm/native/deals')
      .then((d) => {
        setStages(d.stages)
        setDeals(d.deals)
        if (!newDealStageId && d.stages[0]) setNewDealStageId(d.stages[0].id)
        setLoadError(null)
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Load failed'
        setLoadError(msg)
        setStages([])
        setDeals([])
        toast.error(msg)
      })
  }, [])
  useEffect(() => {
    load()
  }, [load])
  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return deals
    return deals.filter((d) => d.title.toLowerCase().includes(q))
  }, [deals, search])
  const byStage = useMemo(() => {
    const m = new Map<string, DealRow[]>()
    for (const s of stages) m.set(s.id, [])
    for (const d of filteredDeals) {
      const list = m.get(d.stageId) || []
      list.push(d)
      m.set(d.stageId, list)
    }
    return m
  }, [filteredDeals, stages])
  const moveStage = (dealId: string, stageId: string) => {
    void crmSend(`/api/crm/native/deals/${dealId}`, 'PATCH', { stageId })
      .then(load)
      .catch((e) => toast.error(e.message))
  }
  const addDeal = () => {
    const stageId = newDealStageId || stages[0]?.id
    if (!stageId || !dealTitle.trim()) {
      toast.error('Enter a deal name')
      return
    }
    void crmSend('/api/crm/native/deals', 'POST', { title: dealTitle.trim(), stageId })
      .then(() => {
        setDealTitle('')
        load()
      })
      .catch((e) => toast.error(e.message))
  }
  return (
    <Page>
      <PageHeader
        title="Deals"
        description="Pipeline with kanban stage moves and table view."
        actions={
          <div className="flex flex-wrap gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search deals" aria-label="Search deals" className="max-w-[180px]" />
            <select className="rounded border px-2 py-1 text-sm" aria-label="Pipeline" value="default" disabled>
              <option value="default">Default pipeline</option>
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => setPipelineOpen(true)}>Manage pipeline</Button>
            <Button type="button" variant={view === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setView('kanban')}>Kanban</Button>
            <Button type="button" variant={view === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setView('table')}>Table</Button>
          </div>
        }
      />
      <Panel title="Add deal" className="mb-4">
        <div className="flex flex-wrap gap-2">
          <Input value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} placeholder="Deal name" aria-label="Deal name" />
          <select className="rounded border px-2 py-2 text-sm" value={newDealStageId} onChange={(e) => setNewDealStageId(e.target.value)} aria-label="Initial stage">
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <Button type="button" onClick={addDeal}>Add deal</Button>
        </div>
      </Panel>
      <CrmLoadError message={loadError} />
      {loadError ? (
        <p className="text-sm text-muted-foreground">Fix the error above and refresh the page.</p>
      ) : view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((s) => (
            <div key={s.id} className="min-w-[240px] rounded-lg border bg-card p-3">
              <h3 className="mb-2 text-sm font-semibold">{s.name}</h3>
              <ul className="space-y-2">
                {(byStage.get(s.id) || []).map((d) => (
                  <li key={d.id} className="rounded border p-2 text-sm">
                    <button type="button" className="font-medium text-left hover:text-primary" onClick={() => { setEditDeal(d); setDealEditorOpen(true) }}>
                      {d.title}
                    </button>
                    {d.amountCents != null && (
                      <p className="text-xs text-muted-foreground">${(d.amountCents / 100).toLocaleString()}</p>
                    )}
                    {d.ownerUserId && <p className="text-xs font-mono text-muted-foreground">Owner {d.ownerUserId.slice(0, 8)}</p>}
                    {d.closeTargetAt && <p className="text-xs text-muted-foreground">Close {formatWhen(d.closeTargetAt)}</p>}
                    {d.contact && (
                      <Link href={`/app/contacts/${d.contact.id}`} className="text-xs text-primary">
                        View contact
                      </Link>
                    )}
                    <select
                      className="mt-2 w-full rounded border px-2 py-1 text-xs"
                      aria-label={`Move ${d.title} stage`}
                      value={d.stageId}
                      onChange={(e) => moveStage(d.id, e.target.value)}
                    >
                      {stages.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <Panel title="All deals">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Deal</TableHead>
                <TableHead scope="col">Stage</TableHead>
                <TableHead scope="col">Value</TableHead>
                <TableHead scope="col">Owner</TableHead>
                <TableHead scope="col">Close target</TableHead>
                <TableHead scope="col">Next step</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeals.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <button type="button" className="font-medium hover:text-primary" onClick={() => { setEditDeal(d); setDealEditorOpen(true) }}>{d.title}</button>
                  </TableCell>
                  <TableCell>{stages.find((s) => s.id === d.stageId)?.name}</TableCell>
                  <TableCell>{d.amountCents != null ? `$${(d.amountCents / 100).toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{d.ownerUserId?.slice(0, 8) || '—'}</TableCell>
                  <TableCell>{d.closeTargetAt ? formatWhen(d.closeTargetAt) : '—'}</TableCell>
                  <TableCell>{d.nextStep || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
      <DealPipelineEditorSheet open={pipelineOpen} onOpenChange={setPipelineOpen} onSaved={load} />
      <DealEditorSheet
        open={dealEditorOpen}
        onOpenChange={setDealEditorOpen}
        deal={editDeal ? { ...editDeal, contactId: editDeal.contact?.id ?? null } : null}
        stages={stages}
        onSaved={load}
      />
    </Page>
  )
}

export { TasksWorkspace } from '@/components/contacts/crm-tasks-workspace'
export { CalendarWorkspace } from '@/components/contacts/crm-calendar-workspace'

export function CrmSettingsWorkspace() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null)
  const [fields, setFields] = useState<{ id: string; key: string; label: string; fieldType: string }[]>([])
  const [newField, setNewField] = useState({ key: '', label: '', fieldType: 'text' })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pipelineOpen, setPipelineOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState('general')
  useEffect(() => {
    setLoadError(null)
    void crmGet<Record<string, unknown>>('/api/crm/native/settings')
      .then(setSettings)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load CRM settings'))
    void crmGet<typeof fields>('/api/crm/native/custom-fields')
      .then(setFields)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Could not load custom fields'
        setLoadError((prev) => prev || msg)
      })
  }, [])
  const saveSettings = () => {
    if (!settings) return
    void crmSend('/api/crm/native/settings', 'PATCH', {
      defaultCountryCode: settings.defaultCountryCode,
      blockedCountries: settings.blockedCountries,
      allowedCountries: settings.allowedCountries,
      phoneFallthroughMode: settings.phoneFallthroughMode,
      inboundContactRules: settings.inboundContactRules,
      teamScopes: settings.teamScopes,
      dialPolicyJson: settings.dialPolicyJson,
    })
      .then(() => toast.success('Settings saved'))
      .catch((e) => toast.error(e.message))
  }
  return (
    <Page>
      <PageHeader title="CRM settings" description="General workspace CRM defaults, custom fields, deal pipelines, and dial rules." />
      <CrmLoadError message={loadError} />
      <Tabs value={settingsTab} onValueChange={(v) => setSettingsTab(v ?? 'general')}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="fields">Custom fields</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="dial">Dial &amp; inbound</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-4">
          {settings && (
            <Panel title="General">
              <div className="grid max-w-lg gap-3">
                <label className="text-sm">
                  Default country code
                  <Input
                    className="mt-1"
                    value={String(settings.defaultCountryCode || 'US')}
                    onChange={(e) => setSettings({ ...settings, defaultCountryCode: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  Allowed countries (comma-separated ISO codes, empty = all)
                  <Input
                    className="mt-1"
                    value={Array.isArray(settings.allowedCountries) ? (settings.allowedCountries as string[]).join(',') : ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        allowedCountries: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                </label>
                <label className="text-sm">
                  Blocked countries (comma-separated)
                  <Input
                    className="mt-1"
                    value={Array.isArray(settings.blockedCountries) ? (settings.blockedCountries as string[]).join(',') : ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        blockedCountries: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  Team contact visibility: {(settings.teamScopes as { contactsRead?: string })?.contactsRead || 'workspace default'}.
                </p>
              </div>
              <Button type="button" className="mt-3" onClick={saveSettings}>Save general settings</Button>
            </Panel>
          )}
        </TabsContent>
        <TabsContent value="fields" className="mt-4">
      <Panel title="Custom fields">
        <ul className="mb-3 space-y-1 text-sm">
          {fields.map((f) => (
            <li key={f.id}>{f.label} ({f.fieldType}) · <code>{f.key}</code></li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Input value={newField.key} onChange={(e) => setNewField((p) => ({ ...p, key: e.target.value }))} placeholder="key" aria-label="Field key" />
          <Input value={newField.label} onChange={(e) => setNewField((p) => ({ ...p, label: e.target.value }))} placeholder="Label" aria-label="Field label" />
          <select className="rounded border px-2" value={newField.fieldType} onChange={(e) => setNewField((p) => ({ ...p, fieldType: e.target.value }))} aria-label="Field type">
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="select">Select</option>
          </select>
          <Button
            type="button"
            onClick={() =>
              void crmSend<{ id: string }>('/api/crm/native/custom-fields', 'POST', newField)
                .then((row) => {
                  setFields((prev) => [...prev, { ...newField, id: row.id }])
                  setNewField({ key: '', label: '', fieldType: 'text' })
                })
                .catch((e) => toast.error(e.message))
            }
          >
            Add field
          </Button>
        </div>
      </Panel>
        </TabsContent>
        <TabsContent value="pipelines" className="mt-4">
          <Panel title="Deal pipelines">
            <p className="mb-3 text-sm text-muted-foreground">Stages are shared across all deals in this workspace.</p>
            <Button type="button" onClick={() => setPipelineOpen(true)}>Manage pipeline stages</Button>
          </Panel>
        </TabsContent>
        <TabsContent value="dial" className="mt-4">
      {settings && (
        <Panel title="Dial & inbound">
          <div className="grid gap-3 max-w-lg">
            <label className="text-sm">
              Default country
              <Input
                className="mt-1"
                value={String(settings.defaultCountryCode || 'US')}
                onChange={(e) => setSettings({ ...settings, defaultCountryCode: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Phone fallthrough
              <select
                className="mt-1 w-full rounded border px-2 py-2"
                value={String(settings.phoneFallthroughMode || 'next_number')}
                onChange={(e) => setSettings({ ...settings, phoneFallthroughMode: e.target.value })}
              >
                <option value="next_number">Next number on same contact</option>
                <option value="next_contact">Next contact</option>
              </select>
            </label>
            <div className="mt-4 space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Workspace dial frequency (P22)</p>
              <p className="mb-2 text-xs text-muted-foreground">Limits apply across all power-dialer campaigns for the same phone number.</p>
              <label className="text-sm">
                Min minutes between calls to same number
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  value={String((settings.dialPolicyJson as { minMinutesBetweenCallsToPhone?: number })?.minMinutesBetweenCallsToPhone ?? 0)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      dialPolicyJson: {
                        ...(typeof settings.dialPolicyJson === 'object' ? settings.dialPolicyJson : {}),
                        minMinutesBetweenCallsToPhone: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              <label className="text-sm">
                Max calls per number per UTC day
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  value={String((settings.dialPolicyJson as { maxCallsToPhonePerDay?: number })?.maxCallsToPhonePerDay ?? 0)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      dialPolicyJson: {
                        ...(typeof settings.dialPolicyJson === 'object' ? settings.dialPolicyJson : {}),
                        maxCallsToPhonePerDay: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              <label className="text-sm">
                Workspace allowed area codes (comma)
                <Input
                  className="mt-1"
                  value={
                    Array.isArray((settings.dialPolicyJson as { allowedAreaCodes?: string[] })?.allowedAreaCodes)
                      ? ((settings.dialPolicyJson as { allowedAreaCodes: string[] }).allowedAreaCodes).join(',')
                      : ''
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      dialPolicyJson: {
                        ...(typeof settings.dialPolicyJson === 'object' ? settings.dialPolicyJson : {}),
                        allowedAreaCodes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      },
                    })
                  }
                />
              </label>
            </div>
            <Button type="button" onClick={saveSettings}>Save settings</Button>
          </div>
        </Panel>
      )}
        </TabsContent>
      </Tabs>
      <DealPipelineEditorSheet open={pipelineOpen} onOpenChange={setPipelineOpen} onSaved={() => undefined} />
    </Page>
  )
}
