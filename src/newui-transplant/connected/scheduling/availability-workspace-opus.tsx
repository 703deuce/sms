'use client'

import { useCallback, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useAvailabilityWorkspace } from '@/features/appointments/kimi/availability/use-availability-workspace'
import {
  AVAILABILITY_SECTIONS,
  type AvailabilitySectionId,
} from '@/components/appointments/availability/availability-section-types'
import { AvailabilityOverviewSection } from '@/components/appointments/availability/availability-overview-section'
import { AvailabilityWeeklyHoursSection } from '@/components/appointments/availability/availability-weekly-hours-section'
import { AvailabilityStaffSection } from '@/components/appointments/availability/availability-staff-section'
import { AvailabilityServicesSection } from '@/components/appointments/availability/availability-services-section'
import { AvailabilityLocationsSection } from '@/components/appointments/availability/availability-locations-section'
import { AvailabilityOverridesSection } from '@/components/appointments/availability/availability-overrides-section'
import { AvailabilityBookingRulesSection } from '@/components/appointments/availability/availability-booking-rules-section'
import { AvailabilityCalendarsSection } from '@/components/appointments/availability/availability-calendars-section'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Button } from '@/newui-transplant/components/ui/button'
import { Callout, PageHeader, Pill } from '@/newui-transplant/components/app/kit'
import { Tabs, TabsList, TabsTrigger } from '@/newui-transplant/components/ui/tabs'
import '@/newui-transplant/connected/scheduling/availability-workspace-opus.css'

