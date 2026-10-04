import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Page, PageHeader, Panel, SettingRow, TextLink } from '@/newui-transplant/components/app/kit'
import { Switch } from '@/newui-transplant/components/ui/switch'
import { Label } from '@/newui-transplant/components/ui/label'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'
import { cn } from '@/lib/utils'
import type { MctbSmsCollectFieldDef, MctbAiRecoveryGoalType } from '@/lib/mctb/lead-recovery/types'
import { formatAiRecoverySenderDescription } from '@/lib/mctb/ai-recovery/sender-copy'
import { LrCollectFieldsOpus } from '@/newui-transplant/connected/mctb/lr-collect-fields-opus'
import { MctbRecoveryGoalOpus } from '@/newui-transplant/connected/mctb/mctb-recovery-goal-opus'

export type MctbAiRecoveryWired = {
  enabled?: boolean
  senderLabel?: string
  senderE164?: string | null
  aboutBusiness?: string
  onAboutBusinessChange?: (value: string) => void
  recoveryGoalType?: MctbAiRecoveryGoalType
  onRecoveryGoalTypeChange?: (value: MctbAiRecoveryGoalType) => void
  customRecoveryGoal?: string
  onCustomRecoveryGoalChange?: (value: string) => void
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
  onSave?: () => Promise<void>
}

export function TransplantMctbAiRecoveryPage({ wired }: { wired?: MctbAiRecoveryWired }) {
  const live = wired !== undefined
  const senderDescription = formatAiRecoverySenderDescription(
    wired?.senderLabel ?? (live ? null : 'Your text-back sender'),
    wired?.senderE164,
  )
  const enabled = wired?.enabled ?? (live ? false : true)
  const goal = wired?.recoveryGoalType ?? 'FOLLOW_UP'
  const bookingOn = wired?.bookingLinkEnabled ?? false
  const bookingUrl = wired?.bookingLinkUrl ?? ''
  const bookingLabel = wired?.bookingLinkLabel ?? ''
  const showBooking = goal === 'SCHEDULE'

  return (
    <Page>
      <PageHeader
        title="AI Recovery"
        description="Let AI continue the conversation after a missed call, answer basic questions, collect what your team needs, and work toward your recovery goal."
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
              Your team can take over from{' '}
              <Link href="/mctb/conversations" className="underline underline-offset-4">Conversations</Link> at any time.
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

      <div className={cn('mt-4 flex max-w-3xl flex-col gap-5', !enabled && 'pointer-events-none opacity-50')} aria-disabled={!enabled}>
        <Panel
          title="Business knowledge"
          description="Tell AI about your business so it can answer callers accurately. Include services, service area, hours, pricing guidance, policies, FAQs, or anything customers commonly ask about."
        >
          <div className="grid gap-1.5">
            <Label htmlFor="lr-about-business">Business knowledge</Label>
            <Textarea
              id="lr-about-business"
              rows={8}
              className="min-h-[10rem] resize-y"
              placeholder="Example: We provide residential plumbing throughout Fairfax and Prince William counties. We repair leaks, water heaters, toilets, faucets, drains, and sewer lines. Monday–Friday 8 AM–6 PM. We do not quote repair prices by text because pricing depends on seeing the problem."
              value={wired?.aboutBusiness ?? ''}
              onChange={(e) => wired?.onAboutBusinessChange?.(e.target.value)}
            />
          </div>
        </Panel>

        <Panel
          title="Recovery goal"
          description="What should AI try to accomplish when a missed caller replies?"
        >
          <MctbRecoveryGoalOpus
            value={goal}
            onChange={(v) => wired?.onRecoveryGoalTypeChange?.(v)}
            customGoal={wired?.customRecoveryGoal ?? ''}
            onCustomGoalChange={(v) => wired?.onCustomRecoveryGoalChange?.(v)}
          />
          {showBooking ? (
            <div className="mt-4 space-y-3 border-t pt-4 text-sm">
              <p className="font-medium">Booking link</p>
              <p className="text-muted-foreground">
                AI will share this link when the caller is ready to schedule.
              </p>
              {wired?.bookingLinkReadOnly ? (
                <>
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
                    </>
                  ) : (
                    <p className="text-muted-foreground">No booking link configured.</p>
                  )}
                  <TextLink href={wired.bookingLinkEditHref || '/mctb/text-back?section=booking'}>
                    {bookingUrl ? 'Configure in Text Back' : 'Configure booking link'}
                  </TextLink>
                </>
              ) : null}
            </div>
          ) : null}
        </Panel>

        <Panel
          title="Information to collect"
          description="Choose what AI should try to collect during the conversation. If the caller already provides something naturally, AI won't ask for it again."
        >
          <LrCollectFieldsOpus
            fields={wired?.smsCollectFields ?? []}
            onChange={(next) => wired?.onSmsCollectFieldsChange?.(next)}
            allowDynamic={wired?.allowDynamicCustomQuestions ?? true}
            onAllowDynamicChange={(v) => wired?.onAllowDynamicCustomQuestionsChange?.(Boolean(v))}
          />
        </Panel>
      </div>
    </Page>
  )
}
