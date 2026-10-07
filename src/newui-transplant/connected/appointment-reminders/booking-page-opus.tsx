'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Calendar,
  Copy,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  Shield,
} from 'lucide-react'
import {
  buildBookingPageModel,
  businessInfoPatch,
  consentPatch,
  type BookingSettingsApiData,
  type BookingTypeApiRow,
} from '@/features/appointments/kimi/booking/map-booking'
import type { BookingPageModel } from '@/features/appointments/kimi/booking/types'
import type { BookingProtectionMode } from '@/lib/appointments/types'
import { ArBookingLivePreview } from '@/newui-transplant/components/appointment-reminders/ar-booking-live-preview'
import { Callout, FeatureEmphasisStrip, Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { Label } from '@/newui-transplant/components/ui/label'
import { Switch } from '@/newui-transplant/components/ui/switch'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'

function BookingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl bg-muted/40" />
        ))}
      </div>
      <div className="h-[520px] rounded-xl bg-muted/40 animate-pulse" />
    </div>
  )
}

export function AppointmentRemindersBookingOpus() {
  const [settings, setSettings] = useState<BookingSettingsApiData | null>(null)
  const [types, setTypes] = useState<BookingTypeApiRow[]>([])
  const [workspaceSlug, setWorkspaceSlug] = useState('')
  const [workspaceName, setWorkspaceName] = useState('Your business')
  const [draft, setDraft] = useState<BookingPageModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [primaryColor, setPrimaryColor] = useState('#6366f1')
  const [logoUrl, setLogoUrl] = useState('')
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeDuration, setNewTypeDuration] = useState(30)
  const [newTypeKind, setNewTypeKind] = useState<'MEETING' | 'SERVICE'>('SERVICE')
  const [creatingType, setCreatingType] = useState(false)
  const [createTypeError, setCreateTypeError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setFailed(false)
    fetch('/api/appointment-reminders/booking')
      .then((r) => {
        if (!r.ok) throw new Error('load failed')
        return r.json()
      })
      .then((json) => {
        const apiSettings = json.data.settings as BookingSettingsApiData
        const apiTypes = (json.data.types || []) as BookingTypeApiRow[]
        const ws = json.data.workspace as { slug: string; name: string } | null
        setSettings(apiSettings)
        const theme = (json.data.schedulerTheme || {}) as { primaryColor?: string; logoUrl?: string }
        setPrimaryColor(theme.primaryColor || '#6366f1')
        setLogoUrl(theme.logoUrl || '')
        setTypes(apiTypes)
        const slug = ws?.slug || ''
        const name = ws?.name || 'Your business'
        setWorkspaceSlug(slug)
        setWorkspaceName(name)
        setDraft(
          buildBookingPageModel({
            settings: apiSettings,
            types: apiTypes,
            workspaceSlug: slug,
            workspaceName: name,
            origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          }),
        )
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const savePatch = useCallback(async (patch: Record<string, unknown>) => {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/appointment-reminders/booking', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('save failed')
      const json = await res.json()
      setSettings(json.data as BookingSettingsApiData)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [])

  const createBookableType = useCallback(async () => {
    const name = newTypeName.trim()
    if (!name) {
      setCreateTypeError('Enter a name for this service or meeting.')
      return
    }
    setCreatingType(true)
    setCreateTypeError('')
    try {
      const res = await fetch('/api/appointment-reminders/booking/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          durationMinutes: newTypeDuration,
          bookingTypeKind: newTypeKind,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCreateTypeError(typeof json.error === 'string' ? json.error : 'Could not create bookable type.')
        return
      }
      const apiTypes = (json.data?.types || []) as BookingTypeApiRow[]
      setTypes(apiTypes)
      setNewTypeName('')
      if (settings) {
        setDraft(
          buildBookingPageModel({
            settings,
            types: apiTypes,
            workspaceSlug,
            workspaceName,
            origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          }),
        )
      }
      if (!draft?.bookingEnabled && workspaceSlug) {
        await savePatch({ bookingEnabled: true, publicBookingProfile: 'simple' })
        setDraft((d) => (d ? { ...d, bookingEnabled: true } : d))
      }
    } finally {
      setCreatingType(false)
    }
  }, [
    newTypeName,
    newTypeDuration,
    newTypeKind,
    settings,
    workspaceSlug,
    workspaceName,
    draft?.bookingEnabled,
    savePatch,
  ])

  const protectionOptions = useMemo(
    () => draft?.protectionOptions ?? [],
    [draft?.protectionOptions],
  )

  if (loading) return <BookingSkeleton />
  if (failed || !draft) {
    return (
      <Callout tone="warning" icon={AlertTriangle} title="Could not load booking settings">
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
        <Button type="button" size="sm" className="mt-3" onClick={load}>Try again</Button>
      </Callout>
    )
  }

  const hasSlug = draft.hasSlug
  const bookingUrl = draft.bookingUrl

  return (
    <div className="space-y-6">
      <FeatureEmphasisStrip
        icon={Globe}
        title="Simple online booking"
        badge={<Pill tone="neutral" dot={false}>Meetings & services only</Pill>}
        description="Share one link so customers book and pay on your public page. The booking page only shows appointment types you create below (or in Appointment types)."
      />

      <Panel
        title="How booking gets on your link"
        description="Customers see nothing until these pieces exist. Branding on this page does not create services."
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground">Business URL slug</span> — required for{' '}
            <code className="text-xs">/book/your-slug</code>{' '}
            {hasSlug ? (
              <Pill tone="success" dot={false} className="ml-1 inline-flex">Done</Pill>
            ) : (
              <Link href="/settings/business" className="font-medium text-primary underline-offset-2 hover:underline">
                Set in Business settings
              </Link>
            )}
          </li>
          <li>
            <span className="text-foreground">At least one bookable type</span> — a meeting or service (name +
            duration){' '}
            {draft.appointmentTypes.length > 0 ? (
              <Pill tone="success" dot={false} className="ml-1 inline-flex">Done</Pill>
            ) : (
              <span className="text-foreground">— use the form below</span>
            )}
          </li>
          <li>
            <span className="text-foreground">Booking page enabled</span> — toggle in the next panel{' '}
            {draft.bookingEnabled ? (
              <Pill tone="success" dot={false} className="ml-1 inline-flex">On</Pill>
            ) : (
              <span>— turn on when types exist</span>
            )}
          </li>
          <li>
            <span className="text-foreground">Open times</span> — default Mon–Fri 9–5 unless you change{' '}
            <Link
              href="/appointments/availability"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Availability
            </Link>
          </li>
        </ol>
      </Panel>

      <Panel
        title="Create your first bookable service"
        description="This creates the same appointment type the public page lists (stored as a bookable type in your workspace)."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="ar-new-type-name">Name</Label>
            <Input
              id="ar-new-type-name"
              className="mt-1.5"
              placeholder="e.g. Initial consultation"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ar-new-type-duration">Duration (minutes)</Label>
            <Input
              id="ar-new-type-duration"
              type="number"
              min={5}
              max={480}
              className="mt-1.5"
              value={newTypeDuration}
              onChange={(e) => setNewTypeDuration(Number(e.target.value) || 30)}
            />
          </div>
          <div>
            <SimpleSelect
              id="ar-new-type-kind"
              label="Kind"
              className="mt-1.5"
              value={newTypeKind}
              onChange={(v) => setNewTypeKind(v as 'MEETING' | 'SERVICE')}
              options={[
                { value: 'SERVICE', label: 'Service' },
                { value: 'MEETING', label: 'Meeting' },
              ]}
            />
          </div>
        </div>
        {createTypeError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">{createTypeError}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" disabled={creatingType} onClick={() => void createBookableType()}>
            {creatingType ? 'Creating…' : 'Create bookable type'}
          </Button>
          <span className="text-xs text-muted-foreground">
            Or use the full editor in{' '}
            <Link href="/appointments/types" className="text-primary underline-offset-2 hover:underline">
              Appointment types
            </Link>{' '}
            for price, staff, and intake.
          </span>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <Panel
            title="Public booking page"
            description={
              draft.bookingEnabled
                ? 'Your booking link is live for enabled meeting and service types.'
                : 'Turn on booking when you are ready to accept appointments online.'
            }
            action={
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {draft.bookingEnabled ? 'Enabled' : 'Disabled'}
                </span>
                <Switch
                  checked={draft.bookingEnabled}
                  disabled={saving || !hasSlug}
                  onCheckedChange={(enabled) => {
                    setDraft((d) => (d ? { ...d, bookingEnabled: enabled } : d))
                    void savePatch({
                      bookingEnabled: enabled,
                      publicBookingProfile: 'simple',
                    })
                  }}
                  aria-label="Enable public booking page"
                />
              </div>
            }
          >
            {!hasSlug ? (
              <Callout tone="warning" icon={AlertTriangle} title="Workspace link not ready">
                <p className="text-sm text-muted-foreground">
                  Set your business URL slug under{' '}
                  <Link href="/settings/business" className="font-medium text-primary underline-offset-2 hover:underline">
                    Business settings
                  </Link>{' '}
                  before sharing a booking link.
                </p>
              </Callout>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="ar-booking-url">Customer booking link</Label>
                  <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="ar-booking-url"
                        readOnly
                        className="pl-9"
                        value={bookingUrl}
                      />
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!draft.bookingPath) return
                          window.open(draft.bookingPath, '_blank', 'noopener,noreferrer')
                        }}
                      >
                        <ExternalLink className="mr-1.5 h-4 w-4" />
                        Open
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          if (!bookingUrl) return
                          await navigator.clipboard.writeText(bookingUrl)
                          setCopied(true)
                          window.setTimeout(() => setCopied(false), 2000)
                        }}
                      >
                        <Copy className="mr-1.5 h-4 w-4" />
                        {copied ? 'Copied' : 'Copy link'}
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Customers use this link to pick a service, choose a time, and complete checkout when payment is
                    enabled on the appointment type.
                  </p>
                </div>

                {draft.appointmentTypes.length === 0 ? (
                  <Callout tone="info" icon={Calendar} title="No bookable types yet">
                    <p className="text-sm text-muted-foreground">
                      Create at least one enabled meeting or service appointment type (see{' '}
                      <Link
                        href="/appointments/types"
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        Appointment types
                      </Link>
                      ). Class and group types are hidden on this simple booking page.
                    </p>
                  </Callout>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Showing {draft.appointmentTypes.length} enabled meeting/service type
                    {draft.appointmentTypes.length === 1 ? '' : 's'} in preview. Names, duration, price, and
                    payment are edited in{' '}
                    <Link
                      href="/appointments/types"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Appointment types
                    </Link>
                    — not on this page.
                  </p>
                )}
              </div>
            )}
          </Panel>

          <Panel
            title="What this page does not change"
            description="Everything below still uses the same booking engine — nothing is disconnected. Open these when customers see the wrong service, price, or times."
            action={<Layers className="h-4 w-4 text-muted-foreground" aria-hidden />}
          >
            <ul className="space-y-3 text-sm">
              <li className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">Services & prices</span> — what appears on the
                  list, deposits, checkout
                </span>
                <Link
                  href="/appointments/types"
                  className="inline-flex shrink-0 items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
                >
                  Appointment types
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </li>
              <li className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">Open hours & slots</span> — when times are offered
                </span>
                <Link
                  href="/appointments/availability"
                  className="inline-flex shrink-0 items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
                >
                  Availability
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </li>
              <li className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">Stripe / merchant</span> — whether card payment
                  succeeds
                </span>
                <Link
                  href="/appointments/pricing-payments"
                  className="inline-flex shrink-0 items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
                >
                  Pricing & payments
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </li>
              <li className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">Intake forms, add-ons, classes, store</span> —
                  full Appointments booking hub
                </span>
                <Link
                  href="/appointments/booking"
                  className="inline-flex shrink-0 items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
                >
                  Booking pages (advanced)
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </li>
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              AR simple booking hides packages, wallet, AI assistant, and multi-service cart on the public page.
              Paid booking still works when payment is set on the type. Subscriptions and store URLs may still exist
              for workspaces that use the full profile or deep links.
            </p>
          </Panel>

          <Panel
            title="How customers see your business"
            description="Shown on the public booking page header."
            action={
              saved ? (
                <Pill tone="success" dot={false}>Saved</Pill>
              ) : saving ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : null
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="ar-biz-name">Display name</Label>
                <Input
                  id="ar-biz-name"
                  className="mt-1.5"
                  value={draft.businessInfo.displayName}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, businessInfo: { ...d.businessInfo, displayName: e.target.value } } : d,
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="ar-biz-tz">Timezone</Label>
                <Input
                  id="ar-biz-tz"
                  className="mt-1.5"
                  value={draft.businessInfo.timezone}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, businessInfo: { ...d.businessInfo, timezone: e.target.value } } : d,
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="ar-biz-phone">Business phone</Label>
                <Input
                  id="ar-biz-phone"
                  className="mt-1.5"
                  value={draft.businessInfo.phone}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, businessInfo: { ...d.businessInfo, phone: e.target.value } } : d,
                    )
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="ar-biz-address">Address</Label>
                <Input
                  id="ar-biz-address"
                  className="mt-1.5"
                  value={draft.businessInfo.address}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, businessInfo: { ...d.businessInfo, address: e.target.value } } : d,
                    )
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                disabled={saving}
                onClick={() => {
                  void savePatch(businessInfoPatch(draft))
                }}
              >
                {saving ? 'Saving…' : 'Save business info'}
              </Button>
            </div>
          </Panel>

          <Panel
            title="SMS consent & legal links"
            description="Copy shown beside the SMS opt-in on your booking form."
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="ar-consent">SMS consent wording</Label>
                <Textarea
                  id="ar-consent"
                  className="mt-1.5 min-h-[72px]"
                  value={draft.smsConsent.wording}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, smsConsent: { ...d.smsConsent, wording: e.target.value } } : d,
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="ar-terms-text">Terms & conditions text</Label>
                <Textarea
                  id="ar-terms-text"
                  className="mt-1.5 min-h-[100px]"
                  value={draft.smsConsent.termsText}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, smsConsent: { ...d.smsConsent, termsText: e.target.value } } : d,
                    )
                  }
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Version {draft.smsConsent.termsVersion || 'v1'} — saving updated text creates a new version for
                  compliance.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ar-terms-url">Terms of service URL</Label>
                  <Input
                    id="ar-terms-url"
                    className="mt-1.5"
                    value={draft.smsConsent.termsUrl}
                    onChange={(e) =>
                      setDraft((d) =>
                        d ? { ...d, smsConsent: { ...d.smsConsent, termsUrl: e.target.value } } : d,
                    )
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="ar-privacy-url">Privacy policy URL</Label>
                  <Input
                    id="ar-privacy-url"
                    className="mt-1.5"
                    value={draft.smsConsent.privacyUrl}
                    onChange={(e) =>
                      setDraft((d) =>
                        d ? { ...d, smsConsent: { ...d.smsConsent, privacyUrl: e.target.value } } : d,
                    )
                    }
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                disabled={saving || !settings}
                onClick={() => {
                  if (!settings) return
                  const patch = consentPatch(draft, settings.termsText)
                  void savePatch(patch).then(() => {
                    if (patch.termsVersion) {
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              smsConsent: {
                                ...d.smsConsent,
                                termsVersion: patch.termsVersion as string,
                              },
                            }
                          : d,
                      )
                    }
                  })
                }}
              >
                {saving ? 'Saving…' : 'Save consent & legal'}
              </Button>
            </div>
          </Panel>

          <Panel
            title="Page appearance"
            description="Brand color and logo on your customer-facing booking page (New UI)."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ar-booking-primary">Accent color</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    id="ar-booking-primary"
                    type="color"
                    className="h-10 w-14 cursor-pointer p-1"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="ar-booking-logo">Logo URL</Label>
                <Input
                  id="ar-booking-logo"
                  className="mt-1.5"
                  placeholder="https://…"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                disabled={saving}
                onClick={() => {
                  void savePatch({
                    publicBookingProfile: 'simple',
                    schedulerTheme: { primaryColor, logoUrl: logoUrl.trim() || undefined },
                  })
                }}
              >
                {saving ? 'Saving…' : 'Save appearance'}
              </Button>
            </div>
          </Panel>

          <Panel
            title="Booking protection"
            description="Reduce spam and risky bookings without changing your reminder flow."
            action={<Shield className="h-4 w-4 text-muted-foreground" aria-hidden />}
          >
            <Label htmlFor="ar-protection">Protection level</Label>
            <SimpleSelect
              id="ar-protection"
              label="Protection level"
              className="mt-1.5 max-w-md"
              value={draft.protectionMode}
              onChange={(mode) => {
                const next = mode as BookingProtectionMode
                setDraft((d) => (d ? { ...d, protectionMode: next } : d))
                void savePatch({ bookingProtection: { mode: next } })
              }}
              options={protectionOptions.map((o) => ({
                value: o.id,
                label: o.name,
              }))}
            />
          </Panel>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <ArBookingLivePreview
            businessInfo={draft.businessInfo}
            appointmentTypes={draft.appointmentTypes}
            whyBookItems={draft.whyBookItems}
            smsConsent={draft.smsConsent}
          />
        </aside>
      </div>
    </div>
  )
}
