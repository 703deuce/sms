'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, ArrowRightLeft, CalendarClock, FileUp, Info, Lock, Paperclip, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Panel, KeyValue, IconTile } from '@/components/app/page-primitives'
import { SimpleSelect } from '@/components/app/filters'
import { useNumbers } from '@/components/providers/numbers-provider'
import { CARRIERS } from '@/lib/numbers'
import { formatPhone } from '@/lib/format'
import { Callout, Field, StepIntro, WizardShell } from './number-ui'

const STEPS = ['Number', 'Account', 'Documents', 'Review']

function toE164(raw: string) {
  const d = raw.replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return null
}

export function PortWizard() {
  const router = useRouter()
  const params = useSearchParams()
  const { owned, ports, addPort } = useNumbers()
  const prefill = params.get('number')

  const [step, setStep] = useState(0)
  const [raw, setRaw] = useState(prefill ? formatPhone(prefill) : '')
  const [carrier, setCarrier] = useState<string>(CARRIERS[0])
  const [owner, setOwner] = useState('')
  const [account, setAccount] = useState('')
  const [pin, setPin] = useState('')
  const [address, setAddress] = useState('')
  const [docs, setDocs] = useState<{ name: string; size: number }[]>([])
  const [authorize, setAuthorize] = useState(false)
  const [keepService, setKeepService] = useState(false)
  const [signature, setSignature] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const e164 = toE164(raw)
  const alreadyOwned = e164 && owned.some((n) => n.number === e164)
  const activePort = e164 && ports.some((p) => p.number === e164 && p.status !== 'completed' && p.status !== 'rejected')
  const numErr = raw && !e164 ? 'Enter a 10-digit US or Canadian number.' : alreadyOwned ? 'This number is already in Transovo.' : activePort ? 'A port request for this number is already open.' : null
  const accountValid = owner.trim().length > 1 && account.trim().length >= 4 && address.trim().length > 5
  const canSign = authorize && keepService && signature.trim().toLowerCase() === owner.trim().toLowerCase() && signature.trim().length > 1

  async function submit() {
    if (!e164) return
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 1200))
    const id = `pr_${Date.now()}`
    const now = new Date().toISOString()
    addPort({
      id,
      number: e164,
      carrierFrom: carrier,
      requestedAt: now,
      status: 'submitted',
      expectedDate: null,
      reference: `PRT-${Math.floor(10000 + Math.random() * 89999)}`,
      owner: owner.trim(),
      serviceAddress: address.trim(),
      accountMasked: `•••• ${account.trim().slice(-4)}`,
      documents: docs.map((d) => ({ name: d.name, uploadedAt: now })),
      milestones: [
        { label: 'Submitted', at: now, state: 'done' },
        { label: 'Carrier review', at: null, state: 'current' },
        { label: 'Date scheduled', at: null, state: 'upcoming' },
        { label: 'Number moved', at: null, state: 'upcoming' },
      ],
    })
    setSubmitting(false)
    toast.success('Port request submitted', { description: 'We\u2019ll email you as the carrier responds.' })
    router.push(`/app/numbers/ports/${id}`)
  }

  return (
    <WizardShell
      title="Port a number to Transovo"
      subtitle="Move ownership from your current carrier. Usually 5–15 business days."
      steps={STEPS}
      current={step}
      onJump={setStep}
      dirty={!!raw || !!owner}
      closeHref="/app/numbers?tab=porting"
      onBack={step > 0 ? () => setStep(step - 1) : undefined}
      onNext={step < 3 ? () => setStep(step + 1) : submit}
      nextLabel={step === 3 ? 'Sign and submit' : 'Continue'}
      nextDisabled={(step === 0 && (!e164 || !!numErr)) || (step === 1 && !accountValid) || (step === 3 && !canSign)}
      nextLoading={submitting}
      footerNote={e164 ? <span className="tabular-nums">{formatPhone(e164)} from {carrier}</span> : null}
    >
      {step === 0 && (
        <section className="flex flex-col gap-4">
          <StepIntro title="Which number are you moving?" text="Port one number at a time here. For bulk ports, contact support." />
          <Panel>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="pn" label="Number to port">
                <Input id="pn" inputMode="tel" placeholder="(312) 555-0100" value={raw} onChange={(e) => setRaw(e.target.value)} aria-invalid={!!numErr} />
              </Field>
              <Field id="pc" label="Current carrier">
                <SimpleSelect label="Current carrier" value={carrier} onChange={setCarrier} options={CARRIERS.filter((c) => c !== "Don't know").map((c) => ({ value: c, label: c }))} />
              </Field>
            </div>
            {numErr && (
              <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="size-3" aria-hidden />
                {numErr}
              </p>
            )}
          </Panel>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: CalendarClock, t: 'Takes time', d: 'Most ports finish in 5–15 business days. Toll-free can take longer.' },
              { icon: ShieldCheck, t: 'No downtime', d: 'Your carrier keeps service live until the move date.' },
              { icon: Info, t: 'Don\u2019t cancel yet', d: 'Cancelling your current service first can lose the number.' },
            ].map((x) => (
              <div key={x.t} className="flex flex-col gap-2 rounded-xl p-4 surface-raised">
                <IconTile icon={x.icon} size="sm" />
                <p className="text-sm font-medium">{x.t}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{x.d}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <StepIntro title="Account details" text="Must match your current carrier's records exactly — mismatches are the #1 cause of rejected ports." />
          <Panel>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="owner" label="Authorized name on account">
                <Input id="owner" autoComplete="name" value={owner} onChange={(e) => setOwner(e.target.value)} />
              </Field>
              <Field id="acct" label="Account number" hint="On your carrier bill.">
                <Input id="acct" value={account} onChange={(e) => setAccount(e.target.value)} />
              </Field>
              <Field id="pin" label="Port-out PIN (if required)" hint="Some carriers require one. Ask them to generate it.">
                <Input id="pin" type="password" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} />
              </Field>
              <Field id="addr" label="Service address">
                <Input id="addr" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </Field>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3" aria-hidden />
              Encrypted and only shared with the losing carrier to authorize the port.
            </p>
          </Panel>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-4">
          <StepIntro title="Upload a recent bill" text="A bill or customer service record from the last 30 days speeds approval. Optional, but strongly recommended." />
          <label
            htmlFor="bill"
            className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-card/60 p-10 text-center transition-colors hover:border-primary/40 hover:bg-accent/30"
          >
            <span className="flex size-11 items-center justify-center rounded-xl tile-primary">
              <FileUp className="size-5" />
            </span>
            <span className="text-sm font-medium">Click to upload</span>
            <span className="text-xs text-muted-foreground">PDF, PNG or JPG · up to 10 MB</span>
            <input
              id="bill"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                if (f.size > 10 * 1024 * 1024) {
                  toast.error('File is larger than 10 MB')
                  return
                }
                setDocs((d) => [...d, { name: f.name, size: f.size }])
                e.target.value = ''
              }}
            />
          </label>
          {docs.length > 0 && (
            <ul className="flex flex-col gap-2">
              {docs.map((d, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 surface-raised">
                  <Paperclip className="size-4 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm">{d.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{Math.max(1, Math.round(d.size / 1024))} KB</span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${d.name}`} onClick={() => setDocs(docs.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {step === 3 && e164 && (
        <section className="flex flex-col gap-4">
          <StepIntro title="Review and authorize" text="Your signature authorizes Transovo to request the number from your carrier (Letter of Authorization)." />
          <Panel title="Port summary" icon={ArrowRightLeft}>
            <KeyValue
              items={[
                { label: 'Number', value: <span className="tabular-nums">{formatPhone(e164)}</span> },
                { label: 'From', value: carrier },
                { label: 'Account holder', value: owner },
                { label: 'Account', value: `•••• ${account.slice(-4)}` },
                { label: 'Service address', value: address },
                { label: 'Documents', value: docs.length ? `${docs.length} attached` : 'None' },
              ]}
            />
          </Panel>
          {!docs.length && <Callout tone="warning" icon={AlertTriangle}>No bill attached. The carrier may ask for one, which delays the port.</Callout>}
          <Panel title="Authorization">
            <div className="flex flex-col gap-4">
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={authorize} onCheckedChange={(v) => setAuthorize(Boolean(v))} className="mt-0.5" />
                <span>I am authorized to move this number and the details above match my carrier account.</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={keepService} onCheckedChange={(v) => setKeepService(Boolean(v))} className="mt-0.5" />
                <span>I&apos;ll keep my current service active until the port completes.</span>
              </label>
              <Field id="sig" label="Type your full name to sign" hint={owner ? `Must match “${owner}”.` : undefined}>
                <Input id="sig" value={signature} onChange={(e) => setSignature(e.target.value)} className="font-heading text-base italic" />
              </Field>
            </div>
          </Panel>
        </section>
      )}
    </WizardShell>
  )
}
