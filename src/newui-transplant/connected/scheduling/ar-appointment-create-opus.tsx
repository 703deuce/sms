'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  CalendarPlus,
  Plus,
  Search,
  UserRound,
  X,
} from 'lucide-react'
import { useAppointmentCreateForm } from '@/lib/appointments/use-appointment-create-form'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { OpusSchedulingHero } from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { ArAppointmentSlotPicker } from '@/newui-transplant/components/scheduling/ar-appointment-slot-picker'
import { Callout, OpusIconBadge, Panel, Pill } from '@/newui-transplant/components/app/kit'
import { OPUS_CONFIG_INSET } from '@/newui-transplant/components/app/opus-surfaces'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { Button } from '@/newui-transplant/components/ui/button'
import { Checkbox } from '@/newui-transplant/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/newui-transplant/components/ui/dialog'
import { Input } from '@/newui-transplant/components/ui/input'
import { Label } from '@/newui-transplant/components/ui/label'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { cn } from '@/lib/utils'

function StepHeading({
  step,
  title,
  description,
  icon,
}: {
  step: string
  title: string
  description?: string
  icon?: typeof CalendarPlus
}) {
  const Icon = icon
  return (
    <div className="flex items-start gap-3">
      {Icon ? (
        <OpusIconBadge icon={Icon} className="size-9 rounded-xl" />
      ) : (
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-xs font-bold tabular-nums text-primary ring-1 ring-primary/15"
          aria-hidden
        >
          {step}
        </span>
      )}
      <div>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Step {step}</p>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-destructive">
      <AlertCircle className="size-3" aria-hidden />
      {message}
    </p>
  )
}

