import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowDownLeft, ArrowUpRight, Bot, MessageSquare, Phone } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState, KeyValue, Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { AI_OUTCOME, CALL_OUTCOME, MCTB_STATE, StatusBadge } from '@/components/app/status'
import { CONTACTS, THREADS, callsForContact, getContact } from '@/lib/data'
import { formatDuration, formatFull, formatPhone, formatWhen } from '@/lib/format'

export function generateStaticParams() {
  return CONTACTS.map((c) => ({ id: c.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: getContact(id)?.name ?? 'Contact' }
}

type TimelineItem = { id: string; at: string; icon: React.ComponentType<{ className?: string }>; node: React.ReactNode; href: string }

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contact = getContact(id)
  if (!contact) notFound()

  const calls = callsForContact(contact.id)
  const threads = THREADS.filter((t) => t.contactId === contact.id)
  const openCallbacks = calls.filter((c) => c.callbackNeeded && !c.handled)
  const booked = calls.filter((c) => c.ai?.outcome === 'booked')

  const timeline: TimelineItem[] = [
    ...calls.map((c) => ({
      id: c.id,
      at: c.startedAt,
      icon: c.ai ? Bot : c.direction === 'inbound' ? ArrowDownLeft : ArrowUpRight,
      href: `/app/calls/${c.id}`,
      node: (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{c.direction === 'inbound' ? 'Inbound call' : 'Outbound call'}</span>
          <span className="text-muted-foreground">· {formatDuration(c.durationSec)}</span>
          <StatusBadge tone={CALL_OUTCOME[c.outcome].tone}>{CALL_OUTCOME[c.outcome].label}</StatusBadge>
          {c.ai && <StatusBadge tone={AI_OUTCOME[c.ai.outcome].tone}>AI · {AI_OUTCOME[c.ai.outcome].label}</StatusBadge>}
          {c.mctb && <StatusBadge tone={MCTB_STATE[c.mctb.state].tone}>Text back · {MCTB_STATE[c.mctb.state].label}</StatusBadge>}
          {c.disposition && <StatusBadge tone="muted">{c.disposition}</StatusBadge>}
        </div>
      ),
    })),
    ...threads.flatMap((t) =>
      t.messages
        .filter((msg) => msg.from !== 'system')
        .map((msg, i) => ({
          id: `${t.id}-${i}`,
          at: msg.at,
          icon: MessageSquare,
          href: `/app/inbox?thread=${t.id}`,
          node: (
            <p className="text-pretty">
              <span className="font-medium">{msg.from === 'customer' ? 'Text received' : 'Text sent'}</span>
              <span className="text-muted-foreground"> · {msg.text}</span>
            </p>
          ),
        })),
    ),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <Page>
      <PageHeader
        breadcrumbs={[{ label: 'Contacts', href: '/app/contacts' }, { label: contact.name }]}
        title={contact.name}
        description={[contact.company, formatPhone(contact.phone)].filter(Boolean).join(' · ')}
        eyebrow={
          <span className="flex flex-wrap gap-1">
            <StatusBadge tone={contact.status === 'blocked' ? 'danger' : contact.status === 'customer' ? 'success' : 'neutral'} className="capitalize">{contact.status}</StatusBadge>
            {contact.consent === 'opted_out' && <StatusBadge tone="warning">SMS opted out</StatusBadge>}
            {contact.consent === 'opted_in' && <StatusBadge tone="success">SMS consent</StatusBadge>}
          </span>
        }
        actions={
          <>
            {contact.consent !== 'opted_out' && contact.status !== 'blocked' && (
              <Link href="/app/inbox" className={buttonVariants({ variant: 'outline' })}>
                <MessageSquare />
                Text
              </Link>
            )}
            <Link
              href={`/app/phone/dialer?to=${encodeURIComponent(contact.phone)}`}
              className={buttonVariants({ className: contact.status === 'blocked' ? 'pointer-events-none opacity-50' : '' })}
              aria-disabled={contact.status === 'blocked'}
            >
              <Phone />
              Call
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="History" description="Phone, AI, text-back and SMS in one timeline" className="lg:col-span-2" bodyClassName="p-0">
          {timeline.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Phone} title="No interactions yet" description="Calls and messages with this contact will appear here." />
            </div>
          ) : (
            <ol className="divide-y">
              {timeline.map((t) => (
                <li key={t.id}>
                  <Link href={t.href} className="flex items-start gap-3 px-5 py-3 text-sm hover:bg-muted/50">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <t.icon className="size-3.5" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      {t.node}
                      <time dateTime={t.at} className="text-xs text-muted-foreground" title={formatFull(t.at)}>
                        {formatWhen(t.at)}
                      </time>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Profile">
            <KeyValue
              items={[
                { label: 'Phone', value: formatPhone(contact.phone) },
                { label: 'Email', value: contact.email ?? '—' },
                { label: 'Owner', value: contact.owner },
                { label: 'Last interaction', value: formatWhen(contact.lastInteraction) },
                {
                  label: 'Tags',
                  value: (
                    <span className="flex flex-wrap gap-1">
                      {contact.tags.length ? contact.tags.map((t) => <StatusBadge key={t} tone="muted">{t}</StatusBadge>) : '—'}
                    </span>
                  ),
                },
              ]}
            />
          </Panel>
          <Panel title="Open callbacks">
            {openCallbacks.length ? (
              <ul className="flex flex-col gap-2 text-sm">
                {openCallbacks.map((c) => (
                  <li key={c.id}>
                    <Link href={`/app/calls/${c.id}`} className="text-primary hover:underline">
                      {formatWhen(c.startedAt)} · {c.ai?.summary ?? 'Callback requested'}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing outstanding.</p>
            )}
          </Panel>
          <Panel title="Appointments">
            {booked.length ? (
              <ul className="flex flex-col gap-2 text-sm">
                {booked.map((c) => (
                  <li key={c.id}>{c.ai?.summary}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No appointments booked by the AI Receptionist.</p>
            )}
          </Panel>
        </div>
      </div>
    </Page>
  )
}

