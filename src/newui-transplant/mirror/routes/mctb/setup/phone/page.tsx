import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Panel, Pill } from '@/newui-transplant/components/app/kit'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { Button } from '@/newui-transplant/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/newui-transplant/components/ui/select'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'
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
}

const CARRIERS = ['Verizon', 'AT&T', 'T-Mobile', 'Comcast Business', 'RingCentral', 'Other']
const RING = ['10', '15', '20', '25', '30']

export function TransplantMctbSetupPhonePage({ wired }: { wired?: MctbSetupPhoneWired }) {
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
  const steps = live ? (wired?.instructionSteps ?? []) : []
  const dialCode = wired?.dialCode ?? (live ? '—' : '—')
  const verificationTone = wired?.verificationPillTone ?? 'warning'
  const verificationLabel = wired?.verificationPillLabel ?? (live ? 'Not verified' : 'Verified')
  const senderOptions = wired?.senderOptions ?? []

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Your business line" description="The public number customers call">
        <p className="font-mono text-lg font-semibold">{businessLine}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {wired?.businessLineMeta ?? 'Customers call this number'}
        </p>
        {wired?.callPathHint ? (
          <p className="mt-3 text-xs text-muted-foreground">
            If you don&apos;t answer → forward to your Transovo forwarding number below.
          </p>
        ) : null}
      </Panel>
      <Panel
        title="Your Transovo forwarding number"
        description={wired?.forwardingMeta ?? 'Forward unanswered calls here'}
      >
        <p className="font-mono text-lg font-semibold">{forwardDest}</p>
        {wired?.callPathHint ? (
          <p className="mt-1 font-mono text-xs text-muted-foreground">{wired.callPathHint}</p>
        ) : null}
      </Panel>

      <Panel title="Carrier & ring timing">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <span className="text-sm font-medium" id="carrier-label">Carrier</span>
            <Select
              value={carrierValue}
              onValueChange={(v) => wired?.onCarrierChange?.(v)}
              items={carrierOptions.map((c) => ({ label: c.label, value: c.value }))}
            >
              <SelectTrigger aria-labelledby="carrier-label" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {carrierOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium" id="ring-label">Ring before forwarding</span>
            <Select
              value={ringValue}
              onValueChange={(v) => wired?.onRingChange?.(v)}
              items={ringOptions.map((r) => ({ label: `${r} seconds`, value: r }))}
            >
              <SelectTrigger aria-labelledby="ring-label" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ringOptions.map((r) => <SelectItem key={r} value={r}>{r} seconds</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex justify-end"><SaveBar onSave={wired?.onSave} /></div>
      </Panel>

      <Panel title="Forwarding instructions" description={wired?.instructionTitle ?? 'Conditional call forwarding'}>
        <ol className="flex flex-col gap-3 text-sm">
          {steps.map((step, i) => (
            <li key={`${i}-${step.slice(0, 24)}`} className="flex gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium">{i + 1}</span>
              <span className="text-pretty">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-md bg-muted px-3 py-2 font-mono text-sm">{dialCode}</p>
      </Panel>

      <Panel title="Verification" action={<Pill tone={verificationTone}>{verificationLabel}</Pill>}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 text-success" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-medium">{wired?.verificationTitle ?? 'Forwarding not verified'}</p>
            <p className="text-muted-foreground">
              {wired?.verificationDetail ?? 'Run a test call from another phone and let it ring unanswered.'}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => void wired?.onVerifyAgain?.()}
        >
          I&apos;ve turned it on — verify again
        </Button>
      </Panel>

      <Panel
        title="Text-back sender"
        description="Recovery texts are sent using the active sender below"
      >
        <p className="text-sm font-medium">{wired?.senderHeadline ?? (live ? '—' : 'Transovo Platform')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{wired?.senderDetail}</p>
        {wired?.ownSenderLockedHint ? (
          <p className="mt-2 text-xs text-muted-foreground">{wired.ownSenderLockedHint}</p>
        ) : null}
        {wired?.ownSenderLifecycleSteps?.length ? (
          <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
            {wired.ownSenderLifecycleSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
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
        <div role="radiogroup" aria-label="Text-back sender" className="mt-4 grid gap-2">
          {senderOptions.map((opt) => {
            const locked = !opt.selectable && opt.id !== 'platform'
            return (
              <button
                key={String(opt.id)}
                type="button"
                role="radio"
                aria-checked={opt.active}
                disabled={locked}
                onClick={() => {
                  if (locked) return
                  void wired?.onSelectSender?.(opt.id)
                }}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 text-left transition',
                  opt.active ? 'border-primary bg-accent/50 ring-1 ring-primary' : 'hover:bg-muted/50',
                  locked && 'cursor-not-allowed opacity-70',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                    opt.active && 'border-primary',
                  )}
                >
                  {opt.active ? <span className="size-2 rounded-full bg-primary" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{opt.title}</span>
                    {opt.statusLabel ? <Pill tone={opt.active ? 'success' : 'neutral'}>{opt.statusLabel}</Pill> : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{opt.description}</span>
                </span>
              </button>
            )
          })}
        </div>
        {wired?.senderRegistrationLabel ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Registration:{' '}
            <Pill tone={wired.senderRegistrationTone ?? 'neutral'}>{wired.senderRegistrationLabel}</Pill>
          </p>
        ) : null}
      </Panel>
    </div>
  )
}
