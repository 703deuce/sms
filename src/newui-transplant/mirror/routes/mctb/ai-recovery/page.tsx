import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Page, PageHeader, Panel, Rows, SettingRow, TextLink } from '@/newui-transplant/components/app/kit'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { Switch } from '@/newui-transplant/components/ui/switch'
import { Input } from '@/newui-transplant/components/ui/input'
import { Label } from '@/newui-transplant/components/ui/label'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'
import { cn } from '@/lib/utils'
import { BUSINESS } from '@/newui-transplant/lib/sandbox-data'
import type { MctbSmsCollectFieldDef } from '@/lib/mctb/lead-recovery/types'
import { formatAiRecoverySenderDescription } from '@/lib/mctb/ai-recovery/sender-copy'
import { LrCollectFieldsOpus } from '@/newui-transplant/connected/mctb/lr-collect-fields-opus'

export type MctbAiRecoveryWired = {
  enabled?: boolean
  senderLabel?: string
  senderE164?: string | null
  businessName?: string
  services?: string
  serviceArea?: string
  hours?: string
  aboutBusiness?: string
  onAboutBusinessChange?: (value: string) => void
  emergencyCriteria?: string
  onEmergencyCriteriaChange?: (value: string) => void
  emergenciesScenarioEnabled?: boolean
  smsCollectFields?: MctbSmsCollectFieldDef[]
  onSmsCollectFieldsChange?: (fields: MctbSmsCollectFieldDef[]) => void
  allowDynamicCustomQuestions?: boolean
  onAllowDynamicCustomQuestionsChange?: (value: boolean) => void
  bookingLinkEnabled?: boolean
  bookingLinkUrl?: string
  bookingLinkLabel?: string
  bookingLinkReadOnly?: boolean
  bookingLinkEditHref?: string
  onEnabledChange?: (value: boolean) => void
  onBookingLinkEnabledChange?: (value: boolean) => void
  onBookingLinkUrlChange?: (value: string) => void
  onBookingLinkLabelChange?: (value: string) => void
  scenarios?: Array<{
    key: string
    title: string
    description: string
    enabled: boolean
    onChange: (value: boolean) => void
  }>
  onSave?: () => Promise<void>
}

