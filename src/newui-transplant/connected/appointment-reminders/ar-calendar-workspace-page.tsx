'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, Calendar, RefreshCw } from 'lucide-react'
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
  getArCalendarRange,
  startOfWeek,
} from '@/lib/appointment-reminders/calendar/ar-calendar-layout'
import { calendarEventToAppointmentRow } from '@/lib/appointment-reminders/calendar/calendar-event-to-row'
import {
  isArCalendarViewerReadyFromIntegrationRows,
  isArCalendarViewerReadyFromOverview,
} from '@/lib/appointment-reminders/calendar/ar-calendar-viewer-ready'
import { ArCalendarActivityPanel } from '@/newui-transplant/components/appointment-reminders/ar-calendar-activity-panel'
import {
  ArCalendarOpusView,
  type ArCalendarFilterOption,
} from '@/newui-transplant/components/appointment-reminders/ar-calendar-opus-view'
import { AppointmentDetailDrawer } from '@/newui-transplant/components/appointment-reminders/appointment-detail-drawer'
import { ArOpusPage, OpusSearchField } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { EmptyState, Pill } from '@/newui-transplant/components/app/kit'
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
  const [overviewFeed, setOverviewFeed] = useState<Record<string, unknown> | null>(null)
  const [feedLoading, setFeedLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<'details' | 'reminders' | 'activity' | 'preferences'>('details')
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [mobileActivityOpen, setMobileActivityOpen] = useState(false)
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
    if (!selectedEvent) return null
    return calendarEventToAppointmentRow(selectedEvent, timezone)
  }, [selectedEvent, timezone])

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
        setOverviewFeed(data)
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

  const selectAppointment = useCallback(
    (id: string, tab?: 'details' | 'reminders' | 'activity') => {
      setSelectedId(id)
      setPanelTab(tab || 'details')
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setMobileSheetOpen(true)
      }
    },
    [],
  )

  const clearSelection = useCallback(() => {
    setSelectedId(null)
    setMobileSheetOpen(false)
  }, [])

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
    <ArOpusPage wide className="flex min-h-0 flex-col px-5 py-4 md:px-6">
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
        </div>
      </header>

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
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:min-h-[calc(100vh-11rem)] lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:gap-4',
          )}
        >
          <div className="flex min-h-[min(70vh,720px)] min-w-0 flex-col lg:min-h-0">
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
              />
            )}
          </div>

          <div className="flex justify-end lg:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMobileActivityOpen(true)}
              disabled={Boolean(selectedRow)}
            >
              Today&apos;s activity
            </Button>
          </div>

          <aside
            className="hidden min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card lg:flex"
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
              />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ArCalendarActivityPanel
                  data={overviewFeed as Parameters<typeof ArCalendarActivityPanel>[0]['data']}
                  loading={feedLoading}
                  onSelectAppointment={selectAppointment}
                />
              </div>
            )}
          </aside>
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
      />

      <Sheet open={mobileActivityOpen} onOpenChange={setMobileActivityOpen}>
        <SheetContent side="bottom" className="flex max-h-[85vh] flex-col gap-0 p-0">
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle className="text-base font-semibold">Today&apos;s activity</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ArCalendarActivityPanel
              data={overviewFeed as Parameters<typeof ArCalendarActivityPanel>[0]['data']}
              loading={feedLoading}
              onSelectAppointment={(id, tab) => {
                setMobileActivityOpen(false)
                selectAppointment(id, tab)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </ArOpusPage>
  )
}

/** @deprecated Use AppointmentRemindersCalendarWorkspacePage — same calendar home. */
export const AppointmentRemindersCalendarPage = AppointmentRemindersCalendarWorkspacePage
