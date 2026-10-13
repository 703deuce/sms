'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  Briefcase,
  CalendarCheck,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  Power,
  Wallet,
} from 'lucide-react'
import { useServiceEditor } from '@/features/appointments/kimi/services/use-service-editor'
import { useNextAvailable } from '@/features/appointments/kimi/services/use-next-available'
import { typeBelongsToSegment, type ApiTypeRow } from '@/lib/appointments/booking-types-segments'
import {
  isServiceRow,
  serviceDurationSummary,
  serviceIsActive,
  servicePriceLabel,
} from '@/lib/appointments/services/service-display'
import { formatDurationMinutes } from '@/lib/appointments/duration-display'
import { ServiceSectionWorkspace } from '@/components/appointments/services/service-section-workspace'
import {
  SERVICE_SECTIONS,
  type ServiceSectionId,
} from '@/components/appointments/services/service-section-types'
import {
  APPOINTMENTS_SERVICES_ROUTES,
  type ServicesWorkspaceRoutes,
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

const VALID_SECTIONS = new Set<string>(SERVICE_SECTIONS.map((s) => s.id))

function formPriceLabel(paymentMode: string, priceCents: number, priceDisplay?: string): string {
  if (paymentMode === 'none') {
    const display = priceDisplay?.trim()
    return display || 'Free'
  }
  if (priceCents > 0) return `$${(priceCents / 100).toFixed(2)}`
  if (paymentMode === 'deposit') return 'Deposit'
  if (paymentMode === 'full') return 'Paid'
  return '—'
}

type Props = {
  serviceId: string | null
  routes?: ServicesWorkspaceRoutes
}

export function ArServicesWorkspaceOpus({
  serviceId,
  routes = APPOINTMENTS_SERVICES_ROUTES,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editor = useServiceEditor(serviceId)
  const [listRows, setListRows] = useState<ApiTypeRow[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listFailed, setListFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [mobileListOpen, setMobileListOpen] = useState(false)

  const sectionParam = searchParams.get('section')
  const section: ServiceSectionId =
    sectionParam && VALID_SECTIONS.has(sectionParam)
      ? (sectionParam as ServiceSectionId)
      : 'overview'

  const setSection = useCallback(
    (next: ServiceSectionId) => {
      if (!serviceId) return
      router.replace(routes.detailWithSection(serviceId, next), { scroll: false })
    },
    [serviceId, router, routes],
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

  const services = useMemo(
    () => listRows.filter((r) => typeBelongsToSegment(r, 'services') || isServiceRow(r)),
    [listRows],
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

  const phaseTotal = useMemo(
    () => editor.phases.reduce((sum, p) => sum + p.durationMinutes, 0),
    [editor.phases],
  )

  const availabilitySignature = [
    editor.saveStatus,
    editor.form.durationMinutes,
    editor.form.bufferBeforeMinutes,
    editor.form.bufferAfterMinutes,
    editor.form.startTimeMode,
    editor.form.customStartIntervalMinutes,
    editor.form.fixedStartTimes.join(','),
    editor.form.resourceIds.join(','),
    editor.form.namedScheduleId,
    phaseTotal,
  ].join('|')

  const nextAvailable = useNextAvailable(
    serviceId,
    editor.form.name,
    editor.form.enabled && editor.saveStatus === 'saved',
    availabilitySignature,
  )

  const categoryName = useMemo(
    () => editor.options.categoryOptions.find((c) => c.id === editor.form.categoryId)?.name || '',
    [editor.form.categoryId, editor.options.categoryOptions],
  )

  const attention = useMemo(() => {
    const flags = new Set<ServiceSectionId>()
    if (!editor.form.name.trim() || editor.form.durationMinutes < 5) flags.add('overview')
    if (editor.form.startTimeMode === 'fixed' && editor.form.fixedStartTimes.length === 0) {
      flags.add('scheduling')
    }
    const pool =
      editor.form.staffAssignment === 'collective'
        ? editor.form.collectiveStaffIds
        : editor.form.staffIds
    if (editor.form.staffAssignment !== 'any_eligible' && pool.length === 0) {
      flags.add('staff-place')
    }
    if (editor.form.paymentMode !== 'none') {
      if (editor.form.paymentPriceCents <= 0 || !editor.form.paymentProvider) {
        flags.add('pricing-access')
      }
      if (
        editor.form.paymentMode === 'deposit' &&
        editor.form.paymentDepositCents > editor.form.paymentPriceCents
      ) {
        flags.add('pricing-access')
      }
    }
    if (editor.form.groupBookingEnabled && editor.form.groupCapacity < 2) {
      flags.add('customer-setup')
    }
    return flags
  }, [editor.form])

  const q = search.trim().toLowerCase()
  const filteredServices = services.filter((s) => {
    if (categoryFilter && s.config?.categoryId !== categoryFilter) return false
    if (!q) return true
    return s.name.toLowerCase().includes(q)
  })

  const selectService = useCallback(
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
          <h2 className="text-sm font-semibold">Services</h2>
          {!listLoading ? (
            <span className="text-xs text-muted-foreground">{services.length}</span>
          ) : null}
        </div>
        <Button type="button" size="sm" variant="secondary" nativeButton={false} render={<Link href={routes.new} />}>
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
          New
        </Button>
      </div>
      <div className="space-y-3 px-4 py-3">
        <OpusSearchField
          id="ar-services-search"
          label="Search services"
          value={search}
          onChange={setSearch}
          placeholder="Search services"
        />
        {editor.options.categoryOptions.length > 0 ? (
          <div>
            <label htmlFor="ar-services-category" className="text-xs font-medium text-muted-foreground">
              Category
            </label>
            <select
              id="ar-services-category"
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All categories</option>
              {editor.options.categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div className="max-h-[min(420px,50vh)] flex-1 overflow-y-auto px-2 pb-3 lg:max-h-none">
        {listLoading ? (
          <div className="space-y-2 p-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-muted/50" />
            ))}
          </div>
        ) : filteredServices.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {q || categoryFilter ? 'No matches' : 'No services yet'}
          </p>
        ) : (
          <ul className="space-y-1">
            {filteredServices.map((s) => {
              const active = serviceIsActive(s)
              const selected = s.id === serviceId
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => selectService(s.id)}
                    className={cn(
                      'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                      selected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/60',
                    )}
                  >
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {serviceDurationSummary(s)} · {servicePriceLabel(s.config)}
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

  if (editor.loading && serviceId) {
    return (
      <Page className="max-w-[1600px]">
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          <span className="sr-only">Loading service</span>
        </div>
      </Page>
    )
  }

  if (serviceId && editor.failed) {
    return (
      <Page className="max-w-[1600px]">
        <Callout tone="warning" icon={AlertTriangle} title="Service not found">
          <p className="text-sm text-muted-foreground">
            This service may have been removed or you may not have access.
          </p>
          <Button type="button" size="sm" className="mt-3" nativeButton={false} render={<Link href={routes.list} />}>
            Back to services
          </Button>
        </Callout>
      </Page>
    )
  }

  if (!serviceId) {
    return (
      <Page className="max-w-[1600px]">
        <OpusSchedulingHero
          icon={Briefcase}
          title="Services"
          meta={<Pill tone="neutral" dot={false}>Bookable on your link</Pill>}
          description="Define what customers can book — duration, staff, price, and availability. Turn on your public link from Booking page settings."
          actions={
            <Button type="button" nativeButton={false} render={<Link href={routes.new} />}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Create service
            </Button>
          }
        />
        <div className="overflow-hidden rounded-xl border bg-card lg:flex lg:min-h-[480px]">
          <div className="hidden lg:block">{listSidebar}</div>
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
            {listFailed ? (
              <Callout tone="warning" icon={AlertTriangle} title="Could not load services">
                <Button type="button" size="sm" className="mt-3" onClick={() => void loadList()}>
                  Retry
                </Button>
              </Callout>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Briefcase className="h-6 w-6 text-muted-foreground" aria-hidden />
                </div>
                <h2 className="mt-4 text-lg font-semibold">
                  {services.length ? 'Select a service' : 'Create your first service'}
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {services.length
                    ? 'Pick a service to edit scheduling, staff, pricing, and customer intake.'
                    : 'Services are what customers schedule on your booking page — cuts, consults, classes, and more.'}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarCheck className="h-4 w-4" aria-hidden />
                    Duration & buffers
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" aria-hidden />
                    Staff & locations
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Wallet className="h-4 w-4" aria-hidden />
                    Price & deposits
                  </span>
                </div>
                <Button type="button" className="mt-8" nativeButton={false} render={<Link href={routes.new} />}>
                  Create service
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

  const durationLabel =
    phaseTotal > 0
      ? `${phaseTotal} min (phased)`
      : formatDurationMinutes(editor.form.durationMinutes)

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
          <span className="truncate">{editor.form.name || 'Select service'}</span>
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
                <Briefcase className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight">
                  {editor.form.name || 'Untitled service'}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Pill tone={editor.form.enabled ? 'success' : 'neutral'} dot>
                    {editor.form.enabled ? 'Active' : 'Inactive'}
                  </Pill>
                  {categoryName ? <Pill tone="neutral" dot={false}>{categoryName}</Pill> : null}
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

          <div className="flex flex-wrap gap-3 border-b bg-muted/20 px-5 py-2 text-xs text-muted-foreground">
            <span><strong className="text-foreground">{durationLabel}</strong> duration</span>
            <span>
              <strong className="text-foreground">
                {formPriceLabel(
                  editor.form.paymentMode,
                  editor.form.paymentPriceCents,
                  editor.form.priceDisplay,
                )}
              </strong>{' '}
              price
            </span>
            <span>Next slot: <strong className="text-foreground">{nextAvailable.label}</strong></span>
          </div>

          <div className="border-b px-5 py-3">
            <Tabs value={section} onValueChange={(v) => setSection(v as ServiceSectionId)}>
              <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                {SERVICE_SECTIONS.map((s) => (
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
            <Panel className="max-w-3xl" bodyClassName="ar-service-opus">
              <ServiceSectionWorkspace
                section={section}
                editor={editor}
                staffNames={staffNames}
                locationNames={locationNames}
                onNavigateSection={setSection}
              />
            </Panel>
          </div>
        </div>
      </div>
    </Page>
  )
}
