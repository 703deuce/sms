'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, CalendarDays, Clock, Link2, ListChecks, MapPin, Pencil, Plus, Settings2, Trash2, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { OptionGroup } from '@/components/app/option-group'
import { SimpleSelect } from '@/components/app/filters'
import { StatusBadge } from '@/components/app/status'
import { Callout } from '@/components/numbers/number-ui'
import { useAgent } from '@/components/providers/agent-provider'
import type { AgentConfig, AppointmentType } from '@/lib/agent'
import { isBookingLinkOnlyLaunch } from '@/lib/receptionist/booking-launch-mode'
import { DemoNote, JumpChips, Pills, Section, ToggleRow } from './ai-ui'

const LINK_ONLY_LAUNCH = isBookingLinkOnlyLaunch()

type Appt = AgentConfig['appointments']

type CalendarRow = { provider: string; status: string; name?: string }

function providerCards(calendars: CalendarRow[]): { value: Appt['provider']; label: string; detail: string; tone: 'success' | 'danger' | 'muted' }[] {
  const row = (p: string) => calendars.find((c) => c.provider === p)
  const detail = (p: string, fallback: string) => {
    const r = row(p)
    if (!r) return fallback
    if (r.status === 'connected' || r.status === 'active' || r.status === 'ok') {
      return r.name ? `Connected · ${r.name}` : 'Connected — select calendar in Integrations'
    }
    if (r.status === 'needs_reauth' || r.status === 'error') return 'Needs reconnect in Integrations'
    return fallback
  }
  const tone = (p: string): 'success' | 'danger' | 'muted' => {
    const r = row(p)
    if (!r) return 'muted'
    if (r.status === 'connected' || r.status === 'active' || r.status === 'ok') return 'success'
    if (r.status === 'needs_reauth' || r.status === 'error') return 'danger'
    return 'muted'
  }
  return [
    { value: 'google', label: 'Google Calendar', detail: detail('google', 'Not connected'), tone: tone('google') },
    { value: 'microsoft', label: 'Microsoft 365', detail: detail('microsoft', 'Connect for live Outlook booking'), tone: tone('microsoft') },
    { value: 'calendly', label: 'Calendly', detail: detail('calendly', 'Connect in Integrations for link booking'), tone: tone('calendly') },
    { value: 'none', label: 'No calendar', detail: 'Use appointment requests or booking links only', tone: 'muted' },
  ]
}

const MODALITY = { in_person: { label: 'In person', icon: MapPin }, phone: { label: 'Phone', icon: Clock }, video: { label: 'Video', icon: Video } } as const

