'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, Calendar, RefreshCw } from 'lucide-react'
import CalendarView from '@/components/appointments/kimi-ui/calendar/page'
import CalendarHeader from '@/components/appointments/kimi-ui/calendar/components/CalendarHeader'
import '@/components/appointments/kimi-ui/calendar/reference.css'
import '@/newui-transplant/connected/appointment-reminders/appointment-reminders-opus.css'
import {
  addDays,
  buildCalendarPageModel,
  dateKey,
  getCalendarRange,
  startOfWeek,
  type CalendarApiAppointment,
} from '@/features/appointments/kimi/calendar/map-calendar'
import type { CalendarPageActions, CalendarViewMode } from '@/features/appointments/kimi/calendar/types'
import { AgendaListView } from '@/components/appointments/calendar/agenda-list-view'
import {
  buildCalendarSearchParams,
  calendarUrlEquals,
  parseCalendarCursorFromSearch,
} from '@/features/appointments/kimi/calendar/calendar-url-state'
import { parseArCalendarView } from '@/lib/appointment-reminders/calendar/ar-calendar-url-state'
import { OpusDataSurface } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import {
  isArCalendarViewerReadyFromIntegrationRows,
  isArCalendarViewerReadyFromOverview,
} from '@/lib/appointment-reminders/calendar/ar-calendar-viewer-ready'
import { ArCalendarEventSheet } from '@/newui-transplant/components/appointment-reminders/ar-calendar-event-sheet'
import { EmptyState, Page, PageHeader, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'

function CalendarLoadingShell() {
  return (
    <OpusDataSurface className="ar-cal-surface opus-cal-shell min-h-[480px]">
      <div className="animate-pulse p-5">
        <div className="mb-4 h-10 rounded-lg bg-muted/40" />
        <div className="h-[420px] rounded-xl bg-muted/30" />
      </div>
    </OpusDataSurface>
  )
}

export function AppointmentRemindersCalendarPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialView = parseArCalendarView(searchParams.get('view'))
  const [cursor, setCursor] = useState(() =>
    parseCalendarCursorFromSearch(new URLSearchParams(searchParams.toString()), initialView),
  )
  const [view, setView] = useState<CalendarViewMode>(initialView)
  const [selectedDayKey, setSelectedDayKey] = useState(() => {
    const d = parseCalendarCursorFromSearch(new URLSearchParams(searchParams.toString()), initialView)
    return dateKey(initialView === 'week' ? d : d)
  })
  const [events, setEvents] = useState<CalendarApiAppointment[]>([])
  const [timezone, setTimezone] = useState('America/New_York')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overviewReady, setOverviewReady] = useState(false)
  const [connected, setConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const range = useMemo(() => getCalendarRange(cursor, view), [view, cursor])

  const agendaRangeLabel = useMemo(() => {
    const { from, to } = getCalendarRange(cursor, 'agenda')
    const a = from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const b = to.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    return `${a} – ${b}`
  }, [cursor])

  const syncUrl = useCallback(
    (nextView: CalendarViewMode, nextCursor: Date, nextDayKey: string) => {
      const params = buildCalendarSearchParams({
        view: nextView,
        cursor: nextCursor,
        selectedDayKey: nextDayKey,
        filters: { q: '', staffIds: [], locationId: '', resourceId: '', status: 'all', domainType: 'all' },
      })
      const nextParams = new URLSearchParams(params.toString())
      const currentParams = new URLSearchParams(searchParams.toString())
      if (!calendarUrlEquals(currentParams, nextParams)) {
        router.replace(`${AR_ROUTES.calendar}?${nextParams.toString()}`, { scroll: false })
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
        linked = isArCalendarViewerReadyFromIntegrationRows(calJson.data)
      }

      if (overviewRes.ok) {
        const json = await overviewRes.json()
        const data = json.data
        if (!linked) linked = isArCalendarViewerReadyFromOverview(data)
        if (data?.timezone) setTimezone(data.timezone)
      }

      setConnected(linked)
    } finally {
      setOverviewReady(true)
    }
  }, [])

  useEffect(() => {
    const refresh = () => {
      void loadOverview()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadOverview])

  const loadEvents = useCallback(
    async (opts?: { refresh?: boolean }) => {
      setLoading(true)
      setError(null)
      try {
        const qs = new URLSearchParams({
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        })
        if (opts?.refresh) qs.set('refresh', '1')
        const res = await fetch(`/api/appointment-reminders/calendar/events?${qs}`)
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || 'Failed to load calendar')
        }
        const json = await res.json()
        setEvents(json.data || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load calendar')
      } finally {
        setLoading(false)
      }
    },
    [range.from, range.to],
  )

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  useEffect(() => {
    syncUrl(view, cursor, selectedDayKey)
  }, [view, cursor, selectedDayKey, syncUrl])

  const miniCalendarMonth = useMemo(
    () => new Date(cursor.getFullYear(), cursor.getMonth(), 1),
    [cursor],
  )

  const model = useMemo(
    () =>
      buildCalendarPageModel({
        view,
        cursor,
        selectedDayKey,
        appointments: events,
        miniCalendarMonth,
      }),
    [view, cursor, selectedDayKey, events, miniCalendarMonth],
  )

  const noop = useCallback(() => {}, [])

  const openAppointment = useCallback((id: string) => {
    setSelectedId(id)
    setSheetOpen(true)
  }, [])

  const actions: CalendarPageActions = useMemo(
    () => ({
      onToday: () => {
        const t = new Date()
        setCursor(view === 'week' ? startOfWeek(t) : t)
        setSelectedDayKey(dateKey(t))
      },
      onPrev: () => {
        const d = new Date(cursor)
        if (view === 'month') d.setMonth(d.getMonth() - 1)
        else if (view === 'agenda') d.setDate(d.getDate() - 14)
        else d.setDate(d.getDate() - (view === 'week' ? 7 : 1))
        setCursor(view === 'week' ? startOfWeek(d) : d)
      },
      onNext: () => {
        const d = new Date(cursor)
        if (view === 'month') d.setMonth(d.getMonth() + 1)
        else if (view === 'agenda') d.setDate(d.getDate() + 14)
        else d.setDate(d.getDate() + (view === 'week' ? 7 : 1))
        setCursor(view === 'week' ? startOfWeek(d) : d)
      },
      onViewChange: (v) => {
        setView(v)
        if (v === 'week') setCursor(startOfWeek(cursor))
        else if (v === 'agenda') setCursor(new Date(selectedDayKey))
      },
      onNewAppointment: noop,
      onBlockTime: noop,
      onOpenAppointment: openAppointment,
      onSelectDay: (dk) => {
        setSelectedDayKey(dk)
        if (view === 'month') {
          setView('day')
          setCursor(new Date(`${dk}T12:00:00`))
        }
      },
      onMiniCalendarPrev: () => setCursor(addDays(cursor, -7)),
      onMiniCalendarNext: () => setCursor(addDays(cursor, 7)),
      onViewFullDay: () => setView('day'),
      onShowCalendarSettings: () => router.push(AR_ROUTES.calendars),
      onRetry: () => loadEvents({ refresh: true }),
      timeZone: timezone,
      sideCollapsed: true,
    }),
    [cursor, view, timezone, noop, router, loadEvents, openAppointment, selectedDayKey],
  )

  const handleRefresh = async () => {
    setSyncing(true)
    try {
      await fetch('/api/appointment-reminders/sync', { method: 'POST' })
      await loadEvents({ refresh: true })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Page className="max-w-[1600px]">
      <PageHeader
        title="Calendar"
        meta={<Pill tone="neutral">Read-only</Pill>}
        description="Appointments from your connected Microsoft 365 or Google calendar. Edit events in Outlook or Google; Transovo syncs changes for reminders and SMS rescheduling."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={AR_ROUTES.calendars} />}>
              <Calendar className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Calendar connections
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={syncing}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} aria-hidden />
              Sync now
            </Button>
          </div>
        }
      />

      {!overviewReady ? (
        <CalendarLoadingShell />
      ) : !connected ? (
        <EmptyState
          icon={Calendar}
          title="Connect a calendar"
          description="Authorize Microsoft 365 or Google on Calendar connections, then return here to view imported appointments."
          action={
            <Button nativeButton={false} size="sm" render={<Link href={AR_ROUTES.calendars} />}>
              Open calendar connections
            </Button>
          }
        />
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-600" aria-hidden />
          <p className="text-sm">{error}</p>
          <Button size="sm" onClick={() => loadEvents({ refresh: true })}>Try again</Button>
        </div>
      ) : loading && !events.length ? (
        <CalendarLoadingShell />
      ) : (
        <OpusDataSurface className="ar-cal-surface opus-cal-shell">
          {view === 'agenda' ? (
            <div className="cal-page cal-page-agenda">
              <CalendarHeader
                rangeLabel={agendaRangeLabel}
                view={view}
                onToday={actions.onToday}
                onPrev={actions.onPrev}
                onNext={actions.onNext}
                onViewChange={actions.onViewChange}
                onNewAppointment={noop}
                onBlockTime={noop}
                hideTitleBlock
              />
              <AgendaListView rows={events} onSelect={openAppointment} />
            </div>
          ) : (
            <div className="cal-page">
              <CalendarView
                model={model}
                actions={actions}
                headerView={view}
                hideStatCards
                sideCollapsed
              />
            </div>
          )}
        </OpusDataSurface>
      )}

      <ArCalendarEventSheet
        appointmentId={selectedId}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        timezone={timezone}
      />
    </Page>
  )
}
