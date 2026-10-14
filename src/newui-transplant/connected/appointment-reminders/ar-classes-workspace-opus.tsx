'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Power,
  Trash2,
  Users,
} from 'lucide-react'
import { useClassEditor } from '@/features/appointments/kimi/classes/use-class-editor'
import { resolveClassSeriesOfferingKind } from '@/lib/appointments/class-series-offering'
import type { ClassSeriesRow } from '@/lib/appointments/classes/class-form'
import { upcomingOccurrences } from '@/lib/appointments/classes/class-summary'
import { ClassSectionWorkspace } from '@/components/appointments/classes/class-section-workspace'
import { ClassRegistrationRecoveryPanel } from '@/components/appointments/classes/class-registration-recovery-panel'
import { CLASS_SECTIONS, type ClassSectionId } from '@/components/appointments/classes/class-section-types'
import {
  APPOINTMENTS_CLASSES_ROUTES,
  type ClassesWorkspaceRoutes,
} from '@/lib/appointments/bookable-workspace-routes'
import { ClassesCatalogOpusTable } from '@/newui-transplant/connected/scheduling/classes-catalog-opus-table'
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
          <Button type="button" size="sm" className="mt-3" nativeButton={false} render={<Link href={routes.list} />}>
            Back to classes
          </Button>
        </Callout>
      </Page>
    )
  }

  if (!classId) {
    return (
      <ClassesCatalogOpusTable
        rows={listRows}
        loading={listLoading}
        failed={listFailed}
        search={search}
        onSearchChange={setSearch}
        onRetry={() => void loadList()}
        newHref={routes.new}
        detailHref={(id) => routes.detail(id)}
      />
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
      <p className="mb-3">
        <Link href={routes.list} className="text-sm font-medium text-primary hover:underline">
          ← Classes
        </Link>
      </p>
      <div className="overflow-hidden rounded-xl border bg-card">
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
                <DropdownMenuTrigger
                  render={
                    <Button type="button" size="sm" variant="outline" aria-label="More actions">
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </Button>
                  }
                />
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
            <div className="mx-auto max-w-4xl">
              <ClassRegistrationRecoveryPanel />
            </div>
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