export function AppointmentsManager() {
  const { draft, update } = useAgent()
  const a = draft.appointments
  const set = (patch: Partial<Appt>) => update('appointments', (x) => ({ ...x, ...patch }))
  const [editing, setEditing] = useState<AppointmentType | null>(null)
  const [calendars, setCalendars] = useState<CalendarRow[]>([])
  const bookingOff = !draft.capabilities.book

  useEffect(() => {
    if (LINK_ONLY_LAUNCH) return
    void fetch('/api/integrations/status')
      .then((r) => r.json())
      .then((j) => setCalendars((j.data?.calendars as CalendarRow[]) ?? []))
      .catch(() => setCalendars([]))
  }, [])

  useEffect(() => {
    if (!LINK_ONLY_LAUNCH || bookingOff) return
    if (a.strategy !== 'link' || a.provider !== 'none') {
      set({ strategy: 'link', provider: 'none' })
    }
  }, [bookingOff, a.strategy, a.provider, set])

  const PROVIDERS = providerCards(calendars)
  const returnTo = encodeURIComponent('/app/receptionist/appointments')

  return (
    <div className="flex flex-col gap-4">
      {bookingOff && (
        <Callout tone="warning" title="Booking is turned off">
          Ava won&apos;t offer appointments until &ldquo;Book appointments&rdquo; is on.{' '}
          <button type="button" className="font-medium underline underline-offset-2" onClick={() => update('capabilities', (c) => ({ ...c, book: true }))}>Turn it on in the draft</button>
        </Callout>
      )}

      <JumpChips
        items={
          LINK_ONLY_LAUNCH
            ? [{ id: 'strategy', label: 'Booking link' }, { id: 'types', label: 'Appointment types' }]
            : [
                { id: 'strategy', label: 'Booking strategy' },
                { id: 'types', label: 'Appointment types' },
                { id: 'flow', label: 'Booking flow' },
                { id: 'changes', label: 'Reschedule & cancel' },
              ]
        }
      />

      <Section
        id="strategy"
        icon={CalendarClock}
        title={LINK_ONLY_LAUNCH ? 'Booking link' : 'Booking strategy'}
        description={
          LINK_ONLY_LAUNCH
            ? 'Ava texts your scheduling link from the Transovo platform number when callers want to book.'
            : 'How Ava turns a caller into an appointment.'
        }
      >
        {LINK_ONLY_LAUNCH ? (
          <Callout tone="info" icon={Link2}>
            Live calendar booking and calendar connections are temporarily hidden. Only link-by-SMS is available right now.
          </Callout>
        ) : (
          <OptionGroup
            label="Strategy"
            value={a.strategy}
            onChange={(v) => set({ strategy: v })}
            columns={2}
            options={[
              { value: 'live', label: 'Book live', description: 'Checks real availability and books on the call.', disabled: a.provider === 'none' },
              { value: 'request', label: 'Take a request', description: 'Collects preferences; your team confirms.' },
              { value: 'link', label: 'Text a booking link', description: 'Sends your scheduling link by SMS.' },
              { value: 'none', label: 'Don’t book', description: 'Offer a callback instead.' },
            ]}
          />
        )}
        {!LINK_ONLY_LAUNCH && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Calendar</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={a.provider === p.value}
                  onClick={() => set({ provider: p.value, strategy: p.value === 'none' && a.strategy === 'live' ? 'request' : a.strategy })}
                  className="flex items-center gap-3 rounded-lg surface p-3 text-left transition-all aria-pressed:ring-2 aria-pressed:ring-primary"
                >
                  <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">{p.label}</span>
                    <span className="truncate text-xs text-muted-foreground">{p.detail}</span>
                  </span>
                  {p.tone !== 'muted' && <StatusBadge tone={p.tone}>{p.tone === 'success' ? 'Connected' : 'Error'}</StatusBadge>}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/app/integrations" className="text-xs font-medium text-primary hover:underline">
                Manage calendar connections in Integrations
              </Link>
              {a.provider === 'microsoft' && providerCards(calendars).find((p) => p.value === 'microsoft')?.tone !== 'success' && (
                <Link href={`/app/integrations?connect=microsoft&returnTo=${returnTo}`} className="text-xs font-medium text-primary hover:underline">
                  Connect Microsoft 365
                </Link>
              )}
            </div>
          </div>
        )}
        {(LINK_ONLY_LAUNCH || a.strategy === 'link') && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2"><Label htmlFor="bl">Booking link</Label><Input id="bl" type="url" value={a.bookingLink} onChange={(e) => set({ bookingLink: e.target.value })} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="bs">Sent from</Label><Input id="bs" value={a.linkSender} readOnly placeholder="Transovo platform number" /></div>
          </div>
        )}
        {!LINK_ONLY_LAUNCH && a.provider === 'calendly' && (
          <Callout tone="warning" icon={Link2}>Calendly is disconnected. Live booking will fail and fall back to taking a request until you reconnect.</Callout>
        )}
      </Section>

      <Section id="types" icon={ListChecks} title="Appointment types" description="Ava only offers enabled types.">
        <div className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/8">
          {a.types.map((t) => {
            const M = MODALITY[t.modality]
            return (
              <div key={t.id} className="flex items-center gap-3 p-3.5">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {t.name}
                    {t.booking === 'request' && <StatusBadge tone="neutral">Request only</StatusBadge>}
                  </span>
                  <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="size-3" aria-hidden />{t.duration} min</span>
                    <span className="flex items-center gap-1"><M.icon className="size-3" aria-hidden />{t.location}</span>
                    <span className="flex items-center gap-1"><CalendarDays className="size-3" aria-hidden />{t.calendar}</span>
                    <span>{t.hours}</span>
                  </span>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)}><Pencil /></Button>
                <Switch checked={t.enabled} onCheckedChange={(v) => set({ types: a.types.map((x) => (x.id === t.id ? { ...x, enabled: v } : x)) })} aria-label={`Offer ${t.name}`} />
              </div>
            )
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setEditing({ id: `a_${Date.now()}`, name: '', duration: 30, modality: 'in_person', location: 'Lakeshore office', calendar: 'Dr. Okafor', hours: 'Business hours', noticeHours: 24, advanceDays: 30, booking: 'book', enabled: true, requiredFields: [] })}
        >
          <Plus data-icon="inline-start" />Add type
        </Button>
      </Section>

      {!LINK_ONLY_LAUNCH && (
      <Section id="flow" icon={Settings2} title="Booking flow" description="The questions Ava asks and how she offers times.">
        <div className="divide-y">
          <ToggleRow title="Ask which appointment type" checked={a.askType} onChange={(v) => set({ askType: v })} />
          <ToggleRow title="Ask new or existing patient" checked={a.askNewExisting} onChange={(v) => set({ askNewExisting: v })} />
          <ToggleRow title="Ask preferred day first" description="Otherwise Ava offers the earliest openings." checked={a.preferredDayFirst} onChange={(v) => set({ preferredDayFirst: v })} />
          <ToggleRow title="Confirm details before booking" description="Reads back type, time and name before writing to the calendar." checked={a.confirmBeforeWrite} onChange={(v) => set({ confirmBeforeWrite: v })} />
          <ToggleRow title="Text a confirmation" description={draft.capabilities.smsConfirm ? 'Requires SMS consent on the call.' : 'Turn on SMS confirmation in Capabilities.'} disabled={!draft.capabilities.smsConfirm} checked={a.smsConfirmation && draft.capabilities.smsConfirm} onChange={(v) => set({ smsConfirmation: v })} />
        </div>
        <Pills label="Times offered at once" value={String(a.offerCount) as '2' | '3' | '4'} onChange={(v) => set({ offerCount: Number(v) })} options={[{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]} />
      </Section>
      )}

      {!LINK_ONLY_LAUNCH && (
      <Section id="changes" icon={CalendarDays} title="Reschedule & cancel" defaultOpen={false} description="What callers can change on their own.">
        <div className="divide-y">
          <ToggleRow title="Allow rescheduling" checked={a.allowReschedule && draft.capabilities.reschedule} disabled={!draft.capabilities.reschedule} onChange={(v) => set({ allowReschedule: v })} />
          <ToggleRow title="Allow cancellations" checked={a.allowCancel && draft.capabilities.cancel} disabled={!draft.capabilities.cancel} onChange={(v) => set({ allowCancel: v })} />
        </div>
        <div className="flex flex-col gap-2"><Label htmlFor="cp">Cancellation policy Ava reads</Label><Textarea id="cp" rows={2} value={a.cancelPolicy} onChange={(e) => set({ cancelPolicy: e.target.value })} /></div>
      </Section>
      )}

      <DemoNote />
      <TypeSheet value={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function TypeSheet({ value, onClose }: { value: AppointmentType | null; onClose: () => void }) {
  const { draft, update } = useAgent()
  const [form, setForm] = useState<AppointmentType | null>(null)
  const f = form ?? value
  const exists = !!value && draft.appointments.types.some((t) => t.id === value.id)
  const close = () => { setForm(null); onClose() }
  const save = (types: AppointmentType[]) => update('appointments', (a) => ({ ...a, types }))

  return (
    <Sheet open={!!value} onOpenChange={(o) => { if (!o) close() }}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-5">
          <SheetTitle>{exists ? 'Edit appointment type' : 'New appointment type'}</SheetTitle>
          <SheetDescription>Saved to your draft.</SheetDescription>
        </SheetHeader>
        {f && (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
            <div className="flex flex-col gap-2"><Label htmlFor="t-name">Name</Label><Input id="t-name" value={f.name} onChange={(e) => setForm({ ...f, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2"><Label htmlFor="t-dur">Duration (min)</Label><Input id="t-dur" type="number" min={5} step={5} value={f.duration} onChange={(e) => setForm({ ...f, duration: Number(e.target.value) })} /></div>
              <div className="flex flex-col gap-2">
                <Label>Format</Label>
                <SimpleSelect label="Format" value={f.modality} onChange={(v) => setForm({ ...f, modality: v })} options={(Object.keys(MODALITY) as AppointmentType['modality'][]).map((m) => ({ value: m, label: MODALITY[m].label }))} />
              </div>
            </div>
            <div className="flex flex-col gap-2"><Label htmlFor="t-loc">Location</Label><Input id="t-loc" value={f.location} onChange={(e) => setForm({ ...f, location: e.target.value })} /></div>
            {!LINK_ONLY_LAUNCH && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2"><Label htmlFor="t-cal">Calendar</Label><Input id="t-cal" value={f.calendar} onChange={(e) => setForm({ ...f, calendar: e.target.value })} /></div>
              <div className="flex flex-col gap-2"><Label htmlFor="t-hrs">Bookable hours</Label><Input id="t-hrs" value={f.hours} onChange={(e) => setForm({ ...f, hours: e.target.value })} /></div>
            </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2"><Label htmlFor="t-notice">Min notice (hrs)</Label><Input id="t-notice" type="number" min={0} value={f.noticeHours} onChange={(e) => setForm({ ...f, noticeHours: Number(e.target.value) })} /></div>
              <div className="flex flex-col gap-2"><Label htmlFor="t-adv">Book up to (days)</Label><Input id="t-adv" type="number" min={1} value={f.advanceDays} onChange={(e) => setForm({ ...f, advanceDays: Number(e.target.value) })} /></div>
            </div>
            {!LINK_ONLY_LAUNCH && (
            <Pills label="Ava can" value={f.booking} onChange={(v) => setForm({ ...f, booking: v })} options={[{ value: 'book', label: 'Book directly' }, { value: 'request', label: 'Take a request' }]} />
            )}
          </div>
        )}
        <SheetFooter className="flex-row justify-between border-t p-4">
          {exists ? <Button variant="ghost" className="text-destructive" onClick={() => { save(draft.appointments.types.filter((t) => t.id !== value!.id)); close() }}><Trash2 data-icon="inline-start" />Remove</Button> : <span />}
          <Button disabled={!f?.name.trim()} onClick={() => { if (!f) return; save(exists ? draft.appointments.types.map((t) => (t.id === f.id ? f : t)) : [...draft.appointments.types, f]); close() }}>Save to draft</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
