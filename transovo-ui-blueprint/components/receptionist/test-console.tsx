'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Bot, CalendarCheck, Loader2, PhoneCall, PhoneOff, Play, RotateCcw, Send, UserRound, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { useAgent } from '@/components/providers/agent-provider'
import { renderGreeting } from '@/lib/agent'
import { cn } from '@/lib/utils'
import { Pills } from './ai-ui'

type Line = { who: 'agent' | 'caller' | 'tool'; text: string; ok?: boolean }

const SCENARIOS = {
  book: { label: 'Book a cleaning', script: ['Hi, I need to book a cleaning.', 'Next Tuesday morning works.', 'The 9:30 please.'] },
  question: { label: 'Insurance question', script: ['Do you take Delta Dental?', 'Great, thanks — that’s all.'] },
  urgent: { label: 'Urgent pain', script: ['My tooth is really swollen and it hurts a lot.', 'Yes please connect me.'] },
  unsupported: { label: 'Unknown question', script: ['Do you offer sedation for anxious patients?', 'Sure, have someone call me back.'] },
} as const
type ScenarioKey = keyof typeof SCENARIOS

function agentReply(key: ScenarioKey, step: number, caps: Record<string, boolean>, name: string): Line[] {
  if (key === 'book') {
    if (!caps.book) return [{ who: 'agent', text: 'I can take your details and have the team call you to book. What’s the best number?' }]
    return [
      [{ who: 'tool', text: 'check_availability · Cleaning · Hygiene team', ok: true }, { who: 'agent', text: 'I have Tuesday at 8:45, 9:30 or 11:15. Which works best?' }],
      [{ who: 'agent', text: 'Perfect. Can I get your full name and confirm the number you’re calling from?' }],
      [{ who: 'tool', text: 'create_appointment · Tue 9:30 AM · 45 min', ok: true }, ...(caps.smsConfirm ? [{ who: 'tool' as const, text: 'send_sms_confirmation · consent on file', ok: true }] : []), { who: 'agent', text: `You’re all set for Tuesday at 9:30. ${caps.smsConfirm ? 'I just texted you a confirmation. ' : ''}Anything else?` }],
    ][step] as Line[]
  }
  if (key === 'question') {
    return [
      [{ who: 'tool', text: 'search_knowledge · “Delta Dental” · 1 match', ok: true }, { who: 'agent', text: 'Yes — we’re in-network with Delta Dental PPO, plus Cigna, MetLife and Aetna. Would you like to book a visit?' }],
      [{ who: 'agent', text: `Thanks for calling. Have a great day! — ${name}` }],
    ][step] as Line[]
  }
  if (key === 'urgent') {
    if (!caps.transfer) return step === 0 ? [{ who: 'agent', text: 'I’m sorry you’re in pain. I’ll flag this as urgent and have the on-call dentist call you right back.' }] : [{ who: 'tool', text: 'create_callback · priority urgent', ok: true }]
    return [
      [{ who: 'agent', text: 'I’m sorry — that sounds urgent. I can connect you to our on-call dentist now. Is that okay?' }],
      [{ who: 'tool', text: 'transfer_call · On-call dentist · cold', ok: true }, { who: 'agent', text: 'Connecting you now. Please hold.' }],
    ][step] as Line[]
  }
  return [
    [{ who: 'tool', text: 'search_knowledge · “sedation” · no match', ok: false }, { who: 'agent', text: 'That’s a great question — I don’t have that detail. Can I have someone from the team call you back today?' }],
    [{ who: 'tool', text: 'create_callback · reason “sedation options”', ok: true }, { who: 'agent', text: 'Done. Expect a call within 4 hours.' }],
  ][step] as Line[]
}

