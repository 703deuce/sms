'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, CheckCircle2, ChevronDown, ChevronUp, PhoneForwarded } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfigSection, Field, Pill } from '@/newui-transplant/components/app/kit'
import { OPUS_CARD, OPUS_CONFIG_INSET } from '@/newui-transplant/components/app/opus-surfaces'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { Button } from '@/newui-transplant/components/ui/button'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'
import { Input } from '@/newui-transplant/components/ui/input'
import { BUSINESS } from '@/newui-transplant/lib/sandbox-data'

export type MctbSetupPhoneSenderOption = {
  id: 'platform' | string
  title: string
  description: string
  active: boolean
  selectable: boolean
  statusLabel?: string
}

export type MctbSetupPhoneWired = {
  businessLine?: string
  businessLineMeta?: string
  forwardingDestination?: string
  forwardingMeta?: string
  callPathHint?: string
  carrierId?: string
  carrierOptions?: Array<{ value: string; label: string }>
  ringSeconds?: string
  ringOptions?: string[]
  instructionTitle?: string
  instructionSteps?: string[]
  dialCode?: string
  verificationPillLabel?: string
  verificationPillTone?: 'success' | 'warning'
  verificationTitle?: string
  verificationDetail?: string
  senderHeadline?: string
  senderDetail?: string
  senderOptions?: MctbSetupPhoneSenderOption[]
  ownSenderEntitled?: boolean
  ownSenderLockedHint?: string
  ownSenderRegistrationHref?: string
  ownSenderLifecycleSteps?: string[]
  senderRegistrationLabel?: string
  senderRegistrationTone?: 'success' | 'warning'
  onCarrierChange?: (carrierId: string) => void
  onRingChange?: (seconds: string) => void
  onSave?: () => Promise<void>
  onSelectSender?: (choice: 'platform' | string) => void | Promise<void>
  onVerifyAgain?: () => Promise<void>
  onManageNumbers?: () => void
  onAddNumber?: () => void
  businessLineInput?: string
  businessLineError?: string | null
  onBusinessLineChange?: (value: string) => void
  forwardingDestinationReady?: boolean
  forwardingInstructionsEnabled?: boolean
  forwardingVerifyEnabled?: boolean
  forwardingInstructionsPendingMessage?: string
}

const CARRIERS = ['Verizon', 'AT&T', 'T-Mobile', 'Comcast Business', 'RingCentral', 'Other']
const RING = ['10', '15', '20', '25', '30']
const INVENTORY_PREVIEW = 2

function SenderOptionRow({
  opt,
  locked,
  onSelect,
}: {
  opt: MctbSetupPhoneSenderOption
  locked: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={opt.active}
      disabled={locked}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition',
        opt.active ? 'bg-accent/50' : 'hover:bg-muted/50',
        locked && 'cursor-not-allowed opacity-70',
      )}
    >
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full border',
          opt.active && 'border-primary',
        )}
      >
        {opt.active ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{opt.title}</span>
      {opt.statusLabel ? (
        <Pill tone={opt.active ? 'success' : 'neutral'} className="shrink-0">{opt.statusLabel}</Pill>
      ) : null}
    </button>
  )
}

