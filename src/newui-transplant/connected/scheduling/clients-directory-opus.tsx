'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CalendarClock, Plus, UserRound, Users, Wallet } from 'lucide-react'
import { useClientsWorkspace } from '@/features/appointments/kimi/clients/use-clients-workspace'
import {
  ArOpusPage,
  ArStatGrid,
  OpusDataSurface,
  OpusSearchField,
  OpusTableSkeleton,
} from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import {
  OpusListControls,
  OpusMetricBand,
  OpusPremiumDialogHeader,
  OpusSchedulingHero,
  OpusTd,
  OpusTh,
  OPUS_TABLE_HEAD,
} from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { Callout, EmptyState, Initials, Pill, Stat, TextLink } from '@/newui-transplant/components/app/kit'
import { cn } from '@/lib/utils'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/newui-transplant/components/ui/dialog'
import { Input } from '@/newui-transplant/components/ui/input'
import { Label } from '@/newui-transplant/components/ui/label'

function fmt(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

function CreateClientDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setError('')
    if (!phone.trim()) {
      setError('Phone is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/appointments/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, phone }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not create client')
      onCreated(json.data?.id || json.data?.clientId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <OpusPremiumDialogHeader
          icon={UserRound}
          title="Add client"
          description="Create a profile for manual booking and reminders."
        />
        <div className="space-y-3 px-6 py-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="c-first">First name</Label>
              <Input id="c-first" className="mt-1" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="c-last">Last name</Label>
              <Input id="c-last" className="mt-1" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="c-email">Email</Label>
            <Input id="c-email" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-phone">Phone</Label>
            <Input id="c-phone" className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="border-t bg-muted/20 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={saving} onClick={() => void submit()}>Save client</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ClientsDirectoryOpus() {
  const ws = useClientsWorkspace()
  const [createOpen, setCreateOpen] = useState(false)

  const summary = ws.data?.summary
  const rows = ws.data?.directory || []

  return (
    <ArOpusPage wide>
      <OpusSchedulingHero
        icon={Users}
        title="Clients"
        description="Customer profiles, bookings, balances, and appointment history."
        actions={
          <>
            <Button type="button" variant="outline" nativeButton={false} render={<Link href="/contacts/imports" />}>
              Import
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" aria-hidden />
              Add client
            </Button>
          </>
        }
      />

      {summary ? (
        <OpusMetricBand>
          <ArStatGrid>
            <Stat label="Total clients" value={String(summary.totalClients)} icon={Users} />
            <Stat label="Active" value={String(summary.active)} icon={UserRound} />
            <Stat label="Upcoming bookings" value={String(summary.upcomingBookings)} icon={CalendarClock} />
            <Stat label="Open balances" value={String(summary.openBalances)} icon={Wallet} />
          </ArStatGrid>
        </OpusMetricBand>
      ) : null}

      <OpusListControls>
        <OpusSearchField
          id="clients-search"
          label="Search clients"
          value={ws.q}
          onChange={ws.setQ}
          placeholder="Search name, email, phone"
          className="w-full min-w-[220px] sm:max-w-md"
        />
      </OpusListControls>

      {ws.error ? (
        <Callout tone="danger" title="Could not load clients">
          <Button type="button" size="sm" className="mt-2" onClick={() => void ws.reload()}>Retry</Button>
        </Callout>
      ) : ws.loading && !ws.data ? (
        <OpusDataSurface>
          <OpusTableSkeleton label="Loading clients" />
        </OpusDataSurface>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No clients yet"
          description="Clients appear when they book or when you add them manually."
          action={
            <Button type="button" onClick={() => setCreateOpen(true)}>Add client</Button>
          }
        />
      ) : (
        <OpusDataSurface className="overflow-hidden bg-gradient-to-br from-card via-card to-primary/[0.02] p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className={OPUS_TABLE_HEAD}>
                <tr>
                  <th scope="col" className={OpusTh}>Client</th>
                  <th scope="col" className={OpusTh}>Contact</th>
                  <th scope="col" className={OpusTh}>Next appointment</th>
                  <th scope="col" className={OpusTh}>Last appointment</th>
                  <th scope="col" className={OpusTh}>Bookings</th>
                  <th scope="col" className={OpusTh}>Balance</th>
                  <th scope="col" className={OpusTh}>Status</th>
                  <th scope="col" className={cn(OpusTh, 'text-right')}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="group relative hover:bg-muted/40">
                    <td className={OpusTd}>
                      <Link
                        href={`/appointments/clients/${row.id}`}
                        className="flex items-center gap-3 font-medium after:absolute after:inset-0"
                      >
                        <Initials name={row.name} className="size-8" />
                        <span className="min-w-0 truncate">{row.name}</span>
                      </Link>
                    </td>
                    <td className={OpusTd}>
                      <div>{row.email || '—'}</div>
                      <div className="text-muted-foreground">{row.phone}</div>
                    </td>
                    <td className={cn(OpusTd, 'text-muted-foreground')}>
                      {row.nextAppointment ? `${fmt(row.nextAppointment.at)} · ${row.nextAppointment.label}` : '—'}
                    </td>
                    <td className={cn(OpusTd, 'text-muted-foreground')}>
                      {row.lastAppointment ? fmt(row.lastAppointment.at) : '—'}
                    </td>
                    <td className={OpusTd}>{row.bookingCount}</td>
                    <td className={OpusTd}>{row.balanceLabel}</td>
                    <td className={OpusTd}>
                      <Pill tone="neutral">{row.statusLabel}</Pill>
                    </td>
                    <td className={cn(OpusTd, 'relative z-10 text-right')}>
                      <TextLink href={`/appointments/clients/${row.id}`}>Open</TextLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OpusDataSurface>
      )}

      <CreateClientDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false)
          window.location.href = `/appointments/clients/${id}`
        }}
      />
    </ArOpusPage>
  )
}
