'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, KeyValue, Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { formatPhone, formatWhen } from '@/lib/format'

type Detail = {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
  email: string | null
  title: string | null
  company: string | null
  leadSource: string | null
  leadStage: string | null
  timezone: string | null
  timezoneInferred: boolean
  status: string
  phones: { e164: string; label: string; priority: number; isPreferred: boolean }[]
  customFields: { key: string; label: string; value: unknown }[]
  deals: { id: string; title: string; stage: { name: string } }[]
  tasks: { id: string; title: string; dueAt: string | null; status: string }[]
  timeline: { id: string; kind: string; title: string; body?: string | null; at: string; href?: string; sensitive?: boolean }[]
  refresherNotes?: string | null
  ownerUserId?: string | null
}

export function ContactDetailWorkspace({ contactId }: { contactId: string }) {
  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ email: '', title: '', refresherNotes: '' })
  const [note, setNote] = useState('')

  const reload = useCallback(() => {
    void fetch(`/api/crm/native/contacts/${contactId}?recordings=1`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error)
        setData(j.data)
        setDraft({
          email: j.data.email || '',
          title: j.data.title || '',
          refresherNotes: j.data.refresherNotes || '',
        })
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load contact'))
      .finally(() => setLoading(false))
  }, [contactId])

  useEffect(() => {
    reload()
  }, [reload])

  const saveFields = async () => {
    try {
      await fetch(`/api/crm/native/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: draft.email,
          title: draft.title,
          refresherNotes: draft.refresherNotes,
        }),
      }).then((r) => r.json()).then((j) => { if (j.error) throw new Error(j.error) })
      toast.success('Contact updated')
      setEditing(false)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const addNote = async () => {
    if (!note.trim()) return
    try {
      await fetch(`/api/crm/native/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_note', body: note }),
      }).then((r) => r.json()).then((j) => { if (j.error) throw new Error(j.error) })
      setNote('')
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add note')
    }
  }

  if (loading) {
    return (
      <Page>
        <p className="text-sm text-muted-foreground">Loading contact…</p>
      </Page>
    )
  }

  if (!data) {
    return (
      <Page>
        <EmptyState title="Contact not found" description="This record may have been removed." />
      </Page>
    )
  }

  const name = [data.firstName, data.lastName].filter(Boolean).join(' ') || formatPhone(data.phone)

  return (
    <Page>
      <PageHeader
        breadcrumbs={[{ label: 'Contacts', href: '/app/contacts' }, { label: name }]}
        title={name}
        description={[data.title, data.company, formatPhone(data.phone)].filter(Boolean).join(' · ')}
        eyebrow={<StatusBadge tone="info">{data.status}</StatusBadge>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" asChild>
              <Link href={`/app/power-dialer/dialer?focusContact=${data.id}`}>Dial</Link>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={`/app/phone/dialer?to=${encodeURIComponent(data.phone)}`}>Quick call</Link>
            </Button>
            {data.email && (
              <Button type="button" size="sm" variant="outline" asChild>
                <a href={`mailto:${data.email}`}>Email</a>
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={`/conversations?contact=${data.id}`}>SMS</Link>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={`/app/power-dialer/callbacks?contact=${data.id}`}>Set callback</Link>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={`/app/contacts/tasks?contact=${data.id}`}>Add task</Link>
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Cancel edit' : 'Edit fields'}
            </Button>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Panel title="Details">
            {editing ? (
              <div className="grid gap-3 max-w-md">
                <label className="text-sm">Email
                  <Input className="mt-1" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
                </label>
                <label className="text-sm">Title
                  <Input className="mt-1" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                </label>
                <label className="text-sm">Refresher notes
                  <Input className="mt-1" value={draft.refresherNotes} onChange={(e) => setDraft((d) => ({ ...d, refresherNotes: e.target.value }))} />
                </label>
                <Button type="button" onClick={() => void saveFields()}>Save</Button>
              </div>
            ) : (
              <KeyValue
                items={[
                  { label: 'Email', value: data.email || '—' },
                  { label: 'Title', value: data.title || '—' },
                  { label: 'Refresher notes', value: data.refresherNotes || '—' },
                  { label: 'Lead source', value: data.leadSource || '—' },
                  { label: 'Lead stage', value: data.leadStage || '—' },
                  {
                    label: 'Timezone',
                    value: data.timezone
                      ? `${data.timezone}${data.timezoneInferred ? ' (inferred)' : ''}`
                      : '—',
                  },
                  ...data.customFields.map((f) => ({
                    label: f.label,
                    value: String(f.value ?? '—'),
                  })),
                ]}
              />
            )}
          </Panel>
          <Panel title="Add note">
            <div className="flex gap-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for timeline" aria-label="Note" />
              <Button type="button" onClick={() => void addNote()}>Save note</Button>
            </div>
          </Panel>
          <Panel title="Activity">
            {!data.timeline.length ? (
              <p className="text-sm text-muted-foreground">No activity yet for this contact.</p>
            ) : (
              <ol className="space-y-3 text-sm">
                {data.timeline.map((item) => (
                  <li key={item.id} className="border-l-2 border-muted pl-3">
                    <p className="font-medium">{item.title}</p>
                    {item.sensitive ? (
                      <p className="text-muted-foreground">Recording restricted — open call history with permission.</p>
                    ) : item.body ? (
                      <p className="text-muted-foreground">{item.body}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{formatWhen(item.at)}</p>
                    {item.href && (
                      <Link href={item.href} className="text-xs text-primary">
                        View
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
        <aside className="flex flex-col gap-4">
          <Panel title="Phones">
            <ul className="text-sm">
              <li>{formatPhone(data.phone)} (primary)</li>
              {data.phones.map((p) => (
                <li key={p.e164}>{formatPhone(p.e164)} · {p.label}</li>
              ))}
            </ul>
          </Panel>
          <Panel title="Open tasks">
            {!data.tasks.length ? (
              <p className="text-sm text-muted-foreground">No open tasks.</p>
            ) : (
              <ul className="text-sm">
                {data.tasks.map((t) => (
                  <li key={t.id}>{t.title}</li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Deals">
            {!data.deals.length ? (
              <p className="text-sm text-muted-foreground">No deals linked.</p>
            ) : (
              <ul className="text-sm">
                {data.deals.map((d) => (
                  <li key={d.id}>{d.title} · {d.stage.name}</li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </Page>
  )
}
