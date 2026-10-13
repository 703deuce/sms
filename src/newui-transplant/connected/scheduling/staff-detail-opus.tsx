'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ExternalLink, Users } from 'lucide-react'
import { useStaffDetail } from '@/features/appointments/kimi/staff/use-staff-workspace'
import { ContextBackLink } from '@/components/navigation/context-back-link'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Callout, PageHeader, Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { Label } from '@/newui-transplant/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/newui-transplant/components/ui/tabs'
import { Textarea } from '@/newui-transplant/components/ui/textarea'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'services', label: 'Services' },
  { id: 'locations', label: 'Locations' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'public', label: 'Public profile' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'account', label: 'Account & access' },
  { id: 'advanced', label: 'Advanced' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export function StaffDetailOpus({ staffId }: { staffId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const section = (searchParams.get('section') as SectionId) || 'overview'
  const detail = useStaffDetail(staffId)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deactivateWarn, setDeactivateWarn] = useState<number | null>(null)

  const setSection = useCallback(
    (id: SectionId) => {
      const q = new URLSearchParams(searchParams.toString())
      q.set('section', id)
      router.replace(`/appointments/staff/${staffId}?${q.toString()}`, { scroll: false })
    },
    [router, searchParams, staffId],
  )

  const m = detail.data?.member
  const displayName = m?.publicDisplayName || m?.name || 'Staff'

  async function saveProfile() {
    if (!m) return
    setSaving(true)
    setError('')
    try {
      await detail.patch({
        member: {
          name: draft.name ?? m.name,
          publicDisplayName: draft.publicDisplayName ?? m.publicDisplayName,
          title: draft.title ?? m.title,
          email: draft.email ?? m.email,
          phone: draft.phone ?? m.phone,
          bio: draft.bio ?? m.bio,
          avatarUrl: draft.avatarUrl ?? m.avatarUrl,
          customerSelectable:
            draft.customerSelectable !== undefined
              ? draft.customerSelectable === 'true'
              : m.customerSelectable !== false,
        },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleService(typeId: string, assigned: boolean) {
    if (!detail.data) return
    const ids = detail.data.services.filter((s) => s.assigned).map((s) => s.id)
    const next = assigned ? ids.filter((id) => id !== typeId) : [...ids, typeId]
    await detail.patch({ appointmentTypeIds: next })
  }

  async function toggleLocation(locId: string, assigned: boolean) {
    if (!detail.data) return
    const ids = detail.data.locations.filter((l) => l.assigned).map((l) => l.id)
    const next = assigned ? ids.filter((id) => id !== locId) : [...ids, locId]
    await detail.patch({ locationIds: next })
  }

  async function deactivate(force = false) {
    try {
      await detail.patch({ deactivate: true, forceDeactivate: force })
      setDeactivateWarn(null)
    } catch (e) {
      const err = e as Error & { code?: string; futureAppointmentCount?: number }
      if (err.code === 'future_appointments') {
        setDeactivateWarn(err.futureAppointmentCount || 0)
      } else {
        setError(err.message)
      }
    }
  }

  if (detail.loading) {
    return (
      <ArOpusPage>
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
      </ArOpusPage>
    )
  }

  if (!detail.data || !m) {
    return (
      <ArOpusPage>
        <Callout tone="warning" title="Staff not found">
          <p className="text-sm text-muted-foreground">{detail.error || 'This staff member could not be loaded.'}</p>
          <Button type="button" size="sm" className="mt-3" asChild>
            <Link href="/appointments/staff">Back to staff</Link>
          </Button>
        </Callout>
      </ArOpusPage>
    )
  }

  const d = detail.data
  const initials = d.availability.initials

  return (
    <ArOpusPage className="max-w-[1560px]">
      <ContextBackLink href="/appointments/staff" label="Staff" />

      <PageHeader
        title={displayName}
        description={m.title || m.role || 'Provider'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={d.scheduling.availabilityHref}>View schedule</Link>
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => void saveProfile()}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                aria-hidden
              >
                {initials}
              </span>
            )}
            <Pill tone={m.active === false ? 'neutral' : 'success'} dot>
              {m.active === false ? 'Inactive' : 'Active'}
            </Pill>
            {m.customerSelectable !== false ? <Pill tone="neutral" dot={false}>Public</Pill> : null}
            {d.scheduling.calendarConnected ? (
              <Pill tone="neutral" dot={false}>Calendar connected</Pill>
            ) : null}
          </div>
        }
      />

      <Tabs value={section} onValueChange={(v) => setSection(v as SectionId)} className="mt-4">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {SECTIONS.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="data-[state=active]:bg-muted">
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>
      ) : null}

      <div className="mt-6 space-y-4 text-sm">
        {section === 'overview' && (
          <div className="grid gap-4 lg:grid-cols-12">
            <Panel className="lg:col-span-7" title="Profile">
              <p className="font-medium">{m.name}</p>
              <p className="text-muted-foreground">{m.email}</p>
              <p className="mt-2 line-clamp-3">{m.bio || 'No bio yet.'}</p>
              <Button type="button" variant="link" className="mt-2 h-auto p-0" onClick={() => setSection('public')}>
                Edit profile
              </Button>
            </Panel>
            <Panel className="lg:col-span-5" title="Setup health">
              <ul className="mt-2 space-y-1">
                {d.setupIssues.length === 0 ? (
                  <li className="text-primary">Ready</li>
                ) : (
                  d.setupIssues.map((i) => (
                    <li key={i.id}>
                      <Link href={i.href} className="text-primary hover:underline">{i.message}</Link>
                    </li>
                  ))
                )}
              </ul>
            </Panel>
            <Panel className="lg:col-span-4" title="Booking summary">
              <p>Upcoming: {d.bookingStats.upcoming}</p>
              <p>Today: {d.bookingStats.today}</p>
              <p>Last 30 days: {d.bookingStats.last30Days}</p>
            </Panel>
            <Panel className="lg:col-span-4" title="Services">
              <p>{d.services.filter((s) => s.assigned).length} assigned</p>
              <Button type="button" variant="link" className="h-auto p-0" onClick={() => setSection('services')}>
                Manage
              </Button>
            </Panel>
            <Panel className="lg:col-span-4" title="Locations">
              <p>{d.locations.filter((l) => l.assigned).length} assigned</p>
              <Button type="button" variant="link" className="h-auto p-0" onClick={() => setSection('locations')}>
                Manage
              </Button>
            </Panel>
          </div>
        )}

        {section === 'services' && (
          <Panel title="Service assignments" bodyClassName="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Service</th>
                  <th scope="col" className="px-3 py-2 text-center font-medium">Assigned</th>
                  <th scope="col" className="px-3 py-2 text-center font-medium">Routing</th>
                  <th scope="col" className="px-3 py-2 text-center font-medium">Team booking</th>
                </tr>
              </thead>
              <tbody>
                {d.services.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="px-3 py-2">{s.name}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={s.assigned}
                        onChange={() => void toggleService(s.id, s.assigned)}
                        aria-label={`Assign ${s.name}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">{s.routingLabel}</td>
                    <td className="px-3 py-2 text-center">{s.teamBooking ? 'Yes' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {section === 'locations' && (
          <Panel title="Location assignments" bodyClassName="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Location</th>
                  <th scope="col" className="px-3 py-2 text-center font-medium">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {d.locations.map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="px-3 py-2">{l.name}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={l.assigned}
                        onChange={() => void toggleLocation(l.id, l.assigned)}
                        aria-label={`Assign ${l.name}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {section === 'scheduling' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Availability source">
              <p>{d.scheduling.sourceLabel}</p>
              <Button type="button" variant="link" className="mt-2 h-auto gap-1 p-0" asChild>
                <Link href={d.scheduling.availabilityHref}>
                  Open full Availability <ExternalLink className="h-3 w-3" aria-hidden />
                </Link>
              </Button>
            </Panel>
            <Panel title="Calendar">
              <p>
                {d.scheduling.calendarLabel}{' '}
                {d.scheduling.calendarConnected ? '✓' : ''}
              </p>
              <Button type="button" variant="link" className="mt-2 h-auto p-0" asChild>
                <Link href={d.scheduling.calendarManageHref}>Manage calendar</Link>
              </Button>
            </Panel>
            <Panel className="lg:col-span-2" title="Weekly summary">
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {d.scheduling.weeklySummary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Panel>
          </div>
        )}

        {section === 'public' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Public profile fields">
              <div className="space-y-3">
                {(['name', 'publicDisplayName', 'title', 'avatarUrl', 'email'] as const).map((field) => (
                  <div key={field}>
                    <Label htmlFor={`staff-${field}`}>{field}</Label>
                    <Input
                      id={`staff-${field}`}
                      className="mt-1"
                      value={draft[field] ?? String(m[field] || '')}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [field]: e.target.value }))}
                    />
                  </div>
                ))}
                <div>
                  <Label htmlFor="staff-bio">bio</Label>
                  <Textarea
                    id="staff-bio"
                    className="mt-1"
                    value={draft.bio ?? String(m.bio || '')}
                    onChange={(e) => setDraft((prev) => ({ ...prev, bio: e.target.value }))}
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.customerSelectable !== 'false' && m.customerSelectable !== false}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        customerSelectable: e.target.checked ? 'true' : 'false',
                      }))
                    }
                  />
                  Allow customer provider selection (when Service permits)
                </label>
              </div>
            </Panel>
            <Panel title="Public preview">
              <div className="flex items-start gap-3">
                <Users className="h-8 w-8 text-primary" aria-hidden />
                <div>
                  <div className="font-semibold">{draft.publicDisplayName || m.publicDisplayName || m.name}</div>
                  <div className="text-muted-foreground">{draft.title || m.title}</div>
                  <p className="mt-2">{draft.bio || m.bio}</p>
                </div>
              </div>
            </Panel>
          </div>
        )}

        {section === 'appointments' && (
          <Panel title="Appointments" bodyClassName="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Date/time</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Customer</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Offering</th>
                  <th scope="col" className="px-3 py-2 text-center font-medium">Role</th>
                  <th scope="col" className="px-3 py-2 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.appointments.map((a) => (
                  <tr key={a.id} className="border-b">
                    <td className="px-3 py-2">{new Date(a.startsAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{a.customerName}</td>
                    <td className="px-3 py-2">{a.serviceName}</td>
                    <td className="px-3 py-2 text-center">{a.role}</td>
                    <td className="px-3 py-2 text-center">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {section === 'account' && (
          <Panel title="Transovo access" className="max-w-md">
            <p className="text-muted-foreground">
              Staff records can exist without a login. User invites and permissions are managed in Team
              settings.
            </p>
            <Button type="button" variant="link" className="mt-3 h-auto p-0" asChild>
              <Link href="/settings/team">Manage team access</Link>
            </Button>
          </Panel>
        )}

        {section === 'advanced' && (
          <Panel title="Advanced" className="max-w-md space-y-3">
            <p>Staff ID: <code className="text-xs">{m.id}</code></p>
            <p>
              Routing: eligible on {d.routingSummary.eligibleServices} services —{' '}
              <Link href={d.routingSummary.href} className="text-primary hover:underline">Open Routing</Link>
            </p>
            <p>
              Team booking: {d.teamBookingSummary.serviceCount} services —{' '}
              <Link href={d.teamBookingSummary.href} className="text-primary hover:underline">
                Open Team Booking
              </Link>
            </p>
            {deactivateWarn !== null ? (
              <Callout tone="warning" title="Future appointments">
                <p className="text-sm">
                  {deactivateWarn} future appointments.{' '}
                  <button
                    type="button"
                    className="font-medium underline"
                    onClick={() => void deactivate(true)}
                  >
                    Deactivate anyway
                  </button>
                </p>
              </Callout>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => void deactivate(false)}
            >
              Deactivate staff
            </Button>
          </Panel>
        )}
      </div>
    </ArOpusPage>
  )
}