export function AvailabilityWorkspaceOpus() {
  const ws = useAvailabilityWorkspace()

  const serviceOptions = useMemo(
    () => ws.types.map((t) => ({ id: t.id, name: t.name })),
    [ws.types],
  )
  const staffOptions = useMemo(
    () => ws.staff.filter((s) => s.active !== false).map((s) => ({ id: s.id, name: s.name })),
    [ws.staff],
  )

  const staffCountByLocation = useMemo(() => {
    const map = new Map<string, number>()
    for (const location of ws.locations) {
      const count = ws.staff.filter((s) => (s.locationIds || []).includes(location.id)).length
      map.set(location.id, count)
    }
    return map
  }, [ws.locations, ws.staff])

  const serviceCountByLocation = useMemo(() => {
    const map = new Map<string, number>()
    for (const location of ws.locations) {
      const count = ws.types.filter((t) => (t.config?.locationIds || []).includes(location.id)).length
      map.set(location.id, count)
    }
    return map
  }, [ws.locations, ws.types])

  const calendarStaffRows = useMemo(
    () =>
      ws.staffRows
        .filter((r) => r.member.calendarConnectionId)
        .map((r) => ({
          staffId: r.id,
          staffName: r.name,
          connectionLabel: r.calendarLabel,
          connected: r.calendarConnected,
        })),
    [ws.staffRows],
  )

  const handleStaffUseBusinessHours = useCallback(
    (staffId: string) => {
      void ws.updateStaffMember(staffId, { weeklyHours: {} })
    },
    [ws],
  )

  const handleStaffToggleDay = useCallback(
    (staffId: string, day: string, open: boolean) => {
      const member = ws.staff.find((s) => s.id === staffId)
      if (!member) return
      const hours = { ...(member.weeklyHours || {}) }
      hours[day] = open ? [{ open: '09:00', close: '17:00' }] : []
      void ws.updateStaffMember(staffId, { weeklyHours: hours })
    },
    [ws],
  )

  const handleStaffUpdateWindow = useCallback(
    (staffId: string, day: string, index: number, field: 'open' | 'close', value: string) => {
      const member = ws.staff.find((s) => s.id === staffId)
      if (!member) return
      const hours = { ...(member.weeklyHours || {}) }
      const next = [...(hours[day] || [])]
      next[index] = { ...next[index], [field]: value }
      hours[day] = next
      void ws.updateStaffMember(staffId, { weeklyHours: hours })
    },
    [ws],
  )

  const handleStaffAddWindow = useCallback(
    (staffId: string, day: string) => {
      const member = ws.staff.find((s) => s.id === staffId)
      if (!member) return
      const hours = { ...(member.weeklyHours || {}) }
      hours[day] = [...(hours[day] || []), { open: '09:00', close: '12:00' }]
      void ws.updateStaffMember(staffId, { weeklyHours: hours })
    },
    [ws],
  )

  const handleStaffRemoveWindow = useCallback(
    (staffId: string, day: string, index: number) => {
      const member = ws.staff.find((s) => s.id === staffId)
      if (!member) return
      const hours = { ...(member.weeklyHours || {}) }
      hours[day] = (hours[day] || []).filter((_, i) => i !== index)
      void ws.updateStaffMember(staffId, { weeklyHours: hours })
    },
    [ws],
  )

  if (ws.loading) {
    return (
      <ArOpusPage>
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" aria-busy="true" />
      </ArOpusPage>
    )
  }

  if (ws.failed) {
    return (
      <ArOpusPage>
        <Callout tone="error" title="We couldn't load availability">
          <Button type="button" variant="outline" size="sm" onClick={() => void ws.load()}>
            Try again
          </Button>
        </Callout>
      </ArOpusPage>
    )
  }

  const saveLabel = ws.saving ? 'Saving…' : ws.saved ? 'Saved' : 'Save changes'

  return (
    <ArOpusPage className="availability-opus-root">
      <PageHeader
        title="Availability"
        description="Business hours, staff schedules, locations, and booking rules."
        actions={
          <Button type="button" disabled={ws.saving} onClick={() => void ws.saveSettings()}>
            {saveLabel}
          </Button>
        }
        meta={
          ws.stats ? (
            <div className="flex flex-wrap gap-2">
              <Pill tone="neutral" dot={false}>{ws.stats.servicesWithStaff} services staffed</Pill>
              <Pill tone="neutral" dot={false}>{ws.stats.staffScheduled} staff scheduled</Pill>
            </div>
          ) : null
        }
      />

      {ws.error ? (
        <Callout tone="error" title="Save failed" className="mb-4">{ws.error}</Callout>
      ) : null}

      <Tabs
        value={ws.section}
        onValueChange={(v) => ws.setSection(v as AvailabilitySectionId)}
        className="mb-4"
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {AVAILABILITY_SECTIONS.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="text-xs sm:text-sm">
              {s.label}
              {ws.attention?.has(s.id) ? ' •' : ''}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="availability-opus-sections">
        {ws.section === 'overview' ? (
          <AvailabilityOverviewSection
            form={ws.form}
            stats={ws.stats}
            overviewOverrides={ws.overviewOverrides}
            services={serviceOptions}
            staff={staffOptions}
            locations={ws.locations}
            onNavigate={ws.setSection}
          />
        ) : null}
        {ws.section === 'weekly-hours' ? (
          <AvailabilityWeeklyHoursSection
            form={ws.form}
            onToggleDay={ws.toggleDayOpen}
            onUpdateWindow={ws.updateWindow}
            onAddWindow={ws.addWindow}
            onRemoveWindow={ws.removeWindow}
            onCopyMondayToWeekdays={ws.copyMondayToWeekdays}
            onTimezoneChange={(value) => ws.patchForm({ timezone: value })}
          />
        ) : null}
        {ws.section === 'staff' ? (
          <AvailabilityStaffSection
            rows={ws.staffRows}
            form={ws.form}
            services={serviceOptions}
            locations={ws.locations}
            onUseBusinessHours={handleStaffUseBusinessHours}
            onToggleService={ws.toggleStaffService}
            onToggleLocation={ws.toggleStaffLocation}
            onToggleDay={handleStaffToggleDay}
            onUpdateWindow={handleStaffUpdateWindow}
            onAddWindow={handleStaffAddWindow}
            onRemoveWindow={handleStaffRemoveWindow}
          />
        ) : null}
        {ws.section === 'services' ? <AvailabilityServicesSection rows={ws.serviceRows} /> : null}
        {ws.section === 'locations' ? (
          <AvailabilityLocationsSection
            form={ws.form}
            locations={ws.locations}
            resources={ws.resources}
            staffCountByLocation={staffCountByLocation}
            serviceCountByLocation={serviceCountByLocation}
          />
        ) : null}
        {ws.section === 'overrides' ? (
          <AvailabilityOverridesSection
            form={ws.form}
            onPatch={ws.patchForm}
            onAddOverride={ws.addOverride}
            onRemoveOverride={ws.removeOverride}
          />
        ) : null}
        {ws.section === 'booking-rules' ? (
          <AvailabilityBookingRulesSection
            form={ws.form}
            onPatch={ws.patchForm}
            onSave={() => void ws.saveSettings()}
            saving={ws.saving}
            saved={ws.saved}
          />
        ) : null}
        {ws.section === 'calendars' ? (
          <AvailabilityCalendarsSection staffRows={calendarStaffRows} connections={ws.connections} />
        ) : null}
      </div>
    </ArOpusPage>
  )
}
