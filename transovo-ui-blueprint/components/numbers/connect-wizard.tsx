'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Copy,
  Loader2,
  MessageSquareReply,
  PhoneCall,
  PhoneForwarded,
  PhoneMissed,
  PhoneOff,
  ShieldCheck,
  ArrowRight,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Panel, KeyValue } from '@/components/app/page-primitives'
import { SimpleSelect } from '@/components/app/filters'
import { StatusBadge } from '@/components/app/status'
import { useNumbers } from '@/components/providers/numbers-provider'
import { CARRIERS, CARRIER_INSTRUCTIONS, FORWARDING_LABEL, PRODUCT_RETURN, type ForwardingType } from '@/lib/numbers'
import { formatPhone } from '@/lib/format'
import { Callout, ChoiceCard, Field, StepIntro, WizardShell } from './number-ui'
import { cn } from '@/lib/utils'

const STEPS = ['Number', 'Products', 'Forwarding', 'Carrier setup', 'Test']
const FORWARD_DEST = '+13125550199'

function toE164(raw: string) {
  const d = raw.replace(/\D/g, '')
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return null
}

type TestState = 'idle' | 'waiting' | 'passed' | 'failed'

export function ConnectWizard() {
  const router = useRouter()
  const params = useSearchParams()
  const productParam = params.get('product') as 'receptionist' | 'mctb' | null
  const { owned, connections, addConnection } = useNumbers()

  const [step, setStep] = useState(0)
  const [raw, setRaw] = useState('')
  const [label, setLabel] = useState('')
  const [carrier, setCarrier] = useState<string>(CARRIERS[0])
  const [products, setProducts] = useState<('receptionist' | 'mctb')[]>(productParam ? [productParam] : ['receptionist'])
  const [types, setTypes] = useState<ForwardingType[]>(['no_answer', 'busy'])
  const [confirmed, setConfirmed] = useState(false)
  const [test, setTest] = useState<TestState>('idle')
  const [savedId, setSavedId] = useState<string | null>(null)

  const e164 = toE164(raw)
  const ownedMatch = e164 ? owned.find((n) => n.number === e164) : null
  const dupe = e164 ? connections.find((c) => c.number === e164) : null
  const numberError = raw && !e164 ? 'Enter a 10-digit US or Canadian number.' : ownedMatch ? 'You already own this number with Transovo — assign it directly instead.' : dupe ? 'This number is already connected.' : null

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const instructions = CARRIER_INSTRUCTIONS[carrier]
  const allCalls = types.includes('all')

  function save(status: 'verified' | 'not_tested' | 'needs_attention') {
    if (!e164) return
    const id = savedId ?? `ec_${Date.now()}`
    const now = new Date().toISOString()
    addConnection({
      id,
      number: e164,
      label: label.trim() || 'Main business line',
      carrier,
      forwardsTo: FORWARD_DEST,
      products,
      forwardingTypes: types,
      status,
      lastTest: status === 'not_tested' ? null : now,
      tests:
        status === 'not_tested'
          ? []
          : [
              {
                id: `t_${Date.now()}`,
                at: now,
                result: status === 'verified' ? 'passed' : 'failed',
                callerId: status === 'verified' ? '+13125550147' : null,
                calledLine: status === 'verified' ? e164 : null,
                routedTo: status === 'verified' ? (products.includes('receptionist') ? 'Ava (AI agent)' : 'Missed-call recovery') : null,
                note: status === 'verified' ? 'Forwarded call reached Transovo with original caller ID.' : 'No forwarded call arrived within 90 seconds.',
              },
            ],
    })
    setSavedId(id)
    return id
  }

  async function runTest(fail = false) {
    setTest('waiting')
    await new Promise((r) => setTimeout(r, 2200))
    setTest(fail ? 'failed' : 'passed')
  }

  return (
    <WizardShell
      title="Connect a number you keep"
      subtitle="Your carrier keeps the number. Forwarded calls reach Transovo."
      steps={STEPS}
      current={step}
      onJump={test === 'idle' ? setStep : undefined}
      dirty={step > 0 && test !== 'passed'}
      closeHref={productParam ? PRODUCT_RETURN[productParam].href : '/app/numbers?tab=connected'}
      hideFooter={step === 4}
      onBack={step > 0 ? () => setStep(step - 1) : undefined}
      onNext={() => setStep(step + 1)}
      nextLabel={step === 3 ? "I've set up forwarding" : 'Continue'}
      nextDisabled={
        (step === 0 && (!e164 || !!numberError)) || (step === 1 && !products.length) || (step === 2 && !types.length) || (step === 3 && !confirmed)
      }
      footerNote={e164 ? <span className="tabular-nums">{formatPhone(e164)} · {carrier}</span> : null}
    >
      {step === 0 && (
        <section className="flex flex-col gap-4">
          <StepIntro title="Which number do customers call?" text="The number on your website, Google profile and signage. It stays with your current carrier." />
          <Panel>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="num" label="Business number">
                <Input id="num" inputMode="tel" placeholder="(312) 555-0100" value={raw} onChange={(e) => setRaw(e.target.value)} aria-invalid={!!numberError} />
              </Field>
              <Field id="label" label="Label">
                <Input id="label" placeholder="Main business line" maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Field id="carrier" label="Current carrier" hint="Used to show setup steps where we have them.">
                  <SimpleSelect label="Current carrier" value={carrier} onChange={setCarrier} options={CARRIERS.map((c) => ({ value: c, label: c }))} />
                </Field>
              </div>
            </div>
            {numberError && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive" role="alert">
                <AlertTriangle className="size-3" aria-hidden />
                {numberError}
                {ownedMatch && (
                  <Link className="underline" href={`/app/numbers/${ownedMatch.id}`}>
                    Open number
                  </Link>
                )}
              </p>
            )}
          </Panel>
          <Callout icon={Info} title="What connecting can and can't do">
            Forwarded calls can be answered by AI Receptionist and recovered by MCTB. Outbound calls, caller ID and SMS from this number stay with your carrier — port it if you want those in Transovo.
          </Callout>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <StepIntro title="What should happen to forwarded calls?" text="Pick one or both. Each product's own settings decide the details." />
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard selected={products.includes('receptionist')} onSelect={() => setProducts(toggle(products, 'receptionist'))} icon={Bot} title="AI Receptionist answers" description="Ava picks up, answers questions, books and takes messages." />
            <ChoiceCard selected={products.includes('mctb')} onSelect={() => setProducts(toggle(products, 'mctb'))} icon={MessageSquareReply} title="Missed-call text back" description="If nobody answers, we text the caller from your Transovo SMS number." />
          </div>
          {products.includes('mctb') && (
            <Callout tone="warning" icon={AlertTriangle}>
              Texts can&apos;t come from a number you keep with another carrier. MCTB will send from a Transovo number with SMS — you can choose which in MCTB settings.
            </Callout>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-4">
          <StepIntro title="When should your carrier forward?" text="Most businesses forward only unanswered and busy calls so staff still pick up first." />
          <div className="grid gap-3">
            {(
              [
                { v: 'no_answer', icon: PhoneMissed, d: 'After your phones ring without an answer (usually 4–5 rings).' },
                { v: 'busy', icon: PhoneOff, d: 'When the line is in use.' },
                { v: 'all', icon: PhoneForwarded, d: 'Every call goes straight to Transovo. Your desk phones will not ring.' },
              ] as const
            ).map((o) => (
              <ChoiceCard
                key={o.v}
                selected={types.includes(o.v)}
                onSelect={() => setTypes(o.v === 'all' ? (allCalls ? [] : ['all']) : toggle(types.filter((t) => t !== 'all'), o.v))}
                icon={o.icon}
                title={FORWARDING_LABEL[o.v]}
                description={o.d}
                badge={o.v === 'no_answer' ? <StatusBadge tone="info">Common</StatusBadge> : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-4">
          <StepIntro title={`Set up forwarding with ${carrier}`} text="This happens in your carrier's portal or by calling them. We can't change it for you." />
          <Panel title="Forward calls to" icon={PhoneForwarded}>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-4">
              <span className="font-heading text-2xl font-semibold tracking-tight tabular-nums">{formatPhone(FORWARD_DEST)}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(FORWARD_DEST)
                  toast.success('Copied forwarding number')
                }}
              >
                <Copy data-icon="inline-start" />
                Copy
              </Button>
            </div>
            <div className="mt-4">
              <KeyValue
                items={[
                  { label: 'Forward from', value: <span className="tabular-nums">{e164 ? formatPhone(e164) : '—'}</span> },
                  { label: 'Conditions', value: types.map((t) => FORWARDING_LABEL[t]).join(', ') },
                ]}
              />
            </div>
          </Panel>
          {instructions ? (
            <Panel title={`${carrier} steps`}>
              <ol className="flex flex-col gap-3">
                {instructions.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </Panel>
          ) : (
            <Callout icon={Info} title="We don't have documented steps for this carrier">
              Ask {carrier === "Don't know" ? 'your phone provider' : carrier} to set up conditional call forwarding to the number above. Search their help center for &ldquo;call forwarding&rdquo; or contact business support.
            </Callout>
          )}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(Boolean(v))} className="mt-0.5" />
            <span>I&apos;ve saved forwarding with my carrier.</span>
          </label>
          <button
            type="button"
            className="self-start text-xs text-muted-foreground underline"
            onClick={() => {
              save('not_tested')
              toast('Saved without testing', { description: 'Run a test from the connection page when ready.' })
              router.push('/app/numbers?tab=connected')
            }}
          >
            Save and test later
          </button>
        </section>
      )}

      {step === 4 && (
        <section className="flex flex-col gap-5">
          <StepIntro title="Run a test call" text="Call your business number from a different phone and let it go unanswered so forwarding kicks in." />
          <Panel>
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <span
                className={cn(
                  'relative flex size-16 items-center justify-center rounded-2xl',
                  test === 'passed' ? 'bg-success/12 text-success' : test === 'failed' ? 'bg-destructive/8 text-destructive' : 'tile-primary',
                )}
              >
                {test === 'waiting' && <span aria-hidden className="absolute inset-0 animate-ping rounded-2xl bg-primary/25" />}
                {test === 'passed' ? <CheckCircle2 className="size-7" /> : test === 'failed' ? <AlertTriangle className="size-7" /> : <PhoneCall className="size-7" />}
              </span>
              <div className="flex flex-col gap-1" aria-live="polite">
                <p className="font-heading text-lg font-semibold">
                  {test === 'idle' && `Call ${e164 ? formatPhone(e164) : 'your number'} now`}
                  {test === 'waiting' && 'Listening for a forwarded call…'}
                  {test === 'passed' && 'Forwarding works'}
                  {test === 'failed' && 'No forwarded call arrived'}
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {test === 'idle' && 'Start listening, then place the call. We wait up to 90 seconds.'}
                  {test === 'waiting' && 'Keep the call ringing until it forwards.'}
                  {test === 'passed' && 'A forwarded call reached Transovo with the original caller ID.'}
                  {test === 'failed' && 'Check the forwarding destination and conditions with your carrier, then try again.'}
                </p>
              </div>
              {test === 'passed' && (
                <div className="w-full max-w-sm text-left">
                  <KeyValue
                    items={[
                      { label: 'Caller ID seen', value: <span className="tabular-nums">(312) 555-0147</span> },
                      { label: 'Called line', value: <span className="tabular-nums">{e164 ? formatPhone(e164) : ''}</span> },
                      { label: 'Routed to', value: products.includes('receptionist') ? 'Ava (AI agent)' : 'Missed-call recovery' },
                    ]}
                  />
                </div>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                {(test === 'idle' || test === 'failed') && (
                  <Button onClick={() => runTest()}>
                    <PhoneCall data-icon="inline-start" />
                    {test === 'failed' ? 'Try again' : 'Start listening'}
                  </Button>
                )}
                {test === 'waiting' && (
                  <Button disabled>
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                    Waiting
                  </Button>
                )}
                {test === 'passed' && (
                  <Button
                    onClick={() => {
                      const id = save('verified')
                      toast.success('Line connected and verified')
                      router.push(productParam ? `${PRODUCT_RETURN[productParam].href}?selected=${id}` : `/app/numbers/connections/${id}`)
                    }}
                  >
                    <ShieldCheck data-icon="inline-start" />
                    Finish
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                )}
                {test === 'failed' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const id = save('needs_attention')
                      router.push(`/app/numbers/connections/${id}`)
                    }}
                  >
                    Save and fix later
                  </Button>
                )}
              </div>
              {test === 'idle' && (
                <button type="button" className="text-[11px] text-muted-foreground underline" onClick={() => runTest(true)}>
                  Simulate a failed test
                </button>
              )}
            </div>
          </Panel>
        </section>
      )}
    </WizardShell>
  )
}
