'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { isCalendarConnectionUsable } from '@/lib/appointment-reminders/calendar-connection'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, Bell, Calendar, ExternalLink, RefreshCw } from 'lucide-react'
import type { CalendarApiAppointment } from '@/features/appointments/kimi/calendar/map-calendar'
import type { CalendarViewMode } from '@/features/appointments/kimi/calendar/types'
import {
  buildCalendarSearchParams,
  calendarUrlEquals,
  parseCalendarCursorFromSearch,
} from '@/features/appointments/kimi/calendar/calendar-url-state'
import { parseArCalendarView } from '@/lib/appointment-reminders/calendar/ar-calendar-url-state'
import {
  dateKey,
  dayKeyInTimeZone,
  getArCalendarRange,
  startOfWeek,
  weekDayHeaders,
} from '@/lib/appointment-reminders/calendar/ar-calendar-layout'
import { calendarEventToAppointmentRow } from '@/lib/appointment-reminders/calendar/calendar-event-to-row'
import {
  appointmentRowFromOverviewFeed,
  type ArOverviewFeedShape,
} from '@/lib/appointment-reminders/calendar/overview-feed-appointment-row'
import {
  isArCalendarViewerReadyFromIntegrationRows,
  isArCalendarViewerReadyFromOverview,
} from '@/lib/appointment-reminders/calendar/ar-calendar-viewer-ready'
import { ArCalendarActivityPanel } from '@/newui-transplant/components/appointment-reminders/ar-calendar-activity-panel'
import {
  ArCalendarOperationsStrip,
  type OperationsStripSelect,
} from '@/newui-transplant/components/appointment-reminders/ar-calendar-operations-strip'
import { buildAgendaEnrichmentMap } from '@/lib/appointment-reminders/calendar/build-agenda-enrichment'
import { ArCalendarRightContextPanel } from '@/newui-transplant/components/appointment-reminders/ar-calendar-right-context-panel'
import {
  ArCalendarOpusView,
  type ArCalendarFilterOption,
} from '@/newui-transplant/components/appointment-reminders/ar-calendar-opus-view'
import { AppointmentDetailDrawer } from '@/newui-transplant/components/appointment-reminders/appointment-detail-drawer'
import { ArOpusPage, OpusSearchField } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Callout, EmptyState, Pill, TextLink } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/newui-transplant/components/ui/sheet'
import { AR_ROUTES, AR_SETTINGS_INTEGRATIONS } from '@/lib/appointment-reminders/routes'
import { cn } from '@/lib/utils'

const CALENDAR_AUTO_REFRESH_MS = 20_000

export function AppointmentRemindersCalendarWorkspacePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialView = parseArCalendarView(searchParams.get('view'))
  const [cursor, setCursor] = useState(() =>
    parseCalendarCursorFromSearch(new URLSearchParams(searchParams.toString()), initialView),
  )
  const [view, setView] = useState<CalendarViewMode>(initialView)
  const [selectedDayKey, setSelectedDayKey] = useState(() => {
    const d = parseCalendarCursorFromSearch(new URLSearchParams(searchParams.toString()), initialView)
    return dateKey(d)
  })
  const [searchQ, setSearchQ] = useState(() => searchParams.get('q') || '')
  const [events, setEvents] = useState<CalendarApiAppointment[]>([])
  const [timezone, setTimezone] = useState('America/New_York')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overviewReady, setOverviewReady] = useState(false)
  const [connected, setConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncLabel, setSyncLabel] = useState<string | null>(null)
  const [overviewFeed, setOverviewFeed] = useState<ArOverviewFeedShape | null>(null)
  const [overviewMeta, setOverviewMeta] = useState<{
    readiness?: {
      remindersPaused?: boolean
      remindersActivated?: boolean
      syncHealthy?: boolean
      hasImportCalendars?: boolean
    }
    stats?: { failed7d?: number }
    sync?: { syncError?: string | null }
    calendarHealthy?: boolean
    calendars?: Array<{
      status: string
      importCalendarCount?: number | null
      label?: string
    }>
  } | null>(null)
  const [feedLoading, setFeedLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<'details' | 'reminders' | 'activity' | 'preferences'>('details')
  const [openConversationOnLoad, setOpenConversationOnLoad] = useState(false)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [mobileActivityOpen, setMobileActivityOpen] = useState(false)
  const [stripCollapsed, setStripCollapsed] = useState(false)
  const [pauseBusy, setPauseBusy] = useState(false)
  const [composeUrl, setComposeUrl] = useState<string | null>(null)
  const [calendarConnections, setCalendarConnections] = useState<ArCalendarFilterOption[]>([])
  const [calendarFilter, setCalendarFilter] = useState(() => searchParams.get('calendar') || 'all')

  const range = useMemo(() => getArCalendarRange(cursor, view), [view, cursor])

  const calendarFilterOptions = useMemo((): ArCalendarFilterOption[] => {
    if (calendarConnections.length === 0) return [{ value: 'all', label: 'All calendars' }]
    return [{ value: 'all', label: 'All calendars' }, ...calendarConnections]
  }, [calendarConnections])

  const filteredEvents = useMemo(() => {
    let list = events
    if (calendarFilter && calendarFilter !== 'all') {
      list = list.filter((ev) => (ev.metadata?.connectionId as string) === calendarFilter)
    }
    const q = searchQ.trim().toLowerCase()
    if (!q) return list
    return list.filter((ev) => {
      const hay = [
        ev.inviteeName,
        ev.serviceName,
        ev.inviteePhone,
        (ev.metadata?.inviteeEmail as string) || '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [events, searchQ, calendarFilter])

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId],
  )

  const selectedRow = useMemo(() => {
    if (!selectedId) return null
    if (selectedEvent) return calendarEventToAppointmentRow(selectedEvent, timezone)
    return appointmentRowFromOverviewFeed(selectedId, overviewFeed, timezone)
  }, [selectedId, selectedEvent, timezone, overviewFeed])

  const agendaEnrichment = useMemo(
    () => buildAgendaEnrichmentMap(overviewFeed),
    [overviewFeed],
  )

  const calendarConnectionCallout = useMemo(() => {
    if (!overviewReady || !connected) return null
    const cals = overviewMeta?.calendars ?? []
    const importing = cals.filter((c) => (c.importCalendarCount ?? 0) > 0)
    const syncErr = overviewMeta?.sync?.syncError
    if (syncErr) {
      return {
        title: 'Calendar sync error',
        body: String(syncErr),
      }
    }
    if (!overviewMeta?.readiness?.hasImportCalendars || importing.length === 0) {
      return {
        title: 'Select calendars to import',
        body: 'Connect Microsoft 365 or Google and choose which calendars Transovo should mirror.',
      }
    }
    const needsReauth = importing.some((c) => String(c.status).toLowerCase() === 'needs_reauth')
    if (needsReauth) {
      return {
        title: 'Calendar needs re-authentication',
        body: 'Your provider connection expired. Reconnect under Settings → Integrations to keep sync healthy.',
      }
    }
    const broken = importing.filter((c) => !isCalendarConnectionUsable(c.status))
    if (broken.length > 0) {
      return {
        title: 'Calendar connection needs attention',
        body: 'One or more import calendars are disconnected. Appointments may be stale until you reconnect.',
      }
    }
    if (overviewMeta?.readiness?.syncHealthy === false) {
      return {
        title: 'Calendar sync needs attention',
        body: 'Transovo has not received a successful sync recently. Try Sync now or check Integrations.',
      }
    }
    return null
  }, [overviewReady, connected, overviewMeta])

  const syncUrl = useCallback(
    (
      nextView: CalendarViewMode,
      nextCursor: Date,
      nextDayKey: string,
      q: string,
      calendar: string,
    ) => {
      const params = buildCalendarSearchParams({
        view: nextView,
        cursor: nextCursor,
        selectedDayKey: nextDayKey,
        filters: { q, staffIds: [], locationId: '', resourceId: '', status: 'all', domainType: 'all' },
      })
      const nextParams = new URLSearchParams(params.toString())
      if (calendar && calendar !== 'all') nextParams.set('calendar', calendar)
      const currentParams = new URLSearchParams(searchParams.toString())
      if (!calendarUrlEquals(currentParams, nextParams)) {
        router.replace(`${AR_ROUTES.home}?${nextParams.toString()}`, { scroll: false })
      }
    },
    [router, searchParams],
  )

  const loadOverview = useCallback(async () => {
    try {
      const [overviewRes, integrationsRes] = await Promise.all([
        fetch('/api/appointment-reminders/overview'),
        fetch('/api/integrations/calendars'),
      ])
      let linked = false
      if (integrationsRes.ok) {
        const calJson = await integrationsRes.json()
        const rows = (calJson.data || []) as Array<{
          id: string
          name?: string
          provider?: string
          status?: string
          config?: { importCalendarIds?: string[]; email?: string }
        }>
        linked = isArCalendarViewerReadyFromIntegrationRows(rows)
        const opts: ArCalendarFilterOption[] = rows
          .filter((r) => (r.config?.importCalendarIds?.length ?? 0) > 0 || r.status === 'connected')
          .map((r) => {
            const provider =
              r.provider === 'microsoft' ? 'Outlook' : r.provider === 'google' ? 'Google' : 'Calendar'
            const email = r.config?.email ? ` · ${r.config.email}` : ''
            return {
              value: r.id,
              label: `${r.name || provider}${email}`,
            }
          })
        setCalendarConnections(opts)
      }
      if (overviewRes.ok) {
        const json = await overviewRes.json()
        const data = json.data
        setOverviewFeed(data as ArOverviewFeedShape)
        setOverviewMeta({
          readiness: data?.readiness,
          stats: data?.stats,
          sync: data?.sync,
          calendarHealthy: data?.calendarHealthy,
          calendars: data?.calendars,
        })
        if (!linked) linked = isArCalendarViewerReadyFromOverview(data)
        if (data?.timezone) setTimezone(data.timezone)
        const last = data?.sync?.lastSyncAt
        setSyncLabel(last ? new Date(last).toLocaleString() : 'Not synced yet')
      }
      setConnected(linked)
    } finally {
      setOverviewReady(true)
      setFeedLoading(false)
    }
  }, [])

  const loadEvents = useCallback(
    async (opts?: { refresh?: boolean; silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true)
        setError(null)
      }
      try {
        const qs = new URLSearchParams({
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        })
        if (opts?.refresh) qs.set('refresh', '1')
        if (searchQ.trim()) qs.set('q', searchQ.trim())
        const res = await fetch(`/api/appointment-reminders/calendar/events?${qs}`)
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || 'Failed to load calendar')
        }
        const json = await res.json()
        setEvents(json.data || [])
      } catch (e) {
        if (!opts?.silent) {
          setError(e instanceof Error ? e.message : 'Failed to load calendar')
        }
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [range.from, range.to, searchQ],
  )

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    if (view !== 'week') return
    const todayKey = dayKeyInTimeZone(new Date(), timezone)
    const keys = weekDayHeaders(cursor, timezone).map((d) => d.key)
    if (keys.includes(todayKey)) {
      setSelectedDayKey(todayKey)
    } else if (!keys.includes(selectedDayKey)) {
      setSelectedDayKey(keys[0]!)
    }
  }, [view, cursor, timezone, selectedDayKey])

  useEffect(() => {
    void fetch('/api/appointment-reminders/calendar/native-actions')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const d = json?.data as {
          microsoft?: { composeUrl?: string } | null
          google?: { createEventUrl?: string } | null
        }
        const url = d?.microsoft?.composeUrl || d?.google?.createEventUrl
        if (url) setComposeUrl(url)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  useEffect(() => {
    if (!connected || !overviewReady) return
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      void loadEvents({ silent: true })
    }
    const intervalId = window.setInterval(tick, CALENDAR_AUTO_REFRESH_MS)
    return () => window.clearInterval(intervalId)
  }, [connected, overviewReady, loadEvents])

  useEffect(() => {
    syncUrl(view, cursor, selectedDayKey, searchQ, calendarFilter)
  }, [view, cursor, selectedDayKey, searchQ, calendarFilter, syncUrl])

  const focusAppointmentDate = useCallback(
    (startsAt: string) => {
      const d = new Date(startsAt)
      if (Number.isNaN(d.getTime())) return
      setSelectedDayKey(dayKeyInTimeZone(d, timezone))
      if (view === 'week') setCursor(startOfWeek(d))
      else if (view === 'month') setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
      else setCursor(d)
    },
    [view, timezone],
  )

  const selectAppointment = useCallback(
    (
      id: string,
      tab?: 'details' | 'reminders' | 'activity',
      opts?: { startsAt?: string; openConversation?: boolean },
    ) => {
      if (opts?.startsAt) focusAppointmentDate(opts.startsAt)
      setSelectedId(id)
      setPanelTab(tab || 'details')
      setOpenConversationOnLoad(Boolean(opts?.openConversation))
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setMobileSheetOpen(true)
      }
    },
    [focusAppointmentDate],
  )

  const handleStripSelect = useCallback(
    (payload: OperationsStripSelect) => {
      selectAppointment(payload.appointmentId, payload.tab, {
        startsAt: payload.startsAt,
        openConversation: payload.openConversation,
      })
    },
    [selectAppointment],
  )

  const clearSelection = useCallback(() => {
    setSelectedId(null)
    setOpenConversationOnLoad(false)
    setMobileSheetOpen(false)
  }, [])

  async function setWorkspacePause(paused: boolean) {
    setPauseBusy(true)
    try {
      const res = await fetch('/api/appointment-reminders/operational-pause', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paused ? { action: 'pause', indefinite: true } : { action: 'resume' }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error || 'Could not update pause state')
      }
      await loadOverview()
    } catch (err) {
      console.error('[ar-calendar] pause', err)
    } finally {
      setPauseBusy(false)
    }
  }

  const onToday = useCallback(() => {
    const t = new Date()
    setCursor(view === 'week' ? startOfWeek(t) : t)
    setSelectedDayKey(dateKey(t))
  }, [view])

  const onPrev = useCallback(() => {
    const d = new Date(cursor)
    if (view === 'month') d.setMonth(d.getMonth() - 1)
    else if (view === 'agenda') d.setDate(d.getDate() - 14)
    else d.setDate(d.getDate() - (view === 'week' ? 7 : 1))
    setCursor(view === 'week' ? startOfWeek(d) : d)
  }, [cursor, view])

  const onNext = useCallback(() => {
    const d = new Date(cursor)
    if (view === 'month') d.setMonth(d.getMonth() + 1)
    else if (view === 'agenda') d.setDate(d.getDate() + 14)
    else d.setDate(d.getDate() + (view === 'week' ? 7 : 1))
    setCursor(view === 'week' ? startOfWeek(d) : d)
  }, [cursor, view])

  const onViewChange = useCallback(
    (v: CalendarViewMode) => {
      setView(v)
      if (v === 'week') setCursor(startOfWeek(cursor))
      else if (v === 'agenda') setCursor(new Date(selectedDayKey))
    },
    [cursor, selectedDayKey],
  )

  const onSelectDay = useCallback((date: Date, dayKey: string) => {
    setView('day')
    setCursor(date)
    setSelectedDayKey(dayKey)
  }, [])

  const handleRefresh = async () => {
    setSyncing(true)
    try {
      await fetch('/api/appointment-reminders/sync', { method: 'POST' })
      await loadEvents({ refresh: true })
      await loadOverview()
    } finally {
      setSyncing(false)
    }
  }

  const refreshSelection = useCallback(() => {
    void loadEvents({ silent: true })
    void loadOverview()
  }, [loadEvents, loadOverview])

  return (
    <ArOpusPage
      wide
      className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-5 md:px-6 lg:h-full lg:max-h-full lg:overflow-hidden"
    >
      <header className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight md:text-2xl">Calendar</h1>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:max-w-xl">
          <OpusSearchField
            id="ar-calendar-search"
            label="Search appointments"
            value={searchQ}
            onChange={setSearchQ}
            placeholder="Search customer, title, phone…"
            className="min-w-[200px] flex-1"
          />
          {syncLabel ? (
            <Pill tone="neutral" className="hidden shrink-0 text-[11px] sm:inline-flex">
              Sync {syncLabel}
            </Pill>
          ) : null}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={syncing}>
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', syncing && 'animate-spin')} aria-hidden />
            Sync
          </Button>
          <Button nativeButton={false} variant="ghost" size="sm" render={<Link href={AR_SETTINGS_INTEGRATIONS} />}>
            Calendar write-back
          </Button>
          {composeUrl ? (
            <Button
              type="button"
              size="sm"
              onClick={() => window.open(composeUrl, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Add appointment
            </Button>
          ) : (
            <Button nativeButton={false} size="sm" render={<Link href={AR_ROUTES.appointments} />}>
              Add appointment
            </Button>
          )}
          {overviewMeta?.readiness?.remindersActivated && !overviewMeta?.readiness?.remindersPaused ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pauseBusy}
              onClick={() => void setWorkspacePause(true)}
            >
              Pause reminders
            </Button>
          ) : null}
        </div>
      </header>

      {overviewMeta?.readiness?.remindersPaused ? (
        <Callout tone="warning" icon={Bell} title="Automated reminders are paused" className="mb-2">
          <p className="text-sm text-muted-foreground">
            No new reminder texts or emails will send until you resume. Calendar sync continues.
          </p>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="mt-2"
            disabled={pauseBusy}
            onClick={() => void setWorkspacePause(false)}
          >
            Resume reminders
          </Button>
        </Callout>
      ) : null}

      {calendarConnectionCallout ? (
        <Callout tone="warning" icon={Calendar} title={calendarConnectionCallout.title} className="mb-2">
          <p className="text-sm text-muted-foreground">
            {calendarConnectionCallout.body}{' '}
            <TextLink href={AR_SETTINGS_INTEGRATIONS}>Manage connections</TextLink>
          </p>
        </Callout>
      ) : null}

      {(overviewMeta?.stats?.failed7d ?? 0) > 0 ? (
        <Callout tone="danger" icon={AlertTriangle} title="Some reminders failed to deliver" className="mb-2">
          <p className="text-sm text-muted-foreground">
            {overviewMeta?.stats?.failed7d} failed in the last 7 days.{' '}
            <TextLink href={AR_ROUTES.reminders}>Review reminders</TextLink>
          </p>
        </Callout>
      ) : null}

      {!overviewReady ? (
        <div className="min-h-[480px] animate-pulse rounded-xl bg-muted/30" />
      ) : !connected ? (
        <EmptyState
          icon={Calendar}
          title="Connect a calendar"
          description="Authorize Microsoft 365 or Google under Settings → Integrations, then return here."
          action={
            <Button nativeButton={false} size="sm" render={<Link href={AR_SETTINGS_INTEGRATIONS} />}>
              Manage connections
            </Button>
          }
        />
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-600" aria-hidden />
          <p className="text-sm">{error}</p>
          <Button size="sm" onClick={() => loadEvents({ refresh: true })}>Try again</Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] lg:gap-4 lg:overflow-hidden',
            )}
          >
            <div className="flex min-h-[min(52vh,560px)] min-w-0 flex-1 flex-col lg:min-h-0">
              {loading && !events.length ? (
                <div className="min-h-[400px] flex-1 animate-pulse rounded-xl bg-muted/30" />
              ) : (
                <ArCalendarOpusView
                  view={view}
                  cursor={cursor}
                  events={filteredEvents}
                  timeZone={timezone}
                  onViewChange={onViewChange}
                  onPrev={onPrev}
                  onNext={onNext}
                  onToday={onToday}
                  onSelectEvent={(id) => selectAppointment(id)}
                  onSelectDay={onSelectDay}
                  calendarFilter={calendarFilter}
                  calendarFilterOptions={calendarFilterOptions}
                  onCalendarFilterChange={setCalendarFilter}
                  compactChrome
                  fillHeight
                  selectedEventId={selectedId}
                  enrichment={agendaEnrichment}
                  onSelectEventWithTab={(id, tab) => selectAppointment(id, tab)}
                />
              )}
            </div>

            <div className="flex justify-end lg:hidden">
              <Button type="button" variant="outline" size="sm" onClick={() => setMobileActivityOpen(true)}>
                Activity &amp; attention
              </Button>
            </div>

            <aside
              className="hidden h-full min-h-0 max-h-full flex-col overflow-hidden rounded-xl border border-border bg-card lg:flex"
              aria-label="Appointment context"
            >
              {selectedRow ? (
                <AppointmentDetailDrawer
                  layout="panel"
                  row={selectedRow}
                  open
                  onClose={clearSelection}
                  timezone={timezone}
                  onPhoneSaved={refreshSelection}
                  initialTab={panelTab}
                  openConversationOnLoad={openConversationOnLoad}
                  panelBackLabel="Back to overview"
                />
              ) : (
                <ArCalendarRightContextPanel
                  className="min-h-0 flex-1"
                  focusDayKey={selectedDayKey}
                  view={view}
                  timeZone={timezone}
                  events={filteredEvents}
                  overview={overviewFeed}
                  overviewLoading={feedLoading}
                  onSelectAppointment={(id, tab) => selectAppointment(id, tab)}
                />
              )}
            </aside>
          </div>

          <ArCalendarOperationsStrip
            className="hidden shrink-0 lg:block"
            data={overviewFeed}
            collapsed={stripCollapsed}
            onCollapsedChange={setStripCollapsed}
            onSelect={handleStripSelect}
          />
        </div>
      )}

      <AppointmentDetailDrawer
        layout="sheet"
        row={selectedRow}
        open={mobileSheetOpen && Boolean(selectedRow)}
        onClose={clearSelection}
        timezone={timezone}
        onPhoneSaved={refreshSelection}
        initialTab={panelTab}
        openConversationOnLoad={openConversationOnLoad}
      />

      <Sheet open={mobileActivityOpen} onOpenChange={setMobileActivityOpen}>
        <SheetContent side="bottom" className="flex max-h-[85vh] flex-col gap-0 p-0">
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle className="text-base font-semibold">Activity &amp; attention</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <ArCalendarOperationsStrip
              data={overviewFeed}
              collapsed={false}
              onCollapsedChange={() => {}}
              onSelect={(payload) => {
                setMobileActivityOpen(false)
                handleStripSelect(payload)
              }}
              className="border-0 shadow-none"
            />
            <div className="mt-4 border-t pt-4">
              <ArCalendarActivityPanel
                data={overviewFeed as Parameters<typeof ArCalendarActivityPanel>[0]['data']}
                loading={feedLoading}
                onSelectAppointment={(id, tab) => {
                  setMobileActivityOpen(false)
                  selectAppointment(id, tab)
                }}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </ArOpusPage>
  )
}

/** @deprecated Use AppointmentRemindersCalendarWorkspacePage — same calendar home. */
export const AppointmentRemindersCalendarPage = AppointmentRemindersCalendarWorkspacePage
