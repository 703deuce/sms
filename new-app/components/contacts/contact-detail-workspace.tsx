'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
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
  timeline: { id: string; kind: string; title: string; body?: string | null; at: string; href?: string }[]
}

export function ContactDetailWorkspace({ contactId }: { contactId: string }) {
  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch(`/api/crm/native/contacts/${contactId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error)
        setData(j.data)
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load contact'))
      .finally(() => setLoading(false))
  }, [contactId])

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
          <Link href={`/app/power-dialer/dialer?focusContact=${data.id}`} className="text-sm font-medium text-primary">
            Dial
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Panel title="Details">
            <KeyValue
              items={[
                { label: 'Email', value: data.email || '—' },
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
          </Panel>
          <Panel title="Activity">
            {!data.timeline.length ? (
              <p className="text-sm text-muted-foreground">No activity yet for this contact.</p>
            ) : (
              <ol className="space-y-3 text-sm">
                {data.timeline.map((item) => (
                  <li key={item.id} className="border-l-2 border-muted pl-3">
                    <p className="font-medium">{item.title}</p>
                    {item.body && <p className="text-muted-foreground">{item.body}</p>}
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
