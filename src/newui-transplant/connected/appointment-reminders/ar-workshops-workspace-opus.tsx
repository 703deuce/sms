'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  Power,
  Presentation,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useWorkshopEditor } from '@/features/appointments/kimi/workshops/use-workshop-editor'
import { parseClassSeriesMetadata } from '@/lib/appointments/class-series-offering'
import type { WorkshopSeriesRow } from '@/lib/appointments/workshops/workshop-form'
import {
  formatSessionSpan,
  upcomingSessions,
} from '@/lib/appointments/workshops/workshop-schedule'
import { WorkshopSectionWorkspace } from '@/components/appointments/workshops/workshop-section-workspace'
import { WorkshopSummaryStrip } from '@/components/appointments/workshops/workshop-summary-strip'
import {
  WORKSHOP_FILTERS,
  type WorkshopListFilter,
} from '@/components/appointments/workshops/workshops-list-panel'
import {
  WORKSHOP_SECTIONS,
  type WorkshopSectionId,
} from '@/components/appointments/workshops/workshop-section-types'
import {
  APPOINTMENTS_WORKSHOPS_ROUTES,
  type WorkshopsWorkspaceRoutes,
} from '@/lib/appointments/bookable-workspace-routes'
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
import '@/newui-transplant/connected/appointment-reminders/ar-services-editor-opus.css'

const VALID_SECTIONS = new Set<string>(WORKSHOP_SECTIONS.map((s) => s.id))

function matchesFilter(row: WorkshopSeriesRow, filter: WorkshopListFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'inactive') return row.active === false
  const hasUpcoming = upcomingSessions(row.occurrences || []).length > 0
  if (filter === 'upcoming') return row.active !== false && hasUpcoming
  return !hasUpcoming
}

type Props = {
  workshopId: string | null
  routes?: WorkshopsWorkspaceRoutes
}

