'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users } from 'lucide-react'
import { useTeamBookingWorkspace } from '@/features/appointments/kimi/team-booking/use-team-booking-workspace'
import type { TeamBookingWorkspaceData } from '@/lib/appointments/team-booking/team-booking-workspace-types'
import {
  ArOpusPage,
  ArStatGrid,
  OpusDataSurface,
} from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { OpusMetricBand, OpusSchedulingHero } from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { Panel, Pill, Stat } from '@/newui-transplant/components/app/kit'
import { Button, buttonVariants } from '@/newui-transplant/components/ui/button'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger } from '@/newui-transplant/components/ui/tabs'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'rules', label: 'Team rules' },
  { id: 'services', label: 'Service assignments' },
  { id: 'templates', label: 'Team templates' },
  { id: 'test', label: 'Availability test' },
  { id: 'activity', label: 'Activity' },
  { id: 'settings', label: 'Settings' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export function TeamBookingOpus() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const section = (searchParams.get('section') as SectionId) || 'overview'
  const ws = useTeamBookingWorkspace()

  const setSection = useCallback(
    (id: SectionId) => {
      const q = new URLSearchParams(searchParams.toString())
      q.set('section', id)
      router.replace(`/appointments/team-booking?${q.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  if (ws.loading) {
    return (
      <ArOpusPage>
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" aria-busy="true" />
      </ArOpusPage>
    )
  }

  if (!ws.data) {
    return (
      <ArOpusPage>
        <OpusSchedulingHero icon={Users} title="Team booking" description="Multi-staff appointment scheduling." />
        <p className="text-sm text-muted-foreground">{ws.error || 'Could not load team booking.'}</p>
      </ArOpusPage>
    )
  }

  const d = ws.data
  const teamServices = d.services.filter((s) => s.teamMode === 'team_required')

  return (
    <ArOpusPage>
      <OpusSchedulingHero
        icon={Users}
        title="Team booking"
        description="Schedule appointments that require multiple staff members at the same time."
        actions={
          <Button type="button" size="sm" variant="secondary" onClick={() => setSection('test')}>
            Test availability
          </Button>
        }
      />

      <OpusMetricBand>
        <ArStatGrid>
          <Stat label="Team services" value={String(d.overview.teamServices)} icon={Users} />
          <Stat label="Active rules" value={String(d.overview.activeRules)} icon={Users} />
          <Stat label="Staff participating" value={String(d.overview.staffParticipating)} icon={Users} />
          <Stat label="Ready" value={String(d.overview.ready)} icon={Users} />
        </ArStatGrid>
      </OpusMetricBand>

      <Tabs value={section} onValueChange={(v) => setSection(v as SectionId)} className="mb-4">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {SECTIONS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="data-[state=active]:bg-muted">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <OpusDataSurface>
        {section === 'overview' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <Panel className="md:col-span-4" title="Team-booking coverage">
              <p className="text-2xl font-semibold tabular-nums">{d.overview.teamServices}</p>
              <p className="mt-1 text-sm text-muted-foreground">Services requiring multiple staff</p>
              <Button type="button" variant="link" className="mt-2 h-auto p-0" onClick={() => setSection('services')}>
                Manage
              </Button>
            </Panel>
            <Panel className="md:col-span-4" title="Availability health">
              <ul className="mt-2 space-y-1 text-sm">
                {['Staff schedules', 'External calendars', 'Locations', 'Resources', 'Team slot engine'].map(
                  (l) => (
                    <li key={l} className="flex justify-between gap-2">
                      <span>{l}</span>
                      <span className="text-primary font-medium">Ready</span>
                    </li>
                  ),
                )}
              </ul>
            </Panel>
            <Panel className="md:col-span-4" title="Setup issues">
              {d.overview.issues.length === 0 ? (
                <p className="text-sm text-muted-foreground">No issues detected.</p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                  {d.overview.issues.map((i) => (
                    <li key={i.id}>{i.message}</li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel className="md:col-span-7" title="Upcoming team bookings">
              {d.upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming team bookings.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {d.upcoming.slice(0, 8).map((row) => (
                    <li key={row.id} className="flex justify-between gap-2 py-2">
                      <span>
                        {new Date(row.at).toLocaleString()} · {row.serviceName} · {row.customer}
                      </span>
                      <span className="font-medium">{row.teamLabel}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel className="md:col-span-5" title="How assignment works">
              <p className="text-sm text-muted-foreground">
                Required roles must all be available at the same time. The engine searches valid distinct-staff
                combinations (not greedy per-role assignment), then applies routing load scoring among valid teams.
              </p>
              <Button type="button" variant="link" className="mt-2 h-auto p-0" onClick={() => setSection('rules')}>
                Edit default
              </Button>
            </Panel>
          </div>
        )}

        {section === 'rules' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure team requirements per Service (People &amp; place → Collective / Team) or enable structured
              requirements via Service editor. Reuse Staff Pools from{' '}
              <Link href="/appointments/routing?section=pools" className="font-medium text-primary underline-offset-2 hover:underline">
                Routing
              </Link>
              .
            </p>
            {teamServices.length === 0 ? (
              <Panel>
                <div className="flex flex-col items-center py-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground opacity-60" aria-hidden />
                  <p className="mt-2 font-medium">No team bookings configured</p>
                  <Link
                    href="/appointments/services"
                    className={cn(buttonVariants(), 'mt-4 inline-flex')}
                  >
                    Configure a service
                  </Link>
                </div>
              </Panel>
            ) : (
              teamServices.map((svc) => (
                <Panel key={svc.id} title={svc.name}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="text-sm text-muted-foreground">
                      <p>{svc.teamRuleLabel}</p>
                      <p className="mt-1">{svc.requiredStaff} required participants</p>
                    </div>
                    <Link
                      href={`/appointments/services/${svc.id}`}
                      className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
                    >
                      Edit team
                    </Link>
                  </div>
                </Panel>
              ))
            )}
          </div>
        )}

        {section === 'services' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">Service</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Team mode</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Required staff</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Team rule</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Locations</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.services.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="py-2 pr-3 font-medium">
                      <Link
                        href={`/appointments/services/${row.id}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{row.teamMode === 'team_required' ? 'Team required' : 'Single staff'}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.requiredStaff}</td>
                    <td className="py-2 pr-3">{row.teamRuleLabel}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.locationCount}</td>
                    <td className="py-2 pr-3">
                      <Pill tone={row.status === 'ready' ? 'success' : 'warning'} dot={false}>
                        {row.status === 'ready' ? 'Ready' : row.status === 'needs_setup' ? 'Needs setup' : 'Not team-enabled'}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {section === 'templates' && (
          <Panel title="Team templates">
            {d.templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No reusable team templates yet. Define requirements on services or add templates to platform config.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th scope="col" className="py-2 text-left font-medium">Template</th>
                    <th scope="col" className="py-2 font-medium">Requirements</th>
                    <th scope="col" className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.templates.map((t) => (
                    <tr key={t.id} className="border-b">
                      <td className="py-2">{t.name}</td>
                      <td className="py-2 tabular-nums">{t.requirements.length}</td>
                      <td className="py-2">{t.active !== false ? 'Active' : 'Inactive'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        )}

        {section === 'test' && (
          <TeamAvailabilityTest
            data={d}
            simulating={ws.simulating}
            result={ws.simResult}
            onRun={ws.runSimulate}
          />
        )}

        {section === 'activity' && (
          <Panel title="Team assignment activity">
            {!d.activity.length ? (
              <p className="text-sm text-muted-foreground">
                Team-assignment activity will appear after team bookings are created.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm">
                  <thead className="border-b text-muted-foreground">
                    <tr>
                      <th scope="col" className="py-2 pr-3 text-left font-medium">Time</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Booking</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Service</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Team</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Source</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.activity.map((row) =>
                      row ? (
                        <tr key={row.id} className="border-b">
                          <td className="py-2 pr-3">{new Date(row.at).toLocaleString()}</td>
                          <td className="py-2 pr-3">{row.bookingLabel}</td>
                          <td className="py-2 pr-3">{row.serviceName}</td>
                          <td className="py-2 pr-3 font-medium">{row.teamLabel}</td>
                          <td className="py-2 pr-3">{row.source}</td>
                          <td className="py-2 pr-3">{row.status}</td>
                        </tr>
                      ) : null,
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {section === 'settings' && (
          <Panel title="Settings">
            <p className="text-sm text-muted-foreground">
              Team landing pages for multi-type booking remain at{' '}
              <Link href="/appointments/team-pages" className="font-medium text-primary underline-offset-2 hover:underline">
                Team pages
              </Link>{' '}
              (separate from multi-staff service team booking).
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Reschedule: preserve team when possible; replace individual roles when configured (runtime partial).
            </p>
          </Panel>
        )}
      </OpusDataSurface>
    </ArOpusPage>
  )
}

function TeamAvailabilityTest({
  data,
  simulating,
  result,
  onRun,
}: {
  data: TeamBookingWorkspaceData
  simulating: boolean
  result: unknown
  onRun: (b: Record<string, unknown>) => void
}) {
  const teamServices = data.services.filter((s) => s.teamMode === 'team_required')
  const [serviceName, setServiceName] = useState(teamServices[0]?.name || '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [locationId, setLocationId] = useState('')

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Panel className="lg:col-span-4" title="Test inputs">
        <label className="block text-sm font-medium">
          Service
          <select
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
          >
            {teamServices.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-medium">
          Date
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Location
          <select
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option value="">Any</option>
            {data.locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          className="mt-4"
          disabled={simulating || !serviceName}
          onClick={() => onRun({ serviceName, date, locationId: locationId || undefined })}
        >
          {simulating ? 'Running…' : 'Run test'}
        </Button>
      </Panel>
      <Panel className="lg:col-span-8" title="Results">
        {!result ? (
          <p className="text-sm text-muted-foreground">Uses the same team combination engine as slot generation.</p>
        ) : (
          <SimResultView
            result={
              result as {
                slots: Array<{ startsAt: string; available: boolean; selectedTeam?: string; reason?: string }>
              }
            }
          />
        )}
      </Panel>
    </div>
  )
}

function SimResultView({
  result,
}: {
  result: { slots: Array<{ startsAt: string; available: boolean; selectedTeam?: string; reason?: string }> }
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-muted-foreground">
          <th scope="col" className="py-1 text-left font-medium">Time</th>
          <th scope="col" className="py-1 font-medium">Status</th>
          <th scope="col" className="py-1 font-medium">Team</th>
        </tr>
      </thead>
      <tbody>
        {result.slots.map((s) => (
          <tr key={s.startsAt} className="border-t">
            <td className="py-1.5">{new Date(s.startsAt).toLocaleTimeString()}</td>
            <td>{s.available ? <span className="text-primary font-medium">Available</span> : 'No valid team'}</td>
            <td>{s.selectedTeam || s.reason || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
