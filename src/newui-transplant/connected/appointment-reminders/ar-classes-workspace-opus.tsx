'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Plus,
  Power,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import { useClassEditor } from '@/features/appointments/kimi/classes/use-class-editor'
import { resolveClassSeriesOfferingKind } from '@/lib/appointments/class-series-offering'
import type { ClassSeriesRow } from '@/lib/appointments/classes/class-form'
import { scheduleSummaryForClass } from '@/lib/appointments/classes/class-display'
import { upcomingOccurrences } from '@/lib/appointments/classes/class-summary'
import { ClassSectionWorkspace } from '@/components/appointments/classes/class-section-workspace'
import { CLASS_SECTIONS, type ClassSectionId } from '@/components/appointments/classes/class-section-types'
import {
  APPOINTMENTS_CLASSES_ROUTES,
  type ClassesWorkspaceRoutes,
} from '@/lib/appointments/bookable-workspace-routes'
import { OpusSearchField } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { OpusSchedulingHero } from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { Callout, Page, Panel, Pill } from '@/newui-transplant/components/app/kit'
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

const VALID_SECTIONS = new Set<string>(CLASS_SECTIONS.map((s) => s.id))

type Props = {
  classId: string | null
  routes?: ClassesWorkspaceRoutes
}

export function ArClassesWorkspaceOpus({
  classId,
  routes = APPOINTMENTS_CLASSES_ROUTES,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editor = useClassEditor(classId)
  const [listRows, setListRows] = useState<ClassSeriesRow[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listFailed, setListFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [mobileListOpen, setMobileListOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const sectionParam = searchParams.get('section')
  const section: ClassSectionId =
    sectionParam && VALID_SECTIONS.has(sectionParam)
      ? (sectionParam as ClassSectionId)
      : 'overview'

  const setSection = useCallback(
    (next: ClassSectionId) => {
      if (!classId) return
      router.replace(routes.detailWithSection(classId, next), { scroll: false })
    },
    [classId, router, routes],
  )

  const loadList = useCallback(async () => {
    setListLoading(true)
    setListFailed(false)
    try {
      const res = await fetch('/api/appointments/service-booking/classes')
      if (!res.ok) throw new Error('failed')
      const json = (await res.json()) as { data?: ClassSeriesRow[] }
      setListRows(
        (json.data || []).filter((row) => resolveClassSeriesOfferingKind(row.metadata) === 'class'),
      )
    } catch {
      setListFailed(true)
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const q = search.trim().toLowerCase()
  const filteredClasses = listRows.filter((c) => !q || c.name.toLowerCase().includes(q))

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

  const attention = useMemo(() => {
    const flags = new Set<ClassSectionId>()
    const { form } = editor
    if (!form.name.trim()) flags.add('overview')
    if (upcomingOccurrences(editor.occurrences).length === 0) flags.add('schedule')
    if (!form.staffId || !form.locationId) flags.add('people-place')
    if (form.capacity < 1) flags.add('capacity')
    if (
      form.registrationOpensAt &&
      form.registrationClosesAt &&
      new Date(form.registrationOpensAt) >= new Date(form.registrationClosesAt)
    ) {
      flags.add('capacity')
    }
    if (!form.isFree && form.priceCents <= 0) flags.add('pricing-access')
    return flags
  }, [editor])

  const selectClass = useCallback(
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
          <h2 className="text-sm font-semibold">Classes</h2>
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
      <div className="px-4 py-3">
        <OpusSearchField
          id="ar-classes-search"
          label="Search classes"
          value={search}
          onChange={setSearch}
          placeholder="Search classes"
        />
      </div>
      <div className="max-h-[min(420px,50vh)] flex-1 overflow-y-auto px-2 pb-3 lg:max-h-none">
        {listLoading ? (
          <div className="space-y-2 p-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-muted/50" />
            ))}
          </div>
        ) : filteredClasses.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {q ? 'No matches' : 'No classes yet'}
          </p>
        ) : (
          <ul className="space-y-1">
            {filteredClasses.map((c) => {
              const selected = c.id === classId
              const active = c.active !== false
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectClass(c.id)}
                    className={cn(
                      'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                      selected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/60',
                    )}
                  >
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {scheduleSummaryForClass(c)}
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

  if (editor.loading && classId) {
    return (
      <Page className="max-w-[1600px]">
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          <span className="sr-only">Loading class</span>
        </div>
      </Page>
    )
  }

  if (classId && editor.failed) {
    return (
      <Page className="max-w-[1600px]">
        <Callout tone="warning" icon={AlertTriangle} title="Class not found">
          <p className="text-sm text-muted-foreground">
            This class may have been removed or you may not have access.
          </p>
          <Button type="button" size="sm" className="mt-3" asChild>
            <Link href={routes.list}>Back to classes</Link>
          </Button>
        </Callout>
      </Page>
    )
  }

  if (!classId) {
    const hasClasses = listRows.length > 0
    return (
      <Page className="max-w-[1600px]">
        <OpusSchedulingHero
          icon={Users}
          title="Classes"
          description="Scheduled group sessions customers can register for."
          actions={
            <Button type="button" asChild>
              <Link href={routes.new}>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Create class
              </Link>
            </Button>
          }
        />
        <div className="overflow-hidden rounded-xl border bg-card lg:flex lg:min-h-[480px]">
          <div className={hasClasses ? 'hidden lg:block' : 'block'}>{listSidebar}</div>
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
            {listFailed ? (
              <Callout tone="warning" icon={AlertTriangle} title="Could not load classes">
                <Button type="button" size="sm" className="mt-3" onClick={() => void loadList()}>
                  Retry
                </Button>
              </Callout>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Users className="h-6 w-6 text-muted-foreground" aria-hidden />
                </div>
                <h2 className="mt-4 text-lg font-semibold">
                  {hasClasses ? 'Select a class' : 'No classes yet'}
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {hasClasses
                    ? 'Pick a class to edit schedule, capacity, pricing, and customer setup.'
                    : 'Create a scheduled group session customers can register for.'}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4" aria-hidden />
                    Repeating sessions
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4" aria-hidden />
                    Seats and waitlist
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Wallet className="h-4 w-4" aria-hidden />
                    Packages and pricing
                  </span>
                </div>
                <Button type="button" className="mt-8" asChild>
                  <Link href={routes.new}>Create class</Link>
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
          <span className="truncate">{editor.form.name || 'Select class'}</span>
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
                <Users className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight">
                  {editor.form.name || 'Untitled class'}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Pill tone={editor.form.active ? 'success' : 'neutral'} dot>
                    {editor.form.active ? 'Active' : 'Inactive'}
                  </Pill>
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
                  <DropdownMenuItem
                    onClick={() => void editor.setActive(!editor.form.active).then(() => void loadList())}
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

          <div className="border-b px-5 py-3">
            <Tabs value={section} onValueChange={(v) => setSection(v as ClassSectionId)}>
              <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                {CLASS_SECTIONS.map((s) => (
                  <TabsTrigger key={s.id} value={s.id} className="data-[state=active]:bg-muted">
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
            <Panel className="max-w-4xl" bodyClassName="ar-service-opus">
              <ClassSectionWorkspace
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

      {confirmDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-class-title"
        >
          <Panel className="max-w-md w-full" title="Delete this class?" id="delete-class-title">
            <p className="text-sm text-muted-foreground">
              Sessions are deleted with it. A class with active registrations cannot be deleted — deactivate
              instead.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
                Keep class
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
                {editor.saving ? 'Deleting…' : 'Delete class'}
              </Button>
            </div>
          </Panel>
        </div>
      ) : null}
    </Page>
  )
}
