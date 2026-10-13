'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Plus, UserRound } from 'lucide-react'
import { useClientsWorkspace } from '@/features/appointments/kimi/clients/use-clients-workspace'
import { ArOpusPage, OpusDataSurface, OpusSearchField } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Callout, EmptyState, PageHeader, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add client</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
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
        <DialogFooter>
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
      <PageHeader
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
        <div className="flex flex-wrap gap-2">
          <Pill tone="neutral">{summary.totalClients} total</Pill>
          <Pill tone="neutral">{summary.active} active</Pill>
          <Pill tone="neutral">{summary.upcomingBookings} upcoming</Pill>
          <Pill tone="neutral">{summary.openBalances} open balances</Pill>
        </div>
      ) : null}

      <OpusSearchField
        id="clients-search"
        label="Search clients"
        value={ws.q}
        onChange={ws.setQ}
        placeholder="Search name, email, phone"
        className="max-w-md"
      />

      {ws.error ? (
        <Callout tone="danger" title="Could not load clients">
          <Button type="button" size="sm" className="mt-2" onClick={() => void ws.reload()}>Retry</Button>
        </Callout>
      ) : ws.loading && !ws.data ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
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
        <OpusDataSurface className="overflow-x-auto p-0">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">Client</th>
                <th scope="col" className="px-4 py-3">Contact</th>
                <th scope="col" className="px-4 py-3">Next appointment</th>
                <th scope="col" className="px-4 py-3">Last appointment</th>
                <th scope="col" className="px-4 py-3">Bookings</th>
                <th scope="col" className="px-4 py-3">Balance</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {row.initials}
                      </span>
                      <span className="font-medium">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{row.email || '—'}</div>
                    <div className="text-muted-foreground">{row.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    {row.nextAppointment ? `${fmt(row.nextAppointment.at)} · ${row.nextAppointment.label}` : '—'}
                  </td>
                  <td className="px-4 py-3">{row.lastAppointment ? fmt(row.lastAppointment.at) : '—'}</td>
                  <td className="px-4 py-3">{row.bookingCount}</td>
                  <td className="px-4 py-3">{row.balanceLabel}</td>
                  <td className="px-4 py-3">
                    <Pill tone="neutral">{row.statusLabel}</Pill>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/appointments/clients/${row.id}`} className="text-sm font-medium text-primary">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