export function TransplantMctbSetupPhonePage({ wired }: { wired?: MctbSetupPhoneWired }) {
  const [inventoryExpanded, setInventoryExpanded] = useState(false)
  const live = wired !== undefined
  const businessLine = wired?.businessLine ?? (live ? 'Not configured' : BUSINESS.line)
  const forwardDest = wired?.forwardingDestination ?? (live ? '—' : '—')
  const carrierOptions =
    live && wired?.carrierOptions?.length
      ? wired.carrierOptions
      : CARRIERS.map((c) => ({ label: c, value: c }))
  const carrierValue = wired?.carrierId ?? carrierOptions[0]?.value ?? 'Verizon'
  const ringOptions = wired?.ringOptions ?? RING
  const ringValue = wired?.ringSeconds ?? '20'
  const instructionsEnabled = wired?.forwardingInstructionsEnabled ?? !live
  const verifyEnabled = wired?.forwardingVerifyEnabled ?? !live
  const steps = live && instructionsEnabled ? (wired?.instructionSteps ?? []) : []
  const dialCode =
    live && instructionsEnabled ? (wired?.dialCode ?? '—') : live ? '—' : '—'
  const instructionsPending =
    live && !instructionsEnabled
      ? wired?.forwardingInstructionsPendingMessage ??
        'Add your business line and wait for your Transovo forwarding number before changing carrier forwarding.'
      : null
  const verificationTone = wired?.verificationPillTone ?? 'warning'
  const verificationLabel = wired?.verificationPillLabel ?? (live ? 'Not verified' : 'Verified')
  const senderOptions = wired?.senderOptions ?? []

  const { activeSender, inventorySenders } = useMemo(() => {
    const active = senderOptions.find((o) => o.active) ?? senderOptions[0]
    const rest = senderOptions.filter((o) => o !== active)
    return { activeSender: active, inventorySenders: rest }
  }, [senderOptions])

  const hiddenInventoryCount = Math.max(0, inventorySenders.length - INVENTORY_PREVIEW)
  const visibleInventory = inventoryExpanded
    ? inventorySenders
    : inventorySenders.slice(0, INVENTORY_PREVIEW)

  return (
    <div className="flex flex-col gap-8">
      <div className={cn(OPUS_CONFIG_INSET, 'grid gap-4 p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6 sm:p-5')}>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Business line</p>
          {live && wired?.onBusinessLineChange ? (
            <>
              <Input
                type="tel"
                value={wired.businessLineInput ?? ''}
                onChange={(e) => wired.onBusinessLineChange?.(e.target.value)}
                aria-label="Business line phone number"
                className="mt-1 font-mono text-lg font-semibold"
                autoComplete="tel"
              />
              {wired.businessLineError ? (
                <p className="mt-1 text-sm text-destructive" role="alert">{wired.businessLineError}</p>
              ) : null}
            </>
          ) : (
            <p className="mt-1 font-mono text-lg font-semibold">{businessLine}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{wired?.businessLineMeta ?? 'Customers call this number'}</p>
        </div>
        <div className="flex flex-col items-center gap-1 text-muted-foreground sm:px-2">
          <ArrowDown className="size-4" aria-hidden="true" />
          <span className="text-center text-[11px] font-medium">If unanswered</span>
        </div>
        <div className="min-w-0 sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Transovo forwarding</p>
          <p className="mt-1 font-mono text-lg font-semibold">{forwardDest}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 sm:justify-end">
            <Pill tone={verificationTone}>{verificationLabel}</Pill>
            {wired?.callPathHint ? (
              <span className="text-xs text-muted-foreground">{wired.callPathHint}</span>
            ) : null}
          </div>
        </div>
      </div>

      <ConfigSection title="Forwarding setup" description="Carrier timing and conditional forwarding steps.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Carrier" htmlFor="mctb-carrier">
              <SimpleSelect
                id="mctb-carrier"
                label="Carrier"
                className="w-full"
                value={carrierValue}
                options={carrierOptions.map((c) => ({ value: c.value, label: c.label }))}
                onChange={(v) => wired?.onCarrierChange?.(v)}
              />
            </Field>
            <Field label="Ring before forwarding" htmlFor="mctb-ring">
              <SimpleSelect
                id="mctb-ring"
                label="Ring before forwarding"
                className="w-full"
                value={ringValue}
                options={ringOptions.map((r) => ({ value: r, label: `${r} seconds` }))}
                onChange={(v) => wired?.onRingChange?.(v)}
              />
            </Field>
          </div>
          <div className="flex justify-end lg:col-span-2">
            <SaveBar onSave={wired?.onSave} />
          </div>
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {wired?.instructionTitle ?? 'Conditional call forwarding'}
            </p>
            {instructionsPending ? (
              <p className="mt-2 text-sm text-muted-foreground">{instructionsPending}</p>
            ) : (
              <>
                <ol className="mt-3 flex flex-col gap-3 text-sm">
                  {steps.map((step, i) => (
                    <li key={`${i}-${step.slice(0, 24)}`} className="flex gap-3">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-[11px] font-medium ring-1 ring-border">
                        {i + 1}
                      </span>
                      <span className="text-pretty">{step}</span>
                    </li>
                  ))}
                </ol>
                {dialCode !== '—' ? (
                  <p className="mt-4 rounded-lg bg-background px-3 py-2 font-mono text-sm ring-1 ring-border">{dialCode}</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </ConfigSection>

      <ConfigSection
        title="Connection verification"
        description="Evidence that calls reach Transovo when you do not answer."
        insetClassName={cn(
          verificationTone === 'success' ? 'border-success/30 bg-success/5' : 'border-warning/25 bg-warning/5',
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2
              className={cn('mt-0.5 size-5 shrink-0', verificationTone === 'success' ? 'text-success' : 'text-warning')}
              aria-hidden="true"
            />
            <div className="text-sm">
              <p className="font-medium">{wired?.verificationTitle ?? 'Forwarding not verified'}</p>
              <p className="text-muted-foreground">
                {wired?.verificationDetail ?? 'Call your business line from another phone and let it ring unanswered.'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={live && !verifyEnabled}
            onClick={() => void wired?.onVerifyAgain?.()}
          >
            Verify again
          </Button>
        </div>
        {live && !verifyEnabled ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Verification unlocks once your Transovo forwarding number is ready and your business line is saved.
          </p>
        ) : null}
      </ConfigSection>

      <ConfigSection
        title="Text-back sender"
        description="Recovery texts send from the active sender. Other numbers remain available to switch."
      >
        {activeSender ? (
          <div className={cn(OPUS_CARD, 'border-primary/40 bg-primary/5 p-4')}>
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <PhoneForwarded className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{activeSender.title}</p>
                  <Pill tone="success">Active</Pill>
                  {activeSender.statusLabel ? <Pill tone="neutral">{activeSender.statusLabel}</Pill> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{activeSender.description}</p>
                {wired?.senderDetail ? (
                  <p className="mt-1 text-xs text-muted-foreground">{wired.senderDetail}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{wired?.senderHeadline ?? 'No sender selected'}</p>
        )}

        {wired?.ownSenderLockedHint ? (
          <p className="mt-3 text-xs text-muted-foreground">{wired.ownSenderLockedHint}</p>
        ) : null}
        {wired?.ownSenderLifecycleSteps?.length ? (
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
            {wired.ownSenderLifecycleSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {wired?.onManageNumbers ? (
            <Button type="button" size="sm" variant="outline" onClick={wired.onManageNumbers}>
              Manage messaging numbers
            </Button>
          ) : null}
          {wired?.onAddNumber ? (
            <Button type="button" size="sm" variant="outline" onClick={wired.onAddNumber}>
              Add toll-free or local number
            </Button>
          ) : null}
          {wired?.ownSenderRegistrationHref ? (
            <ButtonLink href={wired.ownSenderRegistrationHref} size="sm" variant="outline">
              Messaging registration
            </ButtonLink>
          ) : null}
        </div>

        {inventorySenders.length > 0 ? (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Available business senders
            </p>
            <div
              role="radiogroup"
              aria-label="Available text-back senders"
              className="mt-2 overflow-hidden rounded-lg border bg-background/80"
            >
              {visibleInventory.map((opt) => {
                const locked = !opt.selectable && opt.id !== 'platform'
                return (
                  <SenderOptionRow
                    key={String(opt.id)}
                    opt={opt}
                    locked={locked}
                    onSelect={() => {
                      if (locked) return
                      void wired?.onSelectSender?.(opt.id)
                    }}
                  />
                )
              })}
            </div>
            {hiddenInventoryCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 gap-1 text-muted-foreground"
                onClick={() => setInventoryExpanded((v) => !v)}
              >
                {inventoryExpanded ? (
                  <>
                    <ChevronUp className="size-4" aria-hidden="true" />
                    Show fewer
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4" aria-hidden="true" />
                    View {hiddenInventoryCount} more number{hiddenInventoryCount === 1 ? '' : 's'}
                  </>
                )}
              </Button>
            ) : null}
          </div>
        ) : null}

        {wired?.senderRegistrationLabel ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Registration:{' '}
            <Pill tone={wired.senderRegistrationTone ?? 'neutral'}>{wired.senderRegistrationLabel}</Pill>
          </p>
        ) : null}
      </ConfigSection>
    </div>
  )
}
