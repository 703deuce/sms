'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  ClipboardCheck,
  FileText,
  Link2,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Presentation,
  Video,
} from 'lucide-react'
import {
  buildSavePayload,
  EMPTY_APPOINTMENT_TYPE_FORM,
  type ApiAppointmentType,
} from '@/features/appointments/kimi/appointment-types/map-appointment-types'
import type { AppointmentTypeFormState } from '@/features/appointments/kimi/appointment-types/types'
import { defaultConfigForSegment, segmentById } from '@/lib/appointments/booking-types-segments'
import { defaultConfigPatchForKind } from '@/lib/appointments/booking-type-kind'
import { newStaffMember } from '@/features/appointments/kimi/shared/platform-settings-types'
import {
  isValidMeetingLink,
  MEETING_METHODS,
  methodDef,
  type MeetingMethodDef,
} from '@/lib/appointments/meetings/meeting-methods'
import {
  availabilityScheduleLabel,
  formatDurationMinutes,
  meetingMethodLabel,
} from '@/lib/appointments/meetings/meeting-display'
import { ChoiceCard, Field, NumberField, SelectInput, TextArea, TextInput } from '@/components/appointments/workspace-ui'
import {
  AR_BOOKING_MEETINGS_ROUTES,
  type MeetingsWorkspaceRoutes,
} from '@/lib/appointments/bookable-workspace-routes'
import { OpusSchedulingHero } from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { Page, Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { cn } from '@/lib/utils'
import '@/newui-transplant/connected/appointment-reminders/ar-meetings-editor-opus.css'

const STEPS = [
  { label: 'Basics', icon: FileText },
  { label: 'How you\'ll meet', icon: Video },
  { label: 'Availability', icon: CalendarClock },
  { label: 'Review', icon: ClipboardCheck },
] as const

const METHOD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Transovo Video': Video,
  'Google Meet': Video,
  'Microsoft Teams': Presentation,
  Zoom: Video,
  Webex: Video,
  'Custom meeting link': Link2,
  'In person': MapPin,
  'Phone call': Phone,
}

