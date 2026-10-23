'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { SegmentedFilter } from '@/components/app/filters'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/app/status'
import { formatWhen } from '@/lib/format'
import { Calendar } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type Appt = {
  id: string
  title: string
  startsAt: string
  endsAt: string
  timezone: string
  status: string
  notes: string | null
  assigneeUserId: string | null
  contact: { id: string; firstName: string | null; lastName: string | null; phone: string } | null
  deal: { id: string; title: string } | null
}

type ViewMode = 'month' | 'week' | 'day' | 'list'

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

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function monthMatrix(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  const weeks: Date[][] = []
  let cursor = start
  for (let w = 0; w < 6; w++) {
    const row: Date[] = []
    for (let d = 0; d < 7; d++) {
      row.push(new Date(cursor))
      cursor = addDays(cursor, 1)
    }
    weeks.push(row)
  }
  return weeks
}

function ApptEditor({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: Partial<Appt> & { id?: string }
  onSaved: () => void
}) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [title, setTitle] = useState(initial.title || '')
  const [start, setStart] = useState(initial.startsAt?.slice(0, 16) || '')
  const [end, setEnd] = useState(initial.endsAt?.slice(0, 16) || '')
  const [timezone, setTimezone] = useState(initial.timezone || tz)
  const [contactId, setContactId] = useState(initial.contact?.id || '')
  const [assignee, setAssignee] = useState(initial.assigneeUserId || '')
  const [notes, setNotes] = useState(initial.notes || '')
  const [status, setStatus] = useState(initial.status || 'scheduled')

  useEffect(() => {
    if (!open) return
    setTitle(initial.title || '')
    setStart(initial.startsAt ? initial.startsAt.slice(0, 16) : '')
    setEnd(initial.endsAt ? initial.endsAt.slice(0, 16) : '')
    setTimezone(initial.timezone || tz)
    setContactId(initial.contact?.id || '')
    setAssignee(initial.assigneeUserId || '')
    setNotes(initial.notes || '')
    setStatus(initial.status || 'scheduled')
  }, [open, initial, tz])

  const save = () => {
    if (!title.trim() || !start || !end) {
      toast.error('Title, start, and end are required')
      return
    }
    const payload = {
      title: title.trim(),
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
      timezone,
      contactId: contactId.trim() || null,
      assigneeUserId: assignee.trim() || null,
      notes: notes.trim() || null,
      status,
    }
    const path = initial.id ? `/api/crm/native/appointments/${initial.id}` : '/api/crm/native/appointments'
    const method = initial.id ? 'PATCH' : 'POST'
    void crmSend(path, method, payload)
      .then(() => {
        toast.success(initial.id ? 'Appointment updated' : 'Appointment created')
        onOpenChange(false)
        onSaved()
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Save failed'))
  }

  const cancelAppt = () => {
    if (!initial.id) return
    if (!confirm('Cancel this appointment? It will stay on the record as cancelled.')) return
    void crmSend(`/api/crm/native/appointments/${initial.id}`, 'PATCH', { status: 'cancelled' })
      .then(() => {
        toast.success('Appointment cancelled')
        onOpenChange(false)
        onSaved()
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Cancel failed'))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{initial.id ? 'Edit appointment' : 'New appointment'}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <label>
            Title
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
          </label>
          <label>
            Start
            <Input type="datetime-local" className="mt-1" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start" />
          </label>
          <label>
            End
            <Input type="datetime-local" className="mt-1" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="End" />
          </label>
          <label>
            Timezone (IANA)
            <Input className="mt-1" value={timezone} onChange={(e) => setTimezone(e.target.value)} aria-label="Timezone" />
          </label>
          <label>
            Contact ID (optional)
            <Input className="mt-1" value={contactId} onChange={(e) => setContactId(e.target.value)} placeholder="Link to /app/contacts/…" aria-label="Contact id" />
          </label>
          <label>
            Owner user ID (optional)
            <Input className="mt-1" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Owner" />
          </label>
          <label>
            Status
            <select className="mt-1 w-full rounded border px-2 py-2" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label>
            Notes
            <Input className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" />
          </label>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" onClick={save}>{initial.id ? 'Save changes' : 'Create'}</Button>
            {initial.id && status !== 'cancelled' && (
              <Button type="button" variant="outline" onClick={cancelAppt}>Cancel appointment</Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function CalendarWorkspace() {
  const [view, setView] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const [rows, setRows] = useState<Appt[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Appt> & { id?: string }>({})

  const range = useMemo(() => {
    if (view === 'day') {
      const from = anchor
      const to = addDays(anchor, 1)
      return { from, to }
    }
    if (view === 'week') {
      const from = addDays(anchor, -((anchor.getDay() + 6) % 7))
      const to = addDays(from, 7)
      return { from, to }
    }
    if (view === 'month') {
      const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
      const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59)
      return { from, to: addDays(to, 1) }
    }
    const from = addDays(anchor, -30)
    const to = addDays(anchor, 90)
    return { from, to }
  }, [anchor, view])

  const load = useCallback(() => {
    setLoadError(null)
    const q = `from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}&includeCancelled=1`
    void crmGet<Appt[]>(`/api/crm/native/appointments?${q}`)
      .then((data) => {
        setRows(data)
        setLoadError(null)
      })
      .catch((e) => {
        setLoadError(e instanceof Error ? e.message : 'Load failed')
        setRows([])
      })
  }, [range.from, range.to])

  useEffect(() => {
    load()
  }, [load])

  const apptsForDay = (day: Date) =>
    rows.filter((a) => sameDay(new Date(a.startsAt), day) && a.status !== 'cancelled')

  const openNew = (day?: Date) => {
    const base = day ? new Date(day) : new Date(anchor)
    base.setHours(9, 0, 0, 0)
    const end = new Date(base.getTime() + 3600000)
    setEditing({
      title: '',
      startsAt: base.toISOString(),
      endsAt: end.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      status: 'scheduled',
    })
    setEditorOpen(true)
  }

  const shift = (dir: -1 | 1) => {
    if (view === 'day') setAnchor(addDays(anchor, dir))
    else if (view === 'week') setAnchor(addDays(anchor, dir * 7))
    else if (view === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1))
    else setAnchor(addDays(anchor, dir * 14))
  }

  const titleLabel = useMemo(() => {
    if (view === 'day') return anchor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    if (view === 'week') {
      const from = addDays(anchor, -((anchor.getDay() + 6) % 7))
      const to = addDays(from, 6)
      return `${from.toLocaleDateString()} – ${to.toLocaleDateString()}`
    }
    if (view === 'month') return anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    return 'Upcoming appointments'
  }, [anchor, view])

  return (
    <Page>
      <PageHeader
        title="Calendar"
        description="CRM appointments with month, week, day, and list views."
        actions={
          <Button type="button" onClick={() => openNew()}>New appointment</Button>
        }
      />
      <CrmLoadError message={loadError} />
      <Panel
        title={titleLabel}
        description="Times display in each appointment’s stored timezone on detail; grid uses your browser locale."
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SegmentedFilter
            label="Calendar view"
            value={view}
            onChange={(v) => setView(v as ViewMode)}
            options={[
              { value: 'month', label: 'Month' },
              { value: 'week', label: 'Week' },
              { value: 'day', label: 'Day' },
              { value: 'list', label: 'List' },
            ]}
          />
          <div className="ml-auto flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="outline" onClick={() => setAnchor(startOfDay(new Date()))}>Today</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => shift(-1)}>Previous</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => shift(1)}>Next</Button>
          </div>
        </div>

        {view === 'month' && (
          <div className="grid grid-cols-7 gap-1 text-xs">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="p-1 font-medium text-muted-foreground">{d}</div>
            ))}
            {monthMatrix(anchor).flat().map((day) => {
              const inMonth = day.getMonth() === anchor.getMonth()
              const items = apptsForDay(day)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  className={`min-h-[72px] rounded border p-1 text-left ${inMonth ? 'bg-card' : 'bg-muted/30 text-muted-foreground'}`}
                  onClick={() => openNew(day)}
                >
                  <span className="font-medium">{day.getDate()}</span>
                  <ul className="mt-1 space-y-0.5">
                    {items.slice(0, 2).map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          className="truncate text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditing(a)
                            setEditorOpen(true)
                          }}
                        >
                          {a.title}
                        </button>
                      </li>
                    ))}
                    {items.length > 2 && <li className="text-muted-foreground">+{items.length - 2} more</li>}
                  </ul>
                </button>
              )
            })}
          </div>
        )}

        {view === 'week' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => {
              const day = addDays(addDays(anchor, -((anchor.getDay() + 6) % 7)), i)
              const items = apptsForDay(day)
              return (
                <div key={day.toISOString()} className="rounded border p-2">
                  <p className="text-xs font-medium">{day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {items.map((a) => (
                      <li key={a.id}>
                        <button type="button" className="text-left hover:text-primary" onClick={() => { setEditing(a); setEditorOpen(true) }}>
                          <span className="font-medium">{a.title}</span>
                          <span className="block text-xs text-muted-foreground">{formatWhen(a.startsAt)}</span>
                        </button>
                      </li>
                    ))}
                    {!items.length && <li className="text-xs text-muted-foreground">No events</li>}
                  </ul>
                  <Button type="button" size="sm" variant="ghost" className="mt-2 h-7 text-xs" onClick={() => openNew(day)}>Add</Button>
                </div>
              )
            })}
          </div>
        )}

        {view === 'day' && (
          <ul className="space-y-2 text-sm">
            {apptsForDay(anchor).length === 0 ? (
              <EmptyState icon={Calendar} title="No appointments" description="Create one for this day." />
            ) : (
              apptsForDay(anchor).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2">
                  <div>
                    <button type="button" className="font-medium hover:text-primary" onClick={() => { setEditing(a); setEditorOpen(true) }}>{a.title}</button>
                    <p className="text-xs text-muted-foreground">{formatWhen(a.startsAt)} – {formatWhen(a.endsAt)} · {a.timezone}</p>
                  </div>
                  {a.contact && (
                    <Link href={`/app/contacts/${a.contact.id}`} className="text-xs text-primary">Contact</Link>
                  )}
                </li>
              ))
            )}
          </ul>
        )}

        {view === 'list' && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">When</TableHead>
                <TableHead scope="col">Title</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Contact</TableHead>
                <TableHead scope="col">Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{formatWhen(a.startsAt)}</TableCell>
                  <TableCell>
                    <button type="button" className="font-medium hover:text-primary" onClick={() => { setEditing(a); setEditorOpen(true) }}>{a.title}</button>
                  </TableCell>
                  <TableCell><StatusBadge tone={a.status === 'cancelled' ? 'muted' : 'info'}>{a.status}</StatusBadge></TableCell>
                  <TableCell>
                    {a.contact ? (
                      <Link href={`/app/contacts/${a.contact.id}`} className="text-primary text-xs">
                        {[a.contact.firstName, a.contact.lastName].filter(Boolean).join(' ') || a.contact.phone}
                      </Link>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{a.assigneeUserId?.slice(0, 8) || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
      <ApptEditor open={editorOpen} onOpenChange={setEditorOpen} initial={editing} onSaved={load} />
    </Page>
  )
}

function CrmLoadError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
      {message}
    </p>
  )
}
