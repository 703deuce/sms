'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Building2, CheckCircle2, Globe2, Loader2, MapPin, RefreshCw, Search, AlertTriangle, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Panel, KeyValue, IconTile } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { useNumbers } from '@/components/providers/numbers-provider'
import { PRODUCT_LABEL, PRODUCT_RETURN, type AvailableNumber, type NumberProduct } from '@/lib/numbers'
import { searchNumbers } from '@/lib/numbers-api'
import { formatPhone } from '@/lib/format'
import { Callout, CapabilityChips, ChoiceCard, Field, StepIntro, WizardShell } from './number-ui'
import { cn } from '@/lib/utils'
import { MCTB_UI_ENABLED, numberProductsForUi } from '@/lib/products/mctb-ui'

const STEPS = ['Type', 'Find', 'Review', 'Assign', 'Done']
const DEFAULT_TARGET: Record<NumberProduct, string> = {
  phone: 'Front desk ring group',
  receptionist: 'Ava (AI agent)',
  mctb: 'Missed-call recovery',
  sms: 'Shared SMS inbox',
}

export function BuyWizard() {
  const router = useRouter()
  const params = useSearchParams()
  const product = params.get('product') as NumberProduct | null
  const returnTo = params.get('returnTo') ?? (product ? PRODUCT_RETURN[product]?.href : null)
  const { purchaseOwned, setAssignments } = useNumbers()

  const [step, setStep] = useState(0)
  const [numberType, setNumberType] = useState<'local' | 'toll_free'>('local')
  const [areaCode, setAreaCode] = useState('')
  const [city, setCity] = useState('')
  const [contains, setContains] = useState('')
  const [results, setResults] = useState<AvailableNumber[] | 'error' | null>(null)
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<AvailableNumber | null>(null)
  const [nickname, setNickname] = useState('')
  const [agree, setAgree] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState(false)
  const [assignTo, setAssignTo] = useState<NumberProduct | 'none'>(product ?? 'none')
  const [newId, setNewId] = useState<string | null>(null)

  async function search() {
    setSearching(true)
    setPicked(null)
    setResults(null)
    try {
      const rows = await searchNumbers({ numberType, areaCode, city, contains })
      const mapped: AvailableNumber[] = rows.map((r) => ({
        number: r.e164,
        numberType,
        region: r.region,
        monthly: r.monthly,
        setupFee: r.setupFee,
        capabilities: r.capabilities,
      }))
      setResults(mapped.length ? mapped : 'error')
    } catch {
      setResults('error')
    } finally {
      setSearching(false)
    }
  }

  async function purchase(simulateFail = false) {
    if (!picked) return
    setPurchasing(true)
    setPurchaseError(false)
    if (simulateFail) {
      setPurchasing(false)
      setPurchaseError(true)
      return
    }
    try {
      const defaultNick =
        nickname.trim() ||
        (picked.numberType === 'toll_free' ? 'Toll-free line' : `${picked.region.split(',')[0]} line`)
      const row = await purchaseOwned(picked.number, defaultNick)
      setNewId(row.id)
      setStep(3)
      toast.success('Number purchased', { description: `${formatPhone(picked.number)} is now in your workspace.` })
    } catch {
      setPurchaseError(true)
    } finally {
      setPurchasing(false)
    }
  }

  const mctbBlocked = assignTo === 'mctb' && !!picked && !picked.capabilities.sms

  function applyAssignment() {
    if (!newId || mctbBlocked) return
    if (assignTo !== 'none') {
      setAssignments(newId, [{ id: `as_${Date.now()}`, product: assignTo, target: DEFAULT_TARGET[assignTo], schedule: 'Always', priority: 1, status: 'active' }])
    }
    setStep(4)
  }

  return (
    <WizardShell
      title="Get a new number"
      subtitle={product ? `For ${PRODUCT_LABEL[product]} — you'll return there when done` : 'Buy a number owned and managed by Transovo'}
      steps={STEPS}
      current={step}
      onJump={step < 3 ? setStep : undefined}
      dirty={step > 0 && step < 3}
      closeHref={returnTo ?? '/app/numbers'}
      hideFooter={step >= 3}
      onBack={step > 0 && step < 3 ? () => setStep(step - 1) : undefined}
      onNext={
        step === 0
          ? () => {
              setStep(1)
              if (!results) void search()
            }
          : step === 1
            ? () => setStep(2)
            : step === 2
              ? () => purchase()
              : undefined
      }
      nextLabel={step === 2 ? `Buy for $${picked?.monthly ?? 0}/mo` : 'Continue'}
      nextDisabled={(step === 1 && !picked) || (step === 2 && !agree)}
      nextLoading={purchasing}
      footerNote={picked && step >= 1 ? <span className="tabular-nums">Selected {formatPhone(picked.number)}</span> : null}
    >
      {step === 0 && (
        <section className="flex flex-col gap-4">
          <StepIntro title="What kind of number?" text="Local numbers build trust with nearby callers. Toll-free works nationally and suits campaigns." />
          <div role="radiogroup" aria-label="Number type" className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard selected={numberType === 'local'} onSelect={() => setNumberType('local')} icon={MapPin} title="Local" badge={<StatusBadge tone="info">Recommended</StatusBadge>} description="A city area code. Voice, SMS and MMS. $2/mo." />
            <ChoiceCard selected={numberType === 'toll_free'} onSelect={() => setNumberType('toll_free')} icon={Globe2} title="Toll-free" description="800, 833, 844… Voice now, SMS after verification. $3/mo." />
          </div>
          {product === 'mctb' && <Callout icon={Sparkles}>MCTB texts callers back from this number, so pick one with SMS. Local numbers are ready for SMS fastest.</Callout>}
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <StepIntro title="Find a number" text="Search by area code, city, or digits you'd like the number to contain." />
          <Panel>
            <form
              className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault()
                void search()
              }}
            >
              <Field id="ac" label={numberType === 'toll_free' ? 'Prefix' : 'Area code'}>
                <Input id="ac" inputMode="numeric" placeholder={numberType === 'toll_free' ? '833' : '312'} value={areaCode} onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))} />
              </Field>
              <Field id="city" label="City">
                <Input id="city" placeholder="Chicago, IL" value={city} disabled={numberType === 'toll_free'} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Field id="contains" label="Contains">
                <Input id="contains" inputMode="numeric" placeholder="e.g. 2026" value={contains} onChange={(e) => setContains(e.target.value.replace(/\D/g, '').slice(0, 4))} />
              </Field>
              <Button type="submit" disabled={searching}>
                {searching ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Search data-icon="inline-start" />}
                Search
              </Button>
            </form>
            <p className="mt-3 text-[11px] text-muted-foreground">Demo inventory. Try area code 000 for no results or 999 for a provider error.</p>
          </Panel>

          {searching && (
            <div className="grid gap-2 sm:grid-cols-2" aria-busy>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          )}

          {!searching && results === 'error' && (
            <Callout tone="danger" icon={AlertTriangle} title="Carrier search is unavailable">
              <span className="flex flex-wrap items-center gap-3">
                We could not reach the number provider. Nothing was reserved.
                <Button size="sm" variant="outline" onClick={() => void search()}>
                  <RefreshCw data-icon="inline-start" />
                  Try again
                </Button>
              </span>
            </Callout>
          )}

          {!searching && Array.isArray(results) && results.length === 0 && (
            <Callout tone="warning" icon={AlertTriangle} title="No numbers available">
              Try a nearby area code, remove the &ldquo;contains&rdquo; filter, or switch to toll-free.
            </Callout>
          )}

          {!searching && Array.isArray(results) && results.length > 0 && (
            <div role="radiogroup" aria-label="Available numbers" className="grid gap-2 sm:grid-cols-2">
              {results.map((r) => {
                const sel = picked?.number === r.number
                const noSms = product === 'mctb' && !r.capabilities.sms
                return (
                  <button
                    key={r.number}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    disabled={noSms}
                    onClick={() => setPicked(r)}
                    className={cn(
                      'flex flex-col gap-2 rounded-xl p-4 text-left ring-1 transition-all disabled:opacity-45',
                      sel ? 'bg-accent/60 ring-2 ring-primary' : 'surface-raised ring-foreground/8 hover:ring-foreground/20',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-heading text-base font-semibold tabular-nums">{formatPhone(r.number)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">${r.monthly}/mo</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{r.region}</span>
                      <CapabilityChips caps={r.capabilities} />
                    </span>
                    {noSms && <span className="text-[11px] text-destructive">No SMS — not usable for MCTB</span>}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      {step === 2 && picked && (
        <section className="flex flex-col gap-4">
          <StepIntro title="Review and buy" text="Billed to your workspace. You can release the number at any time." />
          <Panel>
            <div className="flex flex-wrap items-center gap-4">
              <IconTile icon={Building2} tone="primary" />
              <div className="flex flex-col">
                <span className="font-heading text-xl font-semibold tabular-nums">{formatPhone(picked.number)}</span>
                <span className="text-xs text-muted-foreground">
                  {picked.region} · {picked.numberType === 'toll_free' ? 'Toll-free' : 'Local'}
                </span>
              </div>
              <CapabilityChips caps={picked.capabilities} className="ml-auto" />
            </div>
          </Panel>
          <Panel title="Details">
            <div className="flex flex-col gap-4">
              <Field id="nick" label="Nickname (optional)">
                <Input id="nick" maxLength={40} placeholder="e.g. Google Ads line" value={nickname} onChange={(e) => setNickname(e.target.value)} />
              </Field>
              <KeyValue
                items={[
                  { label: 'Monthly', value: <span className="tabular-nums">${picked.monthly.toFixed(2)}</span> },
                  { label: 'Setup fee', value: picked.setupFee ? `$${picked.setupFee}` : 'None' },
                  { label: 'Due today', value: <span className="font-semibold tabular-nums">${(picked.monthly + picked.setupFee).toFixed(2)} (prorated)</span> },
                  { label: 'Provider', value: 'Transovo voice network' },
                ]}
              />
              {picked.numberType === 'toll_free' && (
                <Callout tone="warning" icon={AlertTriangle}>
                  Toll-free SMS requires carrier verification (typically 3–5 business days). Voice works immediately.
                </Callout>
              )}
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={agree} onCheckedChange={(v) => setAgree(Boolean(v))} className="mt-0.5" />
                <span>I authorize a recurring ${picked.monthly}/mo charge and agree to the number terms.</span>
              </label>
            </div>
          </Panel>
          {purchaseError && (
            <Callout tone="danger" icon={AlertTriangle} title="Purchase failed — you were not charged">
              The number was taken by another customer while you reviewed.{' '}
              <button
                className="underline"
                onClick={() => {
                  setStep(1)
                  void search()
                }}
              >
                Pick another number
              </button>
              .
            </Callout>
          )}
          <button type="button" className="self-start text-[11px] text-muted-foreground underline" onClick={() => purchase(true)}>
            Simulate purchase failure
          </button>
        </section>
      )}

      {step === 3 && picked && (
        <section className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 size-6 shrink-0 text-success" aria-hidden />
            <StepIntro title={`${formatPhone(picked.number)} is yours`} text="Link it to a product now, or leave it unassigned and do it later." />
          </div>
          <div role="radiogroup" aria-label="Assign to product" className="grid gap-3 sm:grid-cols-2">
            {([...numberProductsForUi(['phone', 'receptionist', 'mctb']), 'none'] as const).map((p) => {
              const blocked = p === 'mctb' && !picked.capabilities.sms
              return (
                <ChoiceCard
                  key={p}
                  selected={assignTo === p}
                  onSelect={() => setAssignTo(p)}
                  disabled={blocked}
                  title={p === 'none' ? 'Leave unassigned' : PRODUCT_LABEL[p]}
                  badge={product === p ? <StatusBadge tone="info">Requested</StatusBadge> : undefined}
                  description={
                    p === 'phone'
                      ? 'Ring your team or an IVR.'
                      : p === 'receptionist'
                        ? 'Ava answers per your AI call-handling policy.'
                        : p === 'mctb'
                          ? blocked
                            ? 'Needs SMS capability.'
                            : 'Text back callers you miss.'
                          : 'Callers hear an unavailable message until assigned.'
                  }
                />
              )
            })}
          </div>
          <div className="flex justify-end">
            <Button onClick={applyAssignment} disabled={mctbBlocked}>
              Continue
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </section>
      )}

      {step === 4 && picked && (
        <section className="flex flex-col items-center gap-5 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl tile-primary">
            <CheckCircle2 className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">You&apos;re all set</h2>
            <p className="text-sm text-muted-foreground">
              {formatPhone(picked.number)} {assignTo === 'none' ? 'is unassigned.' : `is linked to ${PRODUCT_LABEL[assignTo]}.`}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {returnTo ? (
              <Button onClick={() => router.push(`${returnTo}?selected=${newId}`)}>
                Return to {product ? PRODUCT_RETURN[product].label : 'previous page'}
                <ArrowRight data-icon="inline-end" />
              </Button>
            ) : (
              <Button render={<Link href={`/app/numbers/${newId}`} />}>View number</Button>
            )}
            <Button variant="outline" render={<Link href="/app/numbers" />}>
              All numbers
            </Button>
          </div>
        </section>
      )}
    </WizardShell>
  )
}
