import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CalendarCheck, MessageSquare, Phone, PhoneIncoming, Sparkles } from 'lucide-react'
import { Page, PageHeader, Panel, Pill, Rows } from '@/components/app/kit'
import { ButtonLink } from '@/components/app/button-link'
import { OutcomePill } from '@/components/app/status'
import { VOICE_CALLS } from '@/lib/data'

const TRANSCRIPT = [
  { who: 'AI', text: 'Thanks for calling Northside Plumbing & Heating, this is Ava. How can I help today?' },
  { who: 'Caller', text: "Hi, my water heater is leaking in the garage. There's a puddle forming." },
  { who: 'AI', text: "I'm sorry to hear that. Is the water actively spraying, or is it a slow drip?" },
  { who: 'Caller', text: "Slow drip, but it's getting worse." },
  { who: 'AI', text: 'Understood. I can get a technician out for a diagnostic. I have Friday between 9 and 11 AM — does that work?' },
  { who: 'Caller', text: 'Yes, that works.' },
  { who: 'AI', text: "Great, you're booked. You'll get a text confirmation shortly. Anything else?" },
]

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const call = VOICE_CALLS.find((c) => c.id === id)
  if (!call) notFound()

  return (
    <Page>
      <Link href="/voice/calls" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden="true" /> All calls
      </Link>
      <PageHeader
        title={call.caller}
        status={<OutcomePill outcome={call.outcome} />}
        meta={
          <span className="font-mono">
            {call.phone} · {call.date} {call.time} · {call.duration}
          </span>
        }
        actions={
          <>
            <ButtonLink href="/mctb/conversations" variant="outline">
              <MessageSquare /> Open conversation
            </ButtonLink>
            <ButtonLink href={`tel:${call.phone}`}>
              <Phone /> Call back
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel title="What happened">
            <ol className="relative flex flex-col gap-4 border-l pl-5">
              {[
                { icon: PhoneIncoming, text: 'Inbound call answered by Ava in 0.8s' },
                { icon: Sparkles, text: 'Identified intent: water heater repair' },
                { icon: CalendarCheck, text: 'Booked Friday 9–11 AM on Service team calendar' },
                { icon: MessageSquare, text: 'Confirmation text sent to caller' },
              ].map((step) => (
                <li key={step.text} className="relative text-sm">
                  <span className="absolute -left-[29px] flex size-4 items-center justify-center rounded-full bg-card ring-2 ring-primary/30">
                    <step.icon className="size-2.5 text-primary" aria-hidden="true" />
                  </span>
                  {step.text}
                </li>
              ))}
            </ol>
          </Panel>

          {call.attention ? (
            <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 p-4">
              <AlertTriangle className="mt-0.5 size-4 text-warning" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium">Still needs follow-up</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{call.attention}</p>
              </div>
              <ButtonLink href={`tel:${call.phone}`} size="sm" variant="outline">Mark handled</ButtonLink>
            </div>
          ) : null}

          <Panel title="Summary">
            <p className="text-pretty text-sm leading-relaxed">{call.summary}</p>
          </Panel>

          <Panel title="Recording" description="Stored for 90 days">
            <audio controls preload="none" className="w-full">
              <source src="/recording.mp3" type="audio/mpeg" />
            </audio>
          </Panel>

          <Panel title="Transcript">
            <ul className="flex flex-col gap-3">
              {TRANSCRIPT.map((line, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span
                    className={
                      line.who === 'AI'
                        ? 'w-14 shrink-0 text-xs font-medium text-primary'
                        : 'w-14 shrink-0 text-xs font-medium text-muted-foreground'
                    }
                  >
                    {line.who}
                  </span>
                  <span className="text-pretty leading-relaxed">{line.text}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Information collected">
            <Rows
              items={[
                { label: 'Name', value: call.caller },
                { label: 'Need', value: 'Water heater leak' },
                { label: 'Address', value: '2201 Cedar Ln' },
                { label: 'Urgency', value: <Pill tone="warning">Soon</Pill> },
              ]}
            />
          </Panel>
          <Panel title="Knowledge gaps">
            <p className="text-sm text-muted-foreground">No gaps detected on this call.</p>
          </Panel>
          <Panel title="Call data">
            <Rows
              items={[
                { label: 'Call ID', value: <span className="font-mono text-xs">{call.id}</span> },
                { label: 'Line', value: 'Main line' },
                { label: 'Handler', value: 'AI · Ava' },
                { label: 'Sentiment', value: 'Positive' },
                { label: 'Latency p50', value: '640 ms' },
              ]}
            />
          </Panel>
          <Panel title="Activity feed">
            <ul className="flex flex-col gap-3 text-sm">
              <li><span className="text-muted-foreground">{call.time}</span> · Call started</li>
              <li><span className="text-muted-foreground">+{call.duration}</span> · Call ended</li>
              <li><span className="text-muted-foreground">+1m</span> · Summary generated</li>
              <li><span className="text-muted-foreground">+1m</span> · Email sent to office@</li>
            </ul>
          </Panel>
        </div>
      </div>
    </Page>
  )
}
