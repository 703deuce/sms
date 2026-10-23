'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatWhen } from '@/lib/format'

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

export function CompaniesWorkspace() {
  const [rows, setRows] = useState<{ id: string; name: string; _count: { contacts: number; deals: number } }[]>([])
  const [q, setQ] = useState('')
  const [name, setName] = useState('')
  const load = useCallback(() => {
    void crmGet<typeof rows>(`/api/crm/native/companies?q=${encodeURIComponent(q)}`)
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Load failed'))
  }, [q])
  useEffect(() => {
    load()
  }, [load])
  return (
    <Page>
      <PageHeader title="Companies" description="Accounts linked to contacts and deals." />
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
        {!rows.length ? (
          <EmptyState title="No companies yet" description="Create a company or link one from a contact." />
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
  } | null>(null)
  useEffect(() => {
    void crmGet(`/api/crm/native/companies/${companyId}`).then(setData).catch((e) => toast.error(e.message))
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
  const load = useCallback(() => {
    void crmGet<{ stages: typeof stages; deals: DealRow[] }>('/api/crm/native/deals')
      .then((d) => {
        setStages(d.stages)
        setDeals(d.deals)
      })
      .catch((e) => toast.error(e.message))
  }, [])
  useEffect(() => {
    load()
  }, [load])
  const byStage = useMemo(() => {
    const m = new Map<string, DealRow[]>()
    for (const s of stages) m.set(s.id, [])
    for (const d of deals) {
      const list = m.get(d.stageId) || []
      list.push(d)
      m.set(d.stageId, list)
    }
    return m
  }, [deals, stages])
  const moveStage = (dealId: string, stageId: string) => {
    void crmSend(`/api/crm/native/deals/${dealId}`, 'PATCH', { stageId })
      .then(load)
      .catch((e) => toast.error(e.message))
  }
  return (
    <Page>
      <PageHeader
        title="Deals"
        description="Pipeline with kanban stage moves and table view."
        actions={
          <div className="flex gap-2">
            <Button type="button" variant={view === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setView('kanban')}>Kanban</Button>
            <Button type="button" variant={view === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setView('table')}>Table</Button>
          </div>
        }
      />
      {view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((s) => (
            <div key={s.id} className="min-w-[240px] rounded-lg border bg-card p-3">
              <h3 className="mb-2 text-sm font-semibold">{s.name}</h3>
              <ul className="space-y-2">
                {(byStage.get(s.id) || []).map((d) => (
                  <li key={d.id} className="rounded border p-2 text-sm">
                    <p className="font-medium">{d.title}</p>
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
                <TableHead scope="col">Close target</TableHead>
                <TableHead scope="col">Next step</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.title}</TableCell>
                  <TableCell>{stages.find((s) => s.id === d.stageId)?.name}</TableCell>
                  <TableCell>{d.closeTargetAt ? formatWhen(d.closeTargetAt) : '—'}</TableCell>
                  <TableCell>{d.nextStep || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </Page>
  )
}

export function TasksWorkspace() {
  const [bucket, setBucket] = useState<'due' | 'overdue' | 'upcoming' | 'done'>('due')
  const [tasks, setTasks] = useState<{ id: string; title: string; dueAt: string | null; status: string; contact: { id: string } | null }[]>([])
  const load = useCallback(() => {
    void crmGet<typeof tasks>(`/api/crm/native/tasks?bucket=${bucket}`).then(setTasks).catch((e) => toast.error(e.message))
  }, [bucket])
  useEffect(() => {
    load()
  }, [load])
  return (
    <Page>
      <PageHeader title="Tasks & follow-ups" description="Due, overdue, upcoming, and completed tasks." />
      <div className="mb-4 flex flex-wrap gap-2">
        {(['due', 'overdue', 'upcoming', 'done'] as const).map((b) => (
          <Button key={b} type="button" size="sm" variant={bucket === b ? 'default' : 'outline'} onClick={() => setBucket(b)}>
            {b.charAt(0).toUpperCase() + b.slice(1)}
          </Button>
        ))}
      </div>
      <Panel title="Tasks">
        {!tasks.length ? <EmptyState title="No tasks" description="Add a task from a contact or the dialer." /> : (
          <ul className="space-y-2 text-sm">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded border px-3 py-2">
                <span>{t.title}{t.dueAt ? ` · ${formatWhen(t.dueAt)}` : ''}</span>
                {t.contact && <Link href={`/app/contacts/${t.contact.id}`} className="text-primary">Contact</Link>}
                {t.status !== 'done' && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => void crmSend(`/api/crm/native/tasks/${t.id}`, 'PATCH', { status: 'done' }).then(load)}>
                    Done
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Page>
  )
}

export function CalendarWorkspace() {
  const [rows, setRows] = useState<{ id: string; title: string; startsAt: string; contact: { id: string } | null }[]>([])
  const [title, setTitle] = useState('')
  const load = useCallback(() => {
    void crmGet<typeof rows>('/api/crm/native/appointments').then(setRows).catch((e) => toast.error(e.message))
  }, [])
  useEffect(() => {
    load()
  }, [load])
  const add = () => {
    const start = new Date()
    start.setHours(start.getHours() + 1, 0, 0, 0)
    const end = new Date(start.getTime() + 3600000)
    void crmSend('/api/crm/native/appointments', 'POST', {
      title: title || 'Meeting',
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
      .then(() => {
        setTitle('')
        load()
      })
      .catch((e) => toast.error(e.message))
  }
  return (
    <Page>
      <PageHeader title="Calendar" description="Week-style list of CRM appointments." />
      <Panel title="Schedule">
        <div className="flex gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Appointment title" aria-label="Title" />
          <Button type="button" onClick={add}>Create</Button>
        </div>
      </Panel>
      <Panel title="Upcoming">
        <ul className="space-y-2 text-sm">
          {rows.map((a) => (
            <li key={a.id} className="flex justify-between rounded border px-3 py-2">
              <span>{a.title} · {formatWhen(a.startsAt)}</span>
              {a.contact && <Link href={`/app/contacts/${a.contact.id}`} className="text-primary">Contact</Link>}
            </li>
          ))}
        </ul>
      </Panel>
    </Page>
  )
}

export function CrmSettingsWorkspace() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null)
  const [fields, setFields] = useState<{ id: string; key: string; label: string; fieldType: string }[]>([])
  const [newField, setNewField] = useState({ key: '', label: '', fieldType: 'text' })
  useEffect(() => {
    void crmGet('/api/crm/native/settings').then(setSettings).catch(() => undefined)
    void crmGet<typeof fields>('/api/crm/native/custom-fields').then(setFields).catch(() => undefined)
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
      <PageHeader title="CRM settings" description="Custom fields, international dial rules, inbound contact automation, team scopes." />
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
              void crmSend('/api/crm/native/custom-fields', 'POST', newField)
                .then((row: { id: string }) => {
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
    </Page>
  )
}
