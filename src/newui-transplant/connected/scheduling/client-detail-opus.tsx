'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, MessageSquare, MoreHorizontal, UserRound } from 'lucide-react'
import { useClientDetail } from '@/features/appointments/kimi/clients/use-clients-workspace'
import { MergeClientsModal } from '@/components/appointments/clients/merge-clients-modal'
import { ContextBackLink } from '@/components/navigation/context-back-link'
import { ArOpusPage, OpusDataSurface } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Callout, PageHeader, Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/newui-transplant/components/ui/dropdown-menu'
import { Input } from '@/newui-transplant/components/ui/input'
import { Label } from '@/newui-transplant/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/newui-transplant/components/ui/tabs'
import { Textarea } from '@/newui-transplant/components/ui/textarea'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'forms', label: 'Forms & documents' },
  { id: 'access', label: 'Packages & memberships' },
  { id: 'payments', label: 'Payments' },
  { id: 'messages', label: 'Messages' },
  { id: 'notes', label: 'Notes & activity' },
  { id: 'profile', label: 'Profile' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

function fmt(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export function ClientDetailOpus({ clientId }: { clientId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const section = (searchParams.get('section') as SectionId) || 'overview'
  const detail = useClientDetail(clientId)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [profileDraft, setProfileDraft] = useState<Record<string, string>>({})
  const [apptFilter, setApptFilter] = useState<'upcoming' | 'past' | 'all'>('all')
  const [error, setError] = useState('')

  const setSection = useCallback(
    (id: SectionId) => {
      const q = new URLSearchParams(searchParams.toString())
      q.set('section', id)
      router.replace(`/appointments/clients/${clientId}?${q.toString()}`, { scroll: false })
    },
    [router, searchParams, clientId],
  )

  const d = detail.data
  const c = d?.contact

  async function toggleBlock() {
    if (!c) return
    setError('')
    try {
      if (d?.bookingAccess.publicBookingBlocked) {
        if (d.bookingAccess.restrictionId) {
          await fetch('/api/appointments/service-booking/client-restrictions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: d.bookingAccess.restrictionId,
              contactId: c.id,
              blockPublicBooking: false,
              blockPurchases: false,
              blockSelfService: false,
            }),
          })
        }
      } else {
        await fetch('/api/appointments/service-booking/client-restrictions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId: c.id,
            email: c.email,
            phone: c.phone,
            blockPublicBooking: true,
            blockPurchases: false,
            blockSelfService: true,
            reason: 'Blocked from Clients admin',
          }),
        })
      }
      await detail.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function archiveClient() {
    if (!c || !confirm('Archive this client? They will be hidden from the active directory.')) return
    await detail.patch({ status: 'INVALID' })
  }

  async function saveProfile() {
    if (!c) return
    await detail.patch({
      firstName: profileDraft.firstName ?? c.firstName,
      lastName: profileDraft.lastName ?? c.lastName,
      email: profileDraft.email ?? c.email,
      phone: profileDraft.phone ?? c.phone,
      timezone: profileDraft.timezone ?? c.timezone,
    })
  }

  async function addNote() {
    if (!noteDraft.trim()) return
    await detail.patch({ addNote: noteDraft.trim() })
    setNoteDraft('')
  }

  if (detail.loading) {
    return (
      <ArOpusPage>
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
      </ArOpusPage>
    )
  }

  if (!d || !c) {
    return (
      <ArOpusPage>
        <Callout tone="warning" title="Client not found">
          <p className="text-sm text-muted-foreground">{detail.error || 'This client could not be loaded.'}</p>
          <Button type="button" size="sm" className="mt-3" nativeButton={false} render={<Link href="/appointments/clients" />}>
            Back to clients
          </Button>
        </Callout>
      </ArOpusPage>
    )
  }

  const initials = d.displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const filteredAppts = d.appointments.filter((a) => {
    const now = Date.now()
    const t = new Date(a.startsAt).getTime()
    const cancelled = /cancel|no_show/i.test(a.status)
    if (apptFilter === 'upcoming') return t > now && !cancelled
    if (apptFilter === 'past') return t <= now && !cancelled
    return true
  })

  const bookHref = `/appointments/calendar?contactId=${encodeURIComponent(clientId)}`
  const posHref = `/appointments/point-of-sale?contactId=${encodeURIComponent(clientId)}`
  const messageHref = `/conversations?contact=${encodeURIComponent(clientId)}`

  const statusPill =
    c.status === 'BLOCKED'
      ? 'Blocked'
      : c.status === 'INVALID'
        ? 'Archived'
        : 'Active'

  return (
    <ArOpusPage>
      <ContextBackLink returnTo={null} fallbackHref="/appointments/clients" fallbackLabel="Clients" />

      <PageHeader
        title={d.displayName}
        description={`${c.email || 'No email'} · ${c.phone}`}
        meta={
          <div className="flex flex-wrap gap-2">
            <Pill tone="neutral" dot={false}>{statusPill}</Pill>
            {d.bookingAccess.publicBookingBlocked ? (
              <Pill tone="warning" dot={false}>Online booking blocked</Pill>
            ) : null}
            {d.balance.outstandingCents > 0 ? (
              <Pill tone="warning" dot={false}>{money(d.balance.outstandingCents)} due</Pill>
            ) : null}
            {d.balance.walletCreditCents > 0 ? (
              <Pill tone="success" dot={false}>{money(d.balance.walletCreditCents)} credit</Pill>
            ) : null}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" nativeButton={false} render={<Link href={bookHref} />}>
              <Calendar className="mr-2 h-4 w-4" aria-hidden />
              Book appointment
            </Button>
            <Button type="button" variant="secondary" nativeButton={false} render={<Link href={messageHref} />}>
              <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
              Message
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button type="button" variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setMergeOpen(true)}>Merge duplicate</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void toggleBlock()}>
                  {d.bookingAccess.publicBookingBlocked ? 'Unblock online booking' : 'Block online booking'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void archiveClient()}>Archive</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/contacts/${clientId}`)}>
                  Open in Contacts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          aria-hidden
        >
          {initials || <UserRound className="h-5 w-5" />}
        </span>
      </div>

      {error ? (
        <Callout tone="danger" title="Something went wrong" className="mb-4">
          <p className="text-sm">{error}</p>
        </Callout>
      ) : null}

      <Tabs value={section} onValueChange={(v) => setSection(v as SectionId)}>
        <TabsList className="mb-4 h-auto flex-wrap justify-start gap-1">
          {SECTIONS.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>{s.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {section === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-12">
          <Panel className="lg:col-span-7" title="Next appointment">
            {d.nextAppointment ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium">{d.nextAppointment.serviceName}</p>
                <p>{fmt(d.nextAppointment.startsAt)}</p>
                <p className="text-muted-foreground">
                  {d.nextAppointment.staffName || '—'} · {d.nextAppointment.location || '—'}
                </p>
                <p>Status: {d.nextAppointment.status}</p>
                <p>
                  Payment: {money(d.nextAppointment.amountPaidCents)} paid
                  {d.nextAppointment.balanceDueCents > 0
                    ? ` · ${money(d.nextAppointment.balanceDueCents)} due`
                    : ''}
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href={`/appointments/${d.nextAppointment.id}`} className="text-sm font-medium text-primary">
                    Open appointment
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No upcoming appointments.{' '}
                <Link href={bookHref} className="font-medium text-primary">Book appointment</Link>
              </p>
            )}
          </Panel>
          <Panel className="lg:col-span-5" title="Client summary">
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                Client since{' '}
                {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </li>
              <li>
                Total bookings{' '}
                {d.bookingStats.upcoming + d.bookingStats.completed + d.bookingStats.cancelled + d.bookingStats.noShow}
              </li>
              <li>No-shows {d.bookingStats.noShow}</li>
              <li>Cancellations {d.bookingStats.cancelled}</li>
            </ul>
          </Panel>
          <Panel className="lg:col-span-4" title="Balance">
            <p className="text-sm">Outstanding {money(d.balance.outstandingCents)}</p>
            <p className="text-sm">Account credit {money(d.balance.walletCreditCents)}</p>
            <Link href={posHref} className="mt-2 inline-block text-sm font-medium text-primary">Collect / POS</Link>
          </Panel>
          <Panel className="lg:col-span-8" title="Outstanding actions">
            {d.outstandingActions.length ? (
              <ul className="space-y-2 text-sm">
                {d.outstandingActions.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2 border-b pb-2">
                    <span>{a.label} — {a.detail}</span>
                    <Link href={a.href} className="font-medium text-primary">Open</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">None right now.</p>
            )}
          </Panel>
        </div>
      )}

      {section === 'appointments' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs value={apptFilter} onValueChange={(v) => setApptFilter(v as typeof apptFilter)}>
              <TabsList>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="past">Past</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button type="button" size="sm" nativeButton={false} render={<Link href={bookHref} />}>
              Book appointment
            </Button>
          </div>
          <OpusDataSurface className="overflow-x-auto p-0">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">When</th>
                  <th scope="col" className="px-4 py-3">Offering</th>
                  <th scope="col" className="px-4 py-3">Staff</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Payment</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAppts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3">{fmt(a.startsAt)}</td>
                    <td className="px-4 py-3">{a.serviceName}</td>
                    <td className="px-4 py-3">{a.staffName || '—'}</td>
                    <td className="px-4 py-3">{a.status}</td>
                    <td className="px-4 py-3">
                      {a.balanceDueCents > 0 ? `${money(a.balanceDueCents)} due` : 'Paid'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/appointments/${a.id}`} className="font-medium text-primary">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredAppts.length ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No appointments in this view.</p>
            ) : null}
          </OpusDataSurface>
        </div>
      )}

      {section === 'forms' && (
        <OpusDataSurface className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">Item</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {d.forms.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3">{f.formName}</td>
                  <td className="px-4 py-3">{f.status}</td>
                  <td className="px-4 py-3">{f.submittedAt ? fmt(f.submittedAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.forms.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No form submissions yet.</p>
          ) : null}
        </OpusDataSurface>
      )}

      {section === 'access' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Packages">
            <ul className="space-y-2 text-sm">
              {d.access.packages.map((p) => (
                <li key={p.id} className="flex justify-between border-b pb-2">
                  <span>{p.remaining} credits · {p.status}</span>
                  <span className="text-muted-foreground">
                    {p.expiresAt ? `Expires ${new Date(p.expiresAt).toLocaleDateString()}` : ''}
                  </span>
                </li>
              ))}
              {!d.access.packages.length ? <li className="text-muted-foreground">No packages.</li> : null}
            </ul>
            <Link href={posHref} className="mt-3 inline-block text-sm font-medium text-primary">Sell package (POS)</Link>
          </Panel>
          <Panel title="Memberships">
            <ul className="space-y-2 text-sm">
              {d.access.memberships.map((m) => (
                <li key={m.id} className="flex justify-between border-b pb-2">
                  <span>{m.status}</span>
                  <span className="text-muted-foreground">{m.billingInterval || ''}</span>
                </li>
              ))}
              {!d.access.memberships.length ? <li className="text-muted-foreground">No memberships.</li> : null}
            </ul>
          </Panel>
        </div>
      )}

      {section === 'payments' && (
        <div className="space-y-4">
          <Panel>
            <p className="text-sm">Outstanding {money(d.balance.outstandingCents)}</p>
            <p className="text-sm">Credit {money(d.balance.walletCreditCents)}</p>
          </Panel>
          <OpusDataSurface className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Description</th>
                  <th scope="col" className="px-4 py-3">Amount</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {d.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3">{fmt(t.at)}</td>
                    <td className="px-4 py-3">{t.description}</td>
                    <td className="px-4 py-3">{money(t.amountCents)}</td>
                    <td className="px-4 py-3">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!d.transactions.length ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
            ) : null}
          </OpusDataSurface>
        </div>
      )}

      {section === 'messages' && (
        <Panel title="Messages">
          <p className="text-sm text-muted-foreground">Use the canonical inbox for full thread history.</p>
          <Button type="button" className="mt-4" nativeButton={false} render={<Link href={messageHref} />}>
            Open messages
          </Button>
        </Panel>
      )}

      {section === 'notes' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Internal notes">
            <Textarea
              rows={3}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Staff-only note"
            />
            <Button type="button" size="sm" className="mt-2" onClick={() => void addNote()}>Add note</Button>
            <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-sm">
              {d.notes.map((n) => (
                <li key={n.id} className="rounded-md border p-3">
                  <p>{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.at).toLocaleString()}{n.author ? ` · ${n.author}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Activity">
            <ul className="max-h-96 space-y-1 overflow-y-auto text-sm text-muted-foreground">
              {d.activity.map((ev, i) => (
                <li key={`${ev.at}-${i}`}>{new Date(ev.at).toLocaleString()} — {ev.label}</li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {section === 'profile' && (
        <Panel title="Profile" className="max-w-xl">
          <div className="space-y-4">
            {(['firstName', 'lastName', 'email', 'phone', 'timezone'] as const).map((field) => (
              <div key={field}>
                <Label htmlFor={`profile-${field}`} className="capitalize">
                  {field.replace(/([A-Z])/g, ' $1')}
                </Label>
                <Input
                  id={`profile-${field}`}
                  className="mt-1"
                  value={profileDraft[field] ?? (c[field] as string) ?? ''}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, [field]: e.target.value }))}
                />
              </div>
            ))}
            <Button type="button" onClick={() => void saveProfile()}>Save profile</Button>
            <p className="text-xs text-muted-foreground">
              Email and phone changes affect booking identity matching and future portal login.
            </p>
          </div>
        </Panel>
      )}

      {mergeOpen ? (
        <MergeClientsModal
          primaryClientId={clientId}
          onClose={() => setMergeOpen(false)}
          onMerged={(id) => {
            setMergeOpen(false)
            router.replace(`/appointments/clients/${id}`)
            void detail.reload()
          }}
        />
      ) : null}
    </ArOpusPage>
  )
}
