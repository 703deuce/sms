'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { PageHeader, Panel } from '@/components/app/page-primitives'
import Link from 'next/link'

async function saveDraft(step: number, draftJson: unknown) {
  const res = await fetch('/api/phone/forwarding/setup', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step, draftJson }),
  })
  if (!res.ok) throw new Error('Could not save progress')
}

export function ForwardingOnboarding() {
  const [step, setStep] = useState(1)
  const [phoneChoice, setPhoneChoice] = useState<'new' | 'port' | 'forward'>('forward')
  const [forwardPhone, setForwardPhone] = useState('')
  const [destPhone, setDestPhone] = useState('')
  const [behavior, setBehavior] = useState<'forward' | 'greeting' | 'menu'>('forward')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [done, setDone] = useState(false)

  const progress = (step / 4) * 100

  const next = () => {
    void saveDraft(step, { phoneChoice, forwardPhone, destPhone, behavior })
      .then(() => setStep((s) => Math.min(4, s + 1)))
      .catch(() => toast.error('Could not save draft'))
  }

  const activate = () => {
    if (!phoneNumberId) {
      toast.error('Select or provision a business number first from Numbers.')
      return
    }
    void fetch('/api/phone/forwarding/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumberId,
        destinations: [{ name: 'Primary', phoneE164: destPhone, press1Required: true }],
        incomingBehavior: behavior,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Activation failed')
        setDone(true)
        toast.success('Call forwarding activated')
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Activation failed'))
  }

  if (done) {
    return (
      <Panel title="You're set up" description="Call your business line to verify routing.">
        <Button type="button" asChild>
          <Link href="/app/phone/forwarding">Go to Call Forwarding</Link>
        </Button>
      </Panel>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Set up your business line"
        description="Get your calls ringing on the phones you already use."
      />
      <Progress value={progress} aria-label="Setup progress" />
      <p className="text-sm text-muted-foreground">Step {step} of 4</p>

      {step === 1 && (
        <Panel title="Phone number">
          <div className="flex flex-col gap-3">
            {(
              [
                ['new', 'Get a new number', 'Search and buy a Transovo number.'],
                ['port', 'Transfer my number', 'Start port-in from your current carrier.'],
                ['forward', 'Keep my carrier', 'Forward calls to a Transovo ingress number.'],
              ] as const
            ).map(([key, title, desc]) => (
              <button
                key={key}
                type="button"
                className={`rounded-lg border p-4 text-left ${phoneChoice === key ? 'border-primary ring-1 ring-primary' : ''}`}
                onClick={() => setPhoneChoice(key)}
              >
                <div className="font-medium">{title}</div>
                <div className="text-sm text-muted-foreground">{desc}</div>
              </button>
            ))}
            {phoneChoice === 'new' && (
              <Button type="button" variant="outline" asChild>
                <Link href="/app/numbers">Open number search</Link>
              </Button>
            )}
            {phoneChoice === 'port' && (
              <Button type="button" variant="outline" asChild>
                <Link href="/app/numbers">Start port request</Link>
              </Button>
            )}
          </div>
        </Panel>
      )}

      {step === 2 && (
        <Panel title="Where should your business calls ring?">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dest">Forward to</Label>
            <Input
              id="dest"
              value={destPhone}
              onChange={(e) => setDestPhone(e.target.value)}
              placeholder="+1…"
              className="font-mono"
            />
          </div>
        </Panel>
      )}

      {step === 3 && (
        <Panel title="Incoming call behavior">
          {(
            [
              ['forward', 'Forward immediately'],
              ['greeting', 'Play greeting, then forward'],
              ['menu', 'Play a phone menu'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`mb-2 w-full rounded-lg border p-3 text-left ${behavior === key ? 'border-primary' : ''}`}
              onClick={() => setBehavior(key)}
            >
              {label}
            </button>
          ))}
        </Panel>
      )}

      {step === 4 && (
        <Panel title="Review and activate">
          <div className="flex flex-col gap-2 text-sm">
            <Label htmlFor="pn-id">Phone number ID (from Numbers)</Label>
            <Input
              id="pn-id"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="Paste active phone number record ID"
              className="font-mono text-xs"
            />
            <p className="text-muted-foreground">
              Destination: {destPhone || '—'} · Behavior: {behavior}
            </p>
          </div>
        </Panel>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="outline" disabled={step <= 1} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < 4 ? (
          <Button type="button" onClick={next}>Continue</Button>
        ) : (
          <Button type="button" onClick={activate}>Activate call forwarding</Button>
        )}
      </div>
    </div>
  )
}
