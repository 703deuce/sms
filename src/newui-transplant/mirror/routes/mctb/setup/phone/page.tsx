import { CheckCircle2 } from 'lucide-react'
import { Panel, Pill, Rows } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/newui-transplant/components/ui/select'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'
import { BUSINESS } from '@/newui-transplant/lib/sandbox-data'

export type MctbSetupPhoneWired = {
  businessLine?: string
  businessLineMeta?: string
  forwardingDestination?: string
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
  senderNumber?: string
  senderRegistrationLabel?: string
  senderRegistrationTone?: 'success' | 'warning'
  onCarrierChange?: (carrierId: string) => void
  onRingChange?: (seconds: string) => void
  onSave?: () => Promise<void>
  onVerifyAgain?: () => Promise<void>
}


const CARRIERS = ['Verizon', 'AT&T', 'T-Mobile', 'Comcast Business', 'RingCentral', 'Other']
const RING = ['10', '15', '20', '25', '30']

export function TransplantMctbSetupPhonePage({ wired }: { wired?: MctbSetupPhoneWired }) {
  const live = wired !== undefined
  const businessLine = wired?.businessLine ?? (live ? '—' : BUSINESS.line)
  const forwardDest = wired?.forwardingDestination ?? (live ? '—' : '(512) 555-0188')
  const carrierOptions =
    live && wired?.carrierOptions?.length
      ? wired.carrierOptions
      : CARRIERS.map((c) => ({ label: c, value: c }))
  const carrierValue = wired?.carrierId ?? carrierOptions[0]?.value ?? 'Verizon'
  const ringOptions = wired?.ringOptions ?? RING
  const ringValue = wired?.ringSeconds ?? '20'
  const steps =
    live
      ? (wired?.instructionSteps ?? [])
      : [
          'From your business phone, dial *71 followed by the forwarding number.',
          'Wait for the confirmation tone, then hang up.',
          'Place a test call and let it ring out.',
        ]
  const dialCode = wired?.dialCode ?? (live ? '—' : '*71 512 555 0188')
  const verificationTone = wired?.verificationPillTone ?? (live ? 'warning' : 'success')
  const verificationLabel = wired?.verificationPillLabel ?? (live ? 'Not verified' : 'Verified')
  const senderNum = wired?.senderNumber ?? (live ? '—' : BUSINESS.sender)
  const regLabel = wired?.senderRegistrationLabel ?? (live ? 'Pending' : 'Registered (10DLC)')
  const regTone = wired?.senderRegistrationTone ?? (live ? 'warning' : 'success')

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Business line" description="The public number customers call">
        <p className="font-mono text-lg font-semibold">{businessLine}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {wired?.businessLineMeta ?? 'Main line · Verizon Business'}
        </p>
      </Panel>
      <Panel title="Forwarding destination" description="Unanswered calls forward here">
        <p className="font-mono text-lg font-semibold">{forwardDest}</p>
        <p className="mt-1 text-xs text-muted-foreground">Managed by Relay · do not share publicly</p>
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

      <Panel title="Forwarding instructions" description={wired?.instructionTitle ?? 'Verizon · conditional call forwarding'}>
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
            <p className="font-medium">{wired?.verificationTitle ?? (live ? 'Forwarding not verified' : 'Test call received')}</p>
            <p className="text-muted-foreground">
              {wired?.verificationDetail ??
                (live
                  ? 'Run a test call from another phone and let it ring unanswered.'
                  : 'Sep 24, 4:17 PM from (512) 555-0142 · forwarded after 20s')}
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

      <Panel title="Text-back sender">
        <Rows
          items={[
            { label: 'Sender number', value: <span className="font-mono text-xs">{senderNum}</span> },
            {
              label: 'Registration',
              value: <Pill tone={regTone}>{regLabel}</Pill>,
            },
            ...(live ? [] : [{ label: 'Throughput', value: '75 msg/min' }]),
          ]}
        />
      </Panel>
    </div>
  )
}