export function TransplantMctbAiRecoveryPage({ wired }: { wired?: MctbAiRecoveryWired }) {
  const live = wired !== undefined
  const senderDescription = formatAiRecoverySenderDescription(
    wired?.senderLabel ?? (live ? null : BUSINESS.sender),
    wired?.senderE164,
  )
  const enabled = wired?.enabled ?? (live ? false : true)
  const bookingOn = wired?.bookingLinkEnabled ?? (live ? false : true)
  const bookingUrl = wired?.bookingLinkUrl ?? (live ? '' : 'https://book.northsideplumbing.com/service')
  const bookingLabel = wired?.bookingLinkLabel ?? (live ? '' : 'Book a service visit')

  return (
    <Page>
      <PageHeader
        title="AI Recovery"
        description="Let AI continue the text conversation after a missed call, collect details, and share your booking link."
        actions={<SaveBar onSave={wired?.onSave} />}
      />
      <section className="relative overflow-hidden rounded-xl border bg-sidebar p-6 text-sidebar-foreground">
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-[oklch(0.6_0.2_280)] opacity-25 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary/25 text-[oklch(0.85_0.1_277)]">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-semibold">AI Recovery</p>
            <p className="max-w-xl text-pretty text-sm text-sidebar-foreground/70">{senderDescription}</p>
            <p className="text-sm text-sidebar-foreground/70">
              Replies stop when a teammate responds in the{' '}
              <Link href="/mctb/conversations" className="underline underline-offset-4">Inbox</Link> or the customer opts out. Track outcomes on{' '}
              <Link href="/mctb/missed-calls" className="underline underline-offset-4">Missed Calls</Link>.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => wired?.onEnabledChange?.(Boolean(v))}
            aria-label="Enable AI Recovery"
            className="shrink-0"
          />
        </div>
      </section>

      <div className={cn('mt-4 grid gap-4 lg:grid-cols-3', !enabled && 'pointer-events-none opacity-50')} aria-disabled={!enabled}>
        <div className="flex flex-col gap-4 lg:col-span-2">

          <Panel
            title="About your business"
            description="Tell AI Recovery what it should know so it can answer customers accurately. Include services, service area, hours, pricing guidance, policies, FAQs, or anything customers commonly ask about."
          >
            <div className="grid gap-1.5">
              <Label htmlFor="lr-about-business">Business knowledge</Label>
              <Textarea
                id="lr-about-business"
                rows={8}
                className="min-h-[10rem] resize-y"
                placeholder="Example: We provide residential plumbing throughout Fairfax and Prince William counties. We repair leaks, water heaters, toilets, faucets, drains, and sewer lines. Monday–Friday 8 AM–6 PM. After-hours emergency service for active leaks, flooding, sewage backups, and loss of water."
                value={wired?.aboutBusiness ?? ''}
                onChange={(e) => wired?.onAboutBusinessChange?.(e.target.value)}
              />
            </div>
          </Panel>

          <Panel
            title="Information to collect"
            description="Suggested questions for follow-up — same idea as your receptionist setup. Enable built-ins, add custom questions, and reorder. The agent asks one at a time after answering the customer."
          >
            <LrCollectFieldsOpus
              fields={wired?.smsCollectFields ?? []}
              onChange={(next) => wired?.onSmsCollectFieldsChange?.(next)}
              allowDynamic={wired?.allowDynamicCustomQuestions ?? true}
              onAllowDynamicChange={(v) => wired?.onAllowDynamicCustomQuestionsChange?.(Boolean(v))}
            />
          </Panel>

          {wired?.scenarios?.length ? (
            <Panel title="Advanced scenarios" description="Optional — leave defaults on unless you need to limit what AI handles" bodyClassName="p-0">
              <div className="divide-y">
                {wired.scenarios.map((s) => (
                  <SettingRow
                    key={s.key}
                    title={s.title}
                    description={s.description}
                    control={
                      <Switch
                        checked={s.enabled}
                        onCheckedChange={(v) => s.onChange(Boolean(v))}
                        aria-label={`Enable ${s.title}`}
                      />
                    }
                  />
                ))}
              </div>
              {wired.emergenciesScenarioEnabled ? (
                <div className="border-t p-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="lr-emergency-criteria">What counts as an emergency?</Label>
                    <p className="text-sm text-muted-foreground">
                      Describe urgent situations for your business and what AI Recovery should do. Urgency (needs help soon) is not the same as an emergency.
                    </p>
                    <Textarea
                      id="lr-emergency-criteria"
                      rows={5}
                      className="min-h-[7rem] resize-y"
                      placeholder="Example: Treat active flooding, burst pipes, sewage backing into the home, or complete loss of water as urgent. Collect name, address, and callback number. Notify the on-call team. Do not promise an arrival time."
                      value={wired.emergencyCriteria ?? ''}
                      onChange={(e) => wired.onEmergencyCriteriaChange?.(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </Panel>
          ) : null}

          <Panel title="Booking link">
            {wired?.bookingLinkReadOnly ? (
              <div className="space-y-3 text-sm">
                <SettingRow
                  title="Share booking link"
                  description="Uses the booking link configured in Text Back"
                  control={
                    <Switch
                      checked={bookingOn}
                      onCheckedChange={(v) => wired?.onBookingLinkEnabledChange?.(Boolean(v))}
                      aria-label="Enable booking link for AI Recovery"
                      disabled={!bookingUrl}
                    />
                  }
                />
                {bookingUrl ? (
                  <>
                    <p className="font-medium">{bookingLabel || 'Book an appointment'}</p>
                    <p className="font-mono text-xs text-muted-foreground break-all">{bookingUrl}</p>
                    <p className="text-muted-foreground">AI can send this link when appropriate.</p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No booking link configured.</p>
                )}
                <TextLink href={wired.bookingLinkEditHref || '/mctb/text-back?section=booking'}>
                  {bookingUrl ? 'Edit in Text Back' : 'Configure in Text Back'}
                </TextLink>
              </div>
            ) : (
              <>
                <SettingRow
                  title="Share booking link"
                  description="Sent once AI has collected the required details"
                  control={
                    <Switch
                      checked={bookingOn}
                      onCheckedChange={(v) => wired?.onBookingLinkEnabledChange?.(Boolean(v))}
                      aria-label="Enable booking link"
                    />
                  }
                />
                <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="bl-url">Link URL</Label>
                    <Input
                      id="bl-url"
                      value={bookingUrl}
                      onChange={(e) => wired?.onBookingLinkUrlChange?.(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="bl-label">Label</Label>
                    <Input
                      id="bl-label"
                      value={bookingLabel}
                      onChange={(e) => wired?.onBookingLinkLabelChange?.(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
          </Panel>
        </div>

        <Panel
          title="Structured business details"
          description="From your workspace profile — supplements About your business"
          action={<ButtonLink href="/settings/business" variant="outline" size="sm">Edit profile</ButtonLink>}
          className="h-fit"
        >
          <Rows
            items={[
              { label: 'Name', value: <span className="truncate">{wired?.businessName ?? (wired ? '—' : 'Northside Plumbing')}</span> },
              { label: 'Services', value: wired?.services ?? (wired ? '—' : 'Plumbing, HVAC') },
              { label: 'Service area', value: wired?.serviceArea ?? (wired ? '—' : 'Greater Austin') },
              { label: 'Hours', value: wired?.hours ?? (wired ? '—' : 'Mon–Sat') },
            ]}
          />
        </Panel>
      </div>
    </Page>
  )
}