export function ArMeetingCreateOpus({
  routes = AR_BOOKING_MEETINGS_ROUTES,
}: {
  routes?: MeetingsWorkspaceRoutes
} = {}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<AppointmentTypeFormState>(EMPTY_APPOINTMENT_TYPE_FORM)
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; name: string }>>([])
  const [scheduleOptions, setScheduleOptions] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showValidation, setShowValidation] = useState(false)
  const [newHost, setNewHost] = useState('')
  const [addingHost, setAddingHost] = useState(false)

  useEffect(() => {
    const segment = segmentById('meetings')
    const kindPatch = defaultConfigPatchForKind('MEETING')
    const segmentPatch = defaultConfigForSegment(segment)
    setForm({
      ...EMPTY_APPOINTMENT_TYPE_FORM,
      bookingTypeKind: 'MEETING',
      classPresentation: 'recurring_class',
      groupBookingEnabled: false,
      groupCapacity: 1,
      recurringEnabled: false,
      paymentMode: 'none',
      ...kindPatch,
      ...segmentPatch,
    } as AppointmentTypeFormState)

    void fetch('/api/appointments/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const platform = json?.data || {}
        setStaffOptions(
          (platform.staff || [])
            .filter((s: { active?: boolean }) => s.active !== false)
            .map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })),
        )
        setScheduleOptions(
          (platform.namedSchedules || []).map((s: { id: string; name: string }) => ({
            id: s.id,
            name: s.name,
          })),
        )
      })
      .finally(() => setLoading(false))
  }, [])

  const update = useCallback(
    <K extends keyof AppointmentTypeFormState>(key: K, value: AppointmentTypeFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
      setError('')
    },
    [],
  )

  const staffNames = useMemo(
    () => new Map(staffOptions.map((s) => [s.id, s.name])),
    [staffOptions],
  )

  const selectedMethod = methodDef(form.location)

  const stepError = useMemo(() => {
    if (step === 0) {
      if (!form.name.trim()) return 'Give this meeting a name.'
      if (form.durationMinutes < 5) return 'Duration must be at least 5 minutes.'
      return null
    }
    if (step === 1) {
      if (!form.location) return 'Choose how you will meet.'
      if (selectedMethod?.kind === 'link' && !isValidMeetingLink(form.meetingLink)) {
        return 'Add the join link for this method.'
      }
      return null
    }
    return null
  }, [form, selectedMethod, step])

  async function addHost() {
    const name = newHost.trim()
    if (!name) return
    setAddingHost(true)
    try {
      const current = await fetch('/api/appointments/settings')
      if (!current.ok) return
      const currentJson = await current.json()
      const existing = currentJson?.data?.staff || []
      const member = { ...newStaffMember(), name }
      const res = await fetch('/api/appointments/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff: [...existing, member] }),
      })
      if (!res.ok) return
      const saved = await res.json()
      const savedStaff = (saved?.data?.staff || []) as Array<{
        id: string
        name: string
        active?: boolean
      }>
      setStaffOptions(
        savedStaff.filter((s) => s.active !== false).map((s) => ({ id: s.id, name: s.name })),
      )
      const created = savedStaff.find((s) => s.name === name)
      if (created) update('staffIds', [...form.staffIds, created.id])
      setNewHost('')
    } finally {
      setAddingHost(false)
    }
  }

  function goNext() {
    if (stepError) {
      setShowValidation(true)
      return
    }
    setShowValidation(false)
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }

  const createMeeting = useCallback(async () => {
    if (!form.name.trim()) {
      setError('Meeting name is required')
      return
    }
    setSaving(true)
    setError('')
    const payload = buildSavePayload({ ...form, bookingTypeKind: 'MEETING', enabled: true })
    const res = await fetch('/api/appointments/types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error || 'Could not create meeting')
      setSaving(false)
      return
    }
    const json = await res.json()
    const saved = json.data as ApiAppointmentType
    router.replace(`${routes.detail(saved.id)}?created=1`)
  }, [form, router, routes])

  function selectMethod(def: MeetingMethodDef) {
    update('location', def.value)
    update('transovoVideoEnabled', def.kind === 'native')
    if (def.kind !== 'link') update('meetingLink', '')
    setShowValidation(false)
  }

  if (loading) {
    return (
      <Page className="max-w-3xl">
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </Page>
    )
  }

  const visibleError = showValidation ? stepError : null
  const hostLabel =
    form.staffIds.map((id) => staffNames.get(id)).filter(Boolean).join(', ') || 'Any available host'

  return (
    <Page className="max-w-4xl">
      <OpusSchedulingHero
        icon={Video}
        title="Create meeting"
        meta={<Pill tone="neutral" dot={false}>Step {step + 1} of {STEPS.length}</Pill>}
        description="Set up a bookable meeting for your public booking link."
        actions={
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href={routes.list}>
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
              Meetings
            </Link>
          </Button>
        }
      />

      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Progress">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const done = i < step
          const active = i === step
          return (
            <li key={s.label}>
              <span
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
                  active && 'border-primary bg-primary/10 text-primary',
                  done && !active && 'border-muted-foreground/30 text-muted-foreground',
                  !active && !done && 'border-border text-muted-foreground',
                )}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Icon className="h-3.5 w-3.5" aria-hidden />}
                {s.label}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Panel title={STEPS[step].label} className="ar-meeting-opus">
          {visibleError ? (
            <p className="mb-4 text-sm text-destructive" role="alert">{visibleError}</p>
          ) : null}
          {error ? <p className="mb-4 text-sm text-destructive" role="alert">{error}</p> : null}

          {step === 0 ? (
            <div className="space-y-4">
              <Field label="Meeting name" htmlFor="wiz-name">
                <TextInput
                  id="wiz-name"
                  value={form.name}
                  placeholder="Discovery call"
                  onChange={(e) => update('name', e.target.value)}
                />
              </Field>
              <Field label="Duration" htmlFor="wiz-duration">
                <NumberField
                  id="wiz-duration"
                  suffix="min"
                  min={5}
                  step={5}
                  value={form.durationMinutes}
                  onChange={(e) => update('durationMinutes', Number(e.target.value) || 30)}
                />
              </Field>
              <Field label="Description" htmlFor="wiz-desc" hint="Optional. Shown when customers book.">
                <TextArea
                  id="wiz-desc"
                  rows={3}
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold">Meeting method</p>
                <p className="text-sm text-muted-foreground">How you and the customer connect.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {MEETING_METHODS.map((def) => (
                    <ChoiceCard
                      key={def.value}
                      selected={form.location === def.value}
                      icon={METHOD_ICONS[def.value] || Video}
                      name={def.label}
                      helper={def.helper}
                      onSelect={() => selectMethod(def)}
                    />
                  ))}
                </div>
                {selectedMethod?.kind === 'link' ? (
                  <div className="mt-4 rounded-lg border bg-muted/30 p-4">
                    <Field label="Meeting URL" htmlFor="wiz-link">
                      <TextInput
                        id="wiz-link"
                        type="url"
                        placeholder="https://zoom.us/j/..."
                        value={form.meetingLink}
                        onChange={(e) => update('meetingLink', e.target.value)}
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
              <div className="border-t pt-5">
                <p className="text-sm font-semibold">Host</p>
                {staffOptions.length === 0 ? (
                  <div className="mt-3 space-y-3 rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Add your first bookable host.</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <TextInput
                        id="wiz-host-add"
                        aria-label="New host name"
                        placeholder="Host name"
                        value={newHost}
                        onChange={(e) => setNewHost(e.target.value)}
                      />
                      <Button
                        type="button"
                        disabled={!newHost.trim() || addingHost}
                        onClick={() => void addHost()}
                      >
                        <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                        {addingHost ? 'Adding…' : 'Add host'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                  <Field label="Assign to" htmlFor="wiz-host">
                    <SelectInput
                      id="wiz-host"
                      value={form.staffIds[0] || ''}
                      onChange={(e) => update('staffIds', e.target.value ? [e.target.value] : [])}
                    >
                      <option value="">Any available host</option>
                      {staffOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </SelectInput>
                  </Field>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <Field label="Availability schedule" htmlFor="wiz-schedule">
                <SelectInput
                  id="wiz-schedule"
                  value={form.namedScheduleId}
                  onChange={(e) => update('namedScheduleId', e.target.value)}
                >
                  <option value="">Workspace default hours</option>
                  {scheduleOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </SelectInput>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Minimum notice" htmlFor="wiz-notice">
                  <NumberField
                    id="wiz-notice"
                    suffix="min"
                    min={0}
                    step={15}
                    value={form.minimumBookingNoticeMinutes}
                    onChange={(e) => update('minimumBookingNoticeMinutes', Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Book up to" htmlFor="wiz-ahead">
                  <NumberField
                    id="wiz-ahead"
                    suffix="days"
                    min={1}
                    value={form.maximumBookingDaysAhead}
                    onChange={(e) => update('maximumBookingDaysAhead', Number(e.target.value) || 14)}
                  />
                </Field>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{form.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="font-medium">{formatDurationMinutes(form.durationMinutes)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Host</dt>
                <dd className="font-medium">{hostLabel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Method</dt>
                <dd className="font-medium">{meetingMethodLabel({ location: form.location })}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Availability</dt>
                <dd className="font-medium">
                  {availabilityScheduleLabel(form.namedScheduleId, scheduleOptions)}
                </dd>
              </div>
            </dl>
          ) : null}

          <div className="mt-8 flex flex-wrap justify-between gap-3 border-t pt-5">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0 || saving}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext}>
                Continue
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <Button type="button" disabled={saving} onClick={() => void createMeeting()}>
                {saving ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Create meeting
              </Button>
            )}
          </div>
        </Panel>

        <aside className="hidden lg:block">
          <Panel title="Meeting so far" bodyClassName="text-sm">
            <p className="font-semibold">{form.name.trim() || 'Untitled meeting'}</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>{formatDurationMinutes(form.durationMinutes)}</li>
              <li>{meetingMethodLabel({ location: form.location }) || 'Method not set'}</li>
              <li>{hostLabel}</li>
            </ul>
          </Panel>
        </aside>
      </div>
    </Page>
  )
}