export function ArAppointmentCreateOpus() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialStartsAt = useMemo(() => {
    const raw = searchParams.get('startsAt') || searchParams.get('start')
    if (!raw) return undefined
    const parsed = new Date(raw)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
  }, [searchParams])

  const form = useAppointmentCreateForm(initialStartsAt)
  const [discardOpen, setDiscardOpen] = useState(false)

  const typeOptions = form.types.map((t) => ({
    value: t.id,
    label: `${t.name} · ${t.durationMinutes} min`,
  }))

  if (form.view === 'cancelled') {
    return (
      <ArOpusPage className="max-w-2xl">
        <Panel title="Booking discarded" className="text-center">
          <p className="text-sm text-muted-foreground">No appointment was created.</p>
          <Button type="button" className="mt-4" onClick={() => form.resetForm()}>
            <Plus className="mr-2 size-4" aria-hidden />
            Start a new appointment
          </Button>
        </Panel>
      </ArOpusPage>
    )
  }

  if (form.view === 'success' && form.createdId) {
    return (
      <ArOpusPage className="max-w-2xl">
        <Panel className="text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-600" aria-hidden />
          <h1 className="mt-4 text-xl font-semibold">Appointment created</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {form.selectedType?.name} for {form.firstName} {form.lastName}
            {form.summaryDate ? (
              <>
                <br />
                <span className="font-medium text-foreground">{form.summaryDate}</span>
              </>
            ) : null}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button
              type="button"
              nativeButton={false}
              render={<Link href={`/appointments/${form.createdId}`} />}
            >
              View appointment
            </Button>
            <Button type="button" variant="outline" onClick={() => form.bookAnother()}>
              Book another
            </Button>
          </div>
        </Panel>
      </ArOpusPage>
    )
  }

  return (
    <ArOpusPage wide>
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href={AR_ROUTES.appointments} className="font-medium hover:text-foreground">
          Appointments
        </Link>
        <ChevronRight className="size-3" aria-hidden />
        <span className="font-medium text-foreground" aria-current="page">New</span>
      </nav>

      <OpusSchedulingHero
        icon={CalendarPlus}
        title="New appointment"
        description="Book a customer manually with live availability from your scheduling rules."
      />

      {form.error ? (
        <Callout tone="danger" title="Could not save">
          <p className="text-sm">{form.error}</p>
        </Callout>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Panel>
            <StepHeading step="1" icon={CalendarPlus} title="Service & time" description="Choose a type, then pick an open slot." />
            <div className="mt-5 space-y-4">
              <div>
                <Label htmlFor="appt-type">Appointment type</Label>
                <SimpleSelect
                  id="appt-type"
                  label="Appointment type"
                  className="mt-1.5"
                  value={form.serviceId}
                  onChange={(v) => {
                    form.setServiceId(v)
                    form.setStartsAt('')
                  }}
                  options={typeOptions.length ? typeOptions : [{ value: '', label: 'No types configured' }]}
                />
                <FieldError message={form.fieldErrors.service} />
              </div>
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <Label>Available times</Label>
                  <span className="text-xs text-muted-foreground">Next 14 days</span>
                </div>
                <ArAppointmentSlotPicker
                  slots={form.slots}
                  loading={form.loadingSlots}
                  selected={form.startsAt}
                  onSelect={(s) => {
                    form.setStartsAt(s)
                    form.setFieldErrors((p) => ({ ...p, slot: '' }))
                  }}
                  error={form.slotError}
                />
                <FieldError message={form.fieldErrors.slot} />
              </div>
            </div>
          </Panel>

          <Panel>
            <StepHeading step="2" icon={UserRound} title="Customer" description="Search a contact or enter details." />
            <div className="mt-5 space-y-4">
              <div ref={form.contactRef} className="relative">
                <Label htmlFor="contact-search">Link existing contact</Label>
                <div className="relative mt-1.5">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="contact-search"
                    className="pl-9"
                    value={form.contactQuery}
                    onChange={(e) => {
                      form.setContactQuery(e.target.value)
                      form.setContactOpen(true)
                    }}
                    onFocus={() => form.setContactOpen(true)}
                    placeholder="Search by name, phone, or email…"
                    role="combobox"
                    aria-expanded={form.contactOpen}
                  />
                  {form.linkedContact ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      aria-label="Clear linked contact"
                      onClick={() => form.clearContact()}
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
                {form.contactOpen && form.contacts.length > 0 ? (
                  <ul
                    className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-popover py-1 shadow-md"
                    role="listbox"
                  >
                    {form.contacts.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => form.pickContact(c.id)}
                        >
                          {c.firstName} {c.lastName}
                          <span className="block text-xs text-muted-foreground">{c.phone}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="first-name">First name</Label>
                  <Input
                    id="first-name"
                    className="mt-1.5"
                    value={form.firstName}
                    onChange={(e) => form.setFirstName(e.target.value)}
                  />
                  <FieldError message={form.fieldErrors.firstName} />
                </div>
                <div>
                  <Label htmlFor="last-name">Last name</Label>
                  <Input id="last-name" className="mt-1.5" value={form.lastName} onChange={(e) => form.setLastName(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Mobile phone</Label>
                <Input id="phone" className="mt-1.5" value={form.phone} onChange={(e) => form.setPhone(e.target.value)} />
                <FieldError message={form.fieldErrors.phone} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" className="mt-1.5" value={form.email} onChange={(e) => form.setEmail(e.target.value)} />
                <FieldError message={form.fieldErrors.email} />
              </div>
              <div>
                <Label htmlFor="notes">Internal notes</Label>
                <Textarea id="notes" className="mt-1.5" rows={3} value={form.notes} onChange={(e) => form.setNotes(e.target.value)} />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={form.smsConsent} onCheckedChange={(v) => form.setSmsConsent(v === true)} />
                <span>Customer agreed to receive SMS about this appointment</span>
              </label>
            </div>
          </Panel>
        </div>

        <aside className={cn(OPUS_CONFIG_INSET, 'sticky top-4 space-y-4 p-4 lg:p-5')}>
          <h2 className="text-sm font-semibold">Summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium text-right">{form.selectedType?.name || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">When</dt>
              <dd className="font-medium text-right">{form.summaryDate || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Customer</dt>
              <dd className="font-medium text-right">
                {form.firstName || form.lastName ? `${form.firstName} ${form.lastName}`.trim() : '—'}
              </dd>
            </div>
          </dl>
          <Pill tone="neutral">Uses live availability rules</Pill>
          <div className="flex flex-col gap-2 pt-2">
            <Button type="button" disabled={form.saving} onClick={() => void form.submit()}>
              {form.saving ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
              Create appointment
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const r = form.requestCancel()
                if (r === 'confirm') setDiscardOpen(true)
              }}
            >
              Cancel
            </Button>
          </div>
        </aside>
      </div>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this booking?</DialogTitle>
            <DialogDescription>Unsaved changes will be lost.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDiscardOpen(false)}>Keep editing</Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDiscardOpen(false)
                form.confirmDiscard()
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ArOpusPage>
  )
}