export function ArWorkshopsWorkspaceOpus({
  workshopId,
  routes = APPOINTMENTS_WORKSHOPS_ROUTES,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editor = useWorkshopEditor(workshopId)
  const [listRows, setListRows] = useState<WorkshopSeriesRow[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listFailed, setListFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<WorkshopListFilter>('all')
  const [mobileListOpen, setMobileListOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [createdNotice, setCreatedNotice] = useState<string | null>(null)

  const sectionParam = searchParams.get('section')
  const section: WorkshopSectionId =
    sectionParam && VALID_SECTIONS.has(sectionParam)
      ? (sectionParam as WorkshopSectionId)
      : 'overview'

  const setSection = useCallback(
    (next: WorkshopSectionId) => {
      if (!workshopId) return
      router.replace(routes.detailWithSection(workshopId, next), { scroll: false })
    },
    [workshopId, router, routes],
  )

  const loadList = useCallback(async () => {
    setListLoading(true)
    setListFailed(false)
    try {
      const res = await fetch('/api/appointments/service-booking/workshops')
      if (!res.ok) throw new Error('failed')
      const json = (await res.json()) as { data?: WorkshopSeriesRow[] }
      setListRows(json.data || [])
    } catch {
      setListFailed(true)
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const createdParam = searchParams.get('created')
  useEffect(() => {
    if (!createdParam || !workshopId) return
    setCreatedNotice(
      createdParam === 'nosession'
        ? 'Workshop created — but its date could not be saved. Set it in Date & time.'
        : 'Workshop created',
    )
    const params = new URLSearchParams(searchParams.toString())
    params.delete('created')
    const query = params.toString()
    router.replace(
      query ? `${routes.detail(workshopId)}?${query}` : routes.detail(workshopId),
      { scroll: false },
    )
  }, [createdParam, router, routes, searchParams, workshopId])

  const q = search.trim().toLowerCase()
  const filteredWorkshops = listRows.filter(
    (w) => (!q || w.name.toLowerCase().includes(q)) && matchesFilter(w, filter),
  )

  const staffNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of editor.options.staffOptions) map.set(s.id, s.name)
    return map
  }, [editor.options.staffOptions])

  const locationNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const l of editor.options.locationOptions) map.set(l.id, l.name)
    return map
  }, [editor.options.locationOptions])

  const intakeFormNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of editor.options.intakeFormOptions) map.set(f.id, f.name)
    return map
  }, [editor.options.intakeFormOptions])

  const registeredCount = useMemo(
    () => editor.registrants.filter((r) => r.status !== 'cancelled').length,
    [editor.registrants],
  )

  const attention = useMemo(() => {
    const flags = new Set<WorkshopSectionId>()
    const { form } = editor
    if (!form.name.trim()) flags.add('overview')
    if (upcomingSessions(editor.sessions).length === 0) flags.add('date-time')
    if (!form.staffId) flags.add('place')
    if (form.locationMode === 'in_person' && !form.locationId) flags.add('place')
    if (form.locationMode === 'virtual' && !form.virtualUrl.trim()) flags.add('place')
    if (form.capacity < 1) flags.add('registration')
    if (
      form.registrationOpensAt &&
      form.registrationClosesAt &&
      new Date(form.registrationOpensAt) >= new Date(form.registrationClosesAt)
    ) {
      flags.add('registration')
    }
    if (!form.isFree && form.priceCents <= 0) flags.add('pricing-access')
    return flags
  }, [editor])

  const selectWorkshop = useCallback(
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
          <h2 className="text-sm font-semibold">Workshops</h2>
          {!listLoading ? (
            <span className="text-xs text-muted-foreground">{listRows.length}</span>
          ) : null}
        </div>
        <Link
          href={routes.new}
          className={cn(
            'inline-flex h-7 items-center gap-1 rounded-lg bg-secondary px-2.5 text-[0.8rem] font-medium',
          )}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New
        </Link>
      </div>
      <div className="space-y-3 px-4 py-3">
        <OpusSearchField
          id="ar-workshops-search"
          label="Search workshops"
          value={search}
          onChange={setSearch}
          placeholder="Search workshops"
        />
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter workshops">
          {WORKSHOP_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                filter === f.id
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60',
              )}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[min(420px,50vh)] flex-1 overflow-y-auto px-2 pb-3 lg:max-h-none">
        {listLoading ? (
          <div className="space-y-2 p-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-muted/50" />
            ))}
          </div>
        ) : filteredWorkshops.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {q || filter !== 'all' ? 'No matches' : 'No workshops yet'}
          </p>
        ) : (
          <ul className="space-y-1">
            {filteredWorkshops.map((row) => {
              const selected = row.id === workshopId
              const meta = parseClassSeriesMetadata(row.metadata)
              const price =
                meta.isFree === false && meta.priceCents
                  ? `$${(meta.priceCents / 100).toFixed(0)}`
                  : 'Free'
              const registered = Number(row.registeredCount ?? 0)
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => selectWorkshop(row.id)}
                    className={cn(
                      'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                      selected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/60',
                    )}
                  >
                    <span className="block truncate text-sm font-medium">{row.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {`${formatSessionSpan(row.occurrences || [])} · ${registered}/${row.capacity} · ${price}`}
                    </span>
                    {meta.cancelledAt ? (
                      <span className="mt-1 inline-block text-[0.6875rem] font-medium text-amber-700">
                        Cancelled
                      </span>
                    ) : row.active === false ? (
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

  if (editor.loading && workshopId) {
    return (
      <Page className="max-w-[1600px]">
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          <span className="sr-only">Loading workshop</span>
        </div>
      </Page>
    )
  }

  if (workshopId && editor.failed) {
    return (
      <Page className="max-w-[1600px]">
        <Callout tone="warning" icon={AlertTriangle} title="Workshop not found">
          <p className="text-sm text-muted-foreground">
            This workshop may have been removed or you may not have access.
          </p>
          <Button type="button" size="sm" className="mt-3" asChild>
            <Link href={routes.list}>Back to workshops</Link>
          </Button>
        </Callout>
      </Page>
    )
  }

  if (!workshopId) {
    const hasWorkshops = listRows.length > 0
    return (
      <Page className="max-w-[1600px]">
        <PageHeader
          title="Workshops"
          description="One-off events on a set date that customers register for in advance."
          actions={
            <Button type="button" asChild>
              <Link href={routes.new}>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Create workshop
              </Link>
            </Button>
          }
        />
        <div className="overflow-hidden rounded-xl border bg-card lg:flex lg:min-h-[480px]">
          <div className={hasWorkshops ? 'hidden lg:block' : 'block'}>{listSidebar}</div>
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
            {listFailed ? (
              <Callout tone="warning" icon={AlertTriangle} title="Could not load workshops">
                <Button type="button" size="sm" className="mt-3" onClick={() => void loadList()}>
                  Retry
                </Button>
              </Callout>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Presentation className="h-6 w-6 text-muted-foreground" aria-hidden />
                </div>
                <h2 className="mt-4 text-lg font-semibold">
                  {hasWorkshops ? 'Select a workshop' : 'No workshops yet'}
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {hasWorkshops
                    ? 'Pick a workshop to edit its date, place, registration, and pricing.'
                    : 'Run a one-off event on a set date that customers register for in advance.'}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" aria-hidden />
                    A set date
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4" aria-hidden />
                    Registrants and waitlist
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" aria-hidden />
                    In person or online
                  </span>
                </div>
                <Button type="button" className="mt-8" asChild>
                  <Link href={routes.new}>Create workshop</Link>
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
  const cancelled = Boolean(editor.form.cancelledAt)

  return (
    <Page className="max-w-[1600px]">
      {createdNotice ? (
        <div
          className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2 text-sm"
          role="status"
        >
          <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="flex-1">{createdNotice}</span>
          <button
            type="button"
            className="rounded p-1 hover:bg-muted"
            aria-label="Dismiss"
            onClick={() => setCreatedNotice(null)}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 lg:hidden">
        <Button
          type="button"
          variant="outline"
          className="justify-between"
          aria-expanded={mobileListOpen}
          onClick={() => setMobileListOpen((v) => !v)}
        >
          <span className="truncate">{editor.form.name || 'Select workshop'}</span>
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
                <Presentation className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight">
                  {editor.form.name || 'Untitled workshop'}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {cancelled ? (
                    <Pill tone="warning" dot>Cancelled</Pill>
                  ) : (
                    <Pill tone={editor.form.active ? 'success' : 'neutral'} dot>
                      {editor.form.active ? 'Active' : 'Inactive'}
                    </Pill>
                  )}
                  {unsaved ? <Pill tone="warning" dot={false}>Unsaved changes</Pill> : null}
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
                  {cancelled ? (
                    <DropdownMenuItem
                      onClick={() => void editor.reopenWorkshop().then(() => void loadList())}
                    >
                      Reopen workshop
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => setConfirmCancel(true)}>
                      Cancel workshop
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() =>
                      void editor.setActive(!editor.form.active).then(() => void loadList())
                    }
                  >
                    <Power className="mr-2 h-4 w-4" aria-hidden />
                    {editor.form.active ? 'Deactivate' : 'Activate'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void editor.duplicate().then(() => void loadList())}>
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="border-b bg-muted/10 px-5 py-3">
            <WorkshopSummaryStrip
              form={editor.form}
              sessions={editor.sessions}
              registeredCount={registeredCount}
              staffNames={staffNames}
              locationNames={locationNames}
            />
          </div>

          <div className="border-b px-5 py-3">
            <Tabs value={section} onValueChange={(v) => setSection(v as WorkshopSectionId)}>
              <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                {WORKSHOP_SECTIONS.map((s) => (
                  <TabsTrigger key={s.id} value={s.id} className="data-[state=active]:bg-muted">
                    {s.label}
                    {attention.has(s.id) ? (
                      <span
                        className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
                        aria-hidden
                      />
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto bg-muted/20 p-5">
            <Panel className="max-w-4xl" bodyClassName="ar-service-opus">
              <WorkshopSectionWorkspace
                section={section}
                editor={editor}
                staffNames={staffNames}
                locationNames={locationNames}
                intakeFormNames={intakeFormNames}
                onNavigateSection={setSection}
              />
            </Panel>
          </div>
        </div>
      </div>

      {confirmCancel ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-workshop-title"
        >
          <Panel className="max-w-md w-full" title="Cancel this workshop?" id="cancel-workshop-title">
            <p className="text-sm text-muted-foreground">
              Registration stops and the workshop leaves your public page. Registrations already taken
              are kept on the record.
            </p>
            {registeredCount > 0 ? (
              <Callout tone="warning" icon={AlertTriangle} title="Registered attendees" className="mt-3">
                <p className="text-sm">
                  {registeredCount} {registeredCount === 1 ? 'person is' : 'people are'} registered.
                  Cancelling does not message them or refund payments — handle that separately.
                </p>
              </Callout>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmCancel(false)}>
                Keep it running
              </Button>
              <Button
                type="button"
                disabled={editor.saving}
                onClick={() => {
                  void editor.cancelWorkshop().then((ok) => {
                    setConfirmCancel(false)
                    if (ok) void loadList()
                  })
                }}
              >
                {editor.saving ? 'Cancelling…' : 'Cancel workshop'}
              </Button>
            </div>
          </Panel>
        </div>
      ) : null}

      {confirmDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-workshop-title"
        >
          <Panel className="max-w-md w-full" title="Delete this workshop?" id="delete-workshop-title">
            <p className="text-sm text-muted-foreground">
              Sessions are deleted with it. A workshop with active registrations cannot be deleted —
              cancel it instead.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
                Keep workshop
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={editor.saving}
                onClick={() => {
                  void editor.remove().then((ok) => {
                    setConfirmDelete(false)
                    if (ok) {
                      void loadList()
                      router.push(routes.list)
                    }
                  })
                }}
              >
                {editor.saving ? 'Deleting…' : 'Delete workshop'}
              </Button>
            </div>
          </Panel>
        </div>
      ) : null}
    </Page>
  )
}
