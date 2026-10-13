'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  CalendarCheck,
  ChevronDown,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  MoreHorizontal,
  Plus,
  Power,
  Users,
  Video,
} from 'lucide-react'
import { useMeetingEditor } from '@/features/appointments/kimi/meetings/use-meeting-editor'
import { typeBelongsToSegment, type ApiTypeRow } from '@/lib/appointments/booking-types-segments'
import {
  meetingSetupSteps,
  sectionsNeedingAttention,
} from '@/lib/appointments/meetings/meeting-setup'
import {
  formatDurationMinutes,
  meetingIsActive,
  meetingMethodLabel,
} from '@/lib/appointments/meetings/meeting-display'
import { MeetingSectionWorkspace } from '@/components/appointments/meetings/meeting-section-workspace'
import { MEETING_SECTIONS, type MeetingSectionId } from '@/components/appointments/meetings/meeting-section-types'
import {
  APPOINTMENTS_MEETINGS_ROUTES,
  type MeetingsWorkspaceRoutes,
} from '@/lib/appointments/bookable-workspace-routes'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { OpusSearchField } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Callout, Page, PageHeader, Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/newui-transplant/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/newui-transplant/components/ui/tabs'
import { cn } from '@/lib/utils'
import '@/newui-transplant/connected/appointment-reminders/ar-meetings-editor-opus.css'

const VALID_SECTIONS = new Set<string>(MEETING_SECTIONS.map((s) => s.id))

type Props = {
  meetingId: string | null
  routes?: MeetingsWorkspaceRoutes
}