export function TestConsole() {
  const { draft, live } = useAgent()
  const [version, setVersion] = useState<'draft' | 'live'>('draft')
  const [scenario, setScenario] = useState<ScenarioKey>('book')
  const [lines, setLines] = useState<Line[]>([])
  const [step, setStep] = useState(-1)
  const [running, setRunning] = useState(false)
  const [phone, setPhone] = useState('')
  const [calling, setCalling] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const cfg = version === 'draft' ? draft : live

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [lines])

  const start = () => {
    setLines([{ who: 'agent', text: renderGreeting(cfg.identity.greeting, cfg.identity.name) }])
    setStep(0)
  }
  const script = SCENARIOS[scenario].script
  const advance = async () => {
    if (step < 0 || step >= script.length) return
    setRunning(true)
    setLines((l) => [...l, { who: 'caller', text: script[step] }])
    await new Promise((r) => setTimeout(r, 900))
    setLines((l) => [...l, ...agentReply(scenario, step, cfg.capabilities, cfg.identity.name)])
    setStep((s) => s + 1)
    setRunning(false)
  }
  const done = step >= script.length
  const reset = () => { setLines([]); setStep(-1) }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-xl surface">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
          <span className="flex size-8 items-center justify-center rounded-full tile-primary"><Bot className="size-4" /></span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold">{cfg.identity.name} · simulated call</span>
            <span className="text-xs text-muted-foreground">Testing the {version} version · nothing is booked or sent</span>
          </div>
          {step >= 0 && <StatusBadge tone={done ? 'neutral' : 'success'}>{done ? 'Ended' : 'In call'}</StatusBadge>}
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5" aria-live="polite">
          {lines.length === 0 && (
            <div className="m-auto flex max-w-xs flex-col items-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted"><PhoneCall className="size-5 text-muted-foreground" /></span>
              <p className="text-sm text-muted-foreground">Pick a scenario and start a simulated call to hear how {cfg.identity.name} handles it.</p>
              <Button onClick={start}><Play data-icon="inline-start" />Start test call</Button>
            </div>
          )}
          {lines.map((l, i) =>
            l.who === 'tool' ? (
              <div key={i} className="flex items-center gap-2 self-center rounded-full bg-muted px-3 py-1 font-mono text-[11px] text-muted-foreground">
                <Wrench className={cn('size-3', l.ok ? 'text-success' : 'text-destructive')} aria-hidden />
                {l.text}
              </div>
            ) : (
              <div key={i} className={cn('flex max-w-[80%] items-end gap-2', l.who === 'caller' && 'flex-row-reverse self-end')}>
                <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full', l.who === 'agent' ? 'tile-primary' : 'bg-muted')}>
                  {l.who === 'agent' ? <Bot className="size-3" /> : <UserRound className="size-3 text-muted-foreground" />}
                </span>
                <p className={cn('rounded-2xl px-3.5 py-2 text-sm leading-relaxed', l.who === 'agent' ? 'rounded-bl-sm bg-muted' : 'rounded-br-sm bg-primary text-primary-foreground')}>{l.text}</p>
              </div>
            ),
          )}
          {running && <Loader2 className="size-4 animate-spin self-start text-muted-foreground" aria-label="Agent is responding" />}
          <div ref={end} />
        </div>
        {step >= 0 && (
          <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
            <span className="truncate text-xs text-muted-foreground">{done ? 'Call complete.' : `Caller says: “${script[step]}”`}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset}><RotateCcw data-icon="inline-start" />Reset</Button>
              {done ? (
                <Button size="sm" variant="outline" onClick={reset}><PhoneOff data-icon="inline-start" />Close</Button>
              ) : (
                <Button size="sm" disabled={running} onClick={advance}><Send data-icon="inline-start" />Next turn</Button>
              )}
            </div>
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-4">
        <Panel title="Test setup">
          <div className="flex flex-col gap-4">
            <Pills label="Version" value={version} onChange={(v) => { setVersion(v); reset() }} options={[{ value: 'draft', label: 'Draft' }, { value: 'live', label: 'Live' }]} />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Scenario</span>
              <div className="flex flex-col gap-1.5">
                {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => (
                  <button key={k} type="button" onClick={() => { setScenario(k); reset() }} aria-pressed={scenario === k} className={cn('rounded-lg px-3 py-2 text-left text-sm transition-all', scenario === k ? 'bg-accent font-medium text-accent-foreground ring-1 ring-primary/30' : 'text-muted-foreground hover:bg-muted')}>
                    {SCENARIOS[k].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>
        <Panel title="Call my phone">
          <div className="flex flex-col gap-2">
            <Label htmlFor="test-phone" className="text-xs text-muted-foreground">Hear the real voice with your {version} settings.</Label>
            <Input id="test-phone" inputMode="tel" placeholder="+1 312 555 0100" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button
              variant="outline"
              disabled={calling || phone.replace(/\D/g, '').length < 10}
              onClick={async () => { setCalling(true); await new Promise((r) => setTimeout(r, 1500)); setCalling(false); toast.success(`Calling ${phone} from your test line`) }}
            >
              {calling ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <PhoneCall data-icon="inline-start" />}
              Call me
            </Button>
          </div>
        </Panel>
        <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <CalendarCheck className="size-4 shrink-0" aria-hidden />
          Test bookings use a sandbox calendar and are deleted automatically.
        </div>
      </aside>
    </div>
  )
}