export function ArMeetingsWorkspaceOpus({
  meetingId,
  routes = APPOINTMENTS_MEETINGS_ROUTES,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editor = useMeetingEditor(meetingId, routes)
  const [listRows, setListRows] = useState<ApiTypeRow[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listFailed, setListFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [mobileListOpen, setMobileListOpen] = useState(false)

  const sectionParam = searchParams.get('section')
  const section: MeetingSectionId =
    sectionParam && VALID_SECTIONS.has(sectionParam)
      ? (sectionParam as MeetingSectionId)
      : 'overview'

  const setSection = useCallback(
    (next: MeetingSectionId) => {
      if (!meetingId) return
      router.replace(routes.detailWithSection(meetingId, next), { scroll: false })
    },
    [meetingId, router, routes],
  )

  const loadList = useCallback(async () => {
    setListLoading(true)
    setListFailed(false)
    try {
      const res = await fetch('/api/appointments/types')
      if (!res.ok) throw new Error('failed')
      const json = await res.json()
      setListRows((json.data || []) as ApiTypeRow[])
    } catch {
      setListFailed(true)
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const meetings = useMemo(
    () => listRows.filter((r) => typeBelongsToSegment(r, 'meetings')),
    [listRows],
  )

  const q = search.trim().toLowerCase()
  const filteredMeetings = meetings.filter((m) => !q || m.name.toLowerCase().includes(q))

  const staffNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of editor.options.staffOptions) map.set(s.id, s.name)
    return map
  }, [editor.options.staffOptions])

  const attention = useMemo(
    () => sectionsNeedingAttention(meetingSetupSteps(editor.form)),
    [editor.form],
  )

  const selectMeeting = useCallback(
    (id: string) => {
      router.push(routes.detail(id))
      setMobileListOpen(false)
    },
    [router, routes],
  )

  const listSidebar = (
    <aside className="flex w-full flex-col border-b lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">Meetings</h2>
          {!listLoading ? (
            <span className="text-xs text-muted-foreground">{meetings.length}</span>
          ) : null}
        </div>
        <Button type="button" size="sm" variant="secondary" asChild>
          <Link href={routes.new}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            New
          </Link>
        </Button>
      </div>
      <div className="px-4 py-3">
        <OpusSearchField
          id="ar-meetings-search"
          label="Search meetings"
          value={search}
          onChange={setSearch}
          placeholder="Search meetings"
        />
      </div>
      <div className="max-h-[min(420px,50vh)] flex-1 overflow-y-auto px-2 pb-3 lg:max-h-none">
        {listLoading ? (
          <div className="space-y-2 p-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-muted/50" />
            ))}
          </div>
        ) : filteredMeetings.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {q ? 'No matches' : 'No meetings yet'}
          </p>
        ) : (
          <ul className="space-y-1">
            {filteredMeetings.map((m) => {
              const active = meetingIsActive(m)
              const selected = m.id === meetingId
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => selectMeeting(m.id)}
                    className={cn(
                      'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                      selected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/60',
                    )}
                  >
                    <span className="block truncate text-sm font-medium">{m.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {formatDurationMinutes(m.durationMinutes)}
                      {m.config?.location ? ` · ${meetingMethodLabel({ location: m.config.location })}` : ''}
                    </span>
                    {!active ? (
                      <span className="mt-1 inline-block text-[0.6875rem] font-medium text-muted-foreground">
                        Inactive
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )

  if (editor.loading && meetingId) {
    return (
      <Page className="max-w-[1600px]">
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          <span className="sr-only">Loading meeting</span>
        </div>
      </Page>
    )
  }

  if (meetingId && editor.failed) {
    return (
      <Page className="max-w-[1600px]">
        <Callout tone="warning" icon={AlertTriangle} title="Meeting not found">
          <p className="text-sm text-muted-foreground">
            This meeting may have been removed or you may not have access.
          </p>
          <Button type="button" size="sm" className="mt-3" asChild>
            <Link href={routes.list}>Back to meetings</Link>
          </Button>
        </Callout>
      </Page>
    )
  }

  if (!meetingId) {
    return (
      <Page className="max-w-[1600px]">
        <PageHeader
          title="Meetings"
          meta={<Pill tone="neutral" dot={false}>Bookable on your link</Pill>}
          description={
            <>
              One-to-one or team meetings customers schedule themselves. Manage your public link under{' '}
              <Link href={AR_ROUTES.booking} className="font-medium text-primary underline-offset-2 hover:underline">
                Booking page
              </Link>
              .
            </>
          }
          actions={
            <Button type="button" asChild>
              <Link href={routes.new}>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Create meeting
              </Link>
            </Button>
          }
        />
        <div className="overflow-hidden rounded-xl border bg-card lg:flex lg:min-h-[480px]">
          <div className="hidden lg:block">{listSidebar}</div>
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
            {listFailed ? (
              <Callout tone="warning" icon={AlertTriangle} title="Could not load meetings">
                <Button type="button" size="sm" className="mt-3" onClick={() => void loadList()}>
                  Retry
                </Button>
              </Callout>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Video className="h-6 w-6 text-muted-foreground" aria-hidden />
                </div>
                <h2 className="mt-4 text-lg font-semibold">
                  {meetings.length ? 'Select a meeting' : 'Schedule bookable meetings'}
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {meetings.length
                    ? 'Pick a meeting from the list to edit availability, hosts, and booking rules.'
                    : 'Discovery calls, consultations, and demos — customers pick a time on your booking link.'}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarCheck className="h-4 w-4" aria-hidden />
                    Availability-driven slots
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4" aria-hidden />
                    Host routing
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Link2 className="h-4 w-4" aria-hidden />
                    Shareable link
                  </span>
                </div>
                <Button type="button" className="mt-8" asChild>
                  <Link href={routes.new}>Create meeting</Link>
                </Button>
                <div className="mt-8 w-full max-w-md lg:hidden">{listSidebar}</div>
              </>
            )}
          </div>
        </div>
      </Page>
    )
  }

  const unsaved = editor.saveStatus === 'dirty' || editor.saveStatus === 'error'
  const saveLabel =
    editor.saveStatus === 'saving'
      ? 'Saving…'
      : editor.saveStatus === 'saved'
        ? 'Saved'
        : 'Save changes'

  return (
    <Page className="max-w-[1600px]">
      <div className="mb-4 flex flex-col gap-3 lg:hidden">
        <Button
          type="button"
          variant="outline"
          className="justify-between"
          aria-expanded={mobileListOpen}
          onClick={() => setMobileListOpen((v) => !v)}
        >
          <span className="truncate">{editor.form.name || 'Select meeting'}</span>
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
        </Button>
        {mobileListOpen ? (
          <div className="overflow-hidden rounded-xl border bg-card">{listSidebar}</div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card lg:flex lg:min-h-[calc(100vh-12rem)]">
        <div className="hidden lg:flex">{listSidebar}</div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-col gap-4 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                aria-hidden
              >
                <Video className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight">
                  {editor.form.name || 'Untitled meeting'}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Pill tone={editor.form.enabled ? 'success' : 'neutral'} dot>
                    {editor.form.enabled ? 'Active' : 'Inactive'}
                  </Pill>
                  {unsaved ? (
                    <Pill tone="warning" dot={false}>Unsaved changes</Pill>
                  ) : null}
                </div>
                {editor.error ? (
                  <p className="mt-2 text-sm text-destructive">{editor.error}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {editor.bookingLink ? (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={editor.previewBooking}>
                    <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden />
                    Preview
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void editor.copyBookingLink()}
                  >
                    <Copy className="mr-1.5 h-4 w-4" aria-hidden />
                    {editor.copied ? 'Copied' : 'Copy link'}
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={editor.saving || !unsaved}
                onClick={() => void editor.save().then(() => void loadList())}
              >
                {editor.saveStatus === 'saving' ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                {saveLabel}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="outline" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => void editor.setEnabled(!editor.form.enabled).then(() => void loadList())}
                  >
                    <Power className="mr-2 h-4 w-4" aria-hidden />
                    {editor.form.enabled ? 'Deactivate' : 'Activate'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void editor.duplicate().then(() => void loadList())}>
                    Duplicate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="border-b px-5 py-3">
            <Tabs value={section} onValueChange={(v) => setSection(v as MeetingSectionId)}>
              <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                {MEETING_SECTIONS.map((s) => (
                  <TabsTrigger
                    key={s.id}
                    value={s.id}
                    className="data-[state=active]:bg-muted"
                  >
                    {s.label}
                    {attention.has(s.id) ? (
                      <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto bg-muted/20 p-5">
            <Panel className="max-w-3xl" bodyClassName="ar-meeting-opus">
              <MeetingSectionWorkspace
                section={section}
                form={editor.form}
                options={editor.options}
                staffNames={staffNames}
                bookingLink={editor.bookingLink}
                onFormChange={editor.updateForm}
                onNavigateSection={setSection}
                onPreview={editor.previewBooking}
                onCopyLink={() => void editor.copyBookingLink()}
                onAddStaff={editor.addStaffMember}
                onAddLocation={editor.addLocation}
                copied={editor.copied}
              />
            </Panel>
          </div>
        </div>
      </div>
    </Page>
  )
}
