import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BookOpen, CheckCircle2, MessageSquare, Phone, Sparkles } from 'lucide-react'
import { Avatar, Callout, KeyValueRow, Panel, StatusPill } from '@/components/app/primitives'
import { buttonVariants } from '@/components/ui/button'
import { calls, outcomeTone } from '@/lib/data'
import { cn } from '@/lib/utils'

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const call = calls.find((c) => c.id === id)
  if (!call) notFound()

  const transcript = [
    { who: 'Amy', text: 'Thanks for calling Brightline Plumbing & Heating, this is Amy. How can I help today?' },
    { who: call.caller, text: 'Hi, I need someone to take a look at my water heater. It’s making a banging noise.' },
    { who: 'Amy', text: 'I can help with that. Banging usually points to sediment buildup. Can I get the service address?' },
    { who: call.caller, text: '4410 Duval Street.' },
    { who: 'Amy', text: 'Great. I have Thursday at 9:00 AM or 1:30 PM available. Which works better?' },
    { who: call.caller, text: 'Nine works.' },
    { who: 'Amy', text: 'You’re booked for Thursday at 9:00 AM. You’ll get a text confirmation shortly.' },
  ]

  return (
    <>
      <Link href="/voice/calls" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> All calls
      </Link>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={call.caller} className="size-12 text-sm" />
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{call.caller}</h1>
              <StatusPill tone={outcomeTone[call.outcome]}>{call.outcome}</StatusPill>
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              {call.number} · {call.date} at {call.time} · {call.duration}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/mctb/conversations" className={cn(buttonVariants({ variant: 'outline' }), 'h-9')}>
            <MessageSquare aria-hidden="true" /> Open conversation
          </Link>
          <a href={`tel:${call.number}`} className={cn(buttonVariants(), 'h-9')}>
            <Phone aria-hidden="true" /> Call back
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Panel title="What happened">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-pretty">{call.summary}</p>
            </div>
          </Panel>
          {call.attention && (
            <Callout tone="warning" icon={CheckCircle2} title="Still needs follow-up" action={<button type="button" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'bg-card')}>Mark resolved</button>}>
              {call.attention} — assign to a teammate or resolve once handled.
            </Callout>
          )}
          <Panel title="Summary">
            <ul className="flex flex-col gap-2 text-sm">
              <li>Caller reported a banging noise from a 9-year-old gas water heater.</li>
              <li>Receptionist suggested sediment flush and offered two appointment slots.</li>
              <li>Caller confirmed Thursday, 9:00 AM. Confirmation text sent.</li>
            </ul>
          </Panel>
          <Panel title="Recording">
            <audio controls className="w-full" preload="none">
              <track kind="captions" />
            </audio>
          </Panel>
          <Panel title="Transcript" bodyClassName="flex flex-col gap-4">
            {transcript.map((t, i) => (
              <div key={i} className="flex gap-3">
                <span className={cn('w-20 shrink-0 text-xs font-semibold', t.who === 'Amy' ? 'text-primary' : 'text-foreground')}>{t.who}</span>
                <p className="text-sm leading-relaxed">{t.text}</p>
              </div>
            ))}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Information collected" bodyClassName="py-0 divide-y">
            <KeyValueRow label="Name" value={call.caller} />
            <KeyValueRow label="Need" value="Water heater repair" />
            <KeyValueRow label="Address" value="4410 Duval St" />
            <KeyValueRow label="Urgency" value="Normal" tone="neutral" />
            <KeyValueRow label="Appointment" value="Thu, 9:00 AM" tone="success" />
          </Panel>
          {call.attention === 'Knowledge gap' && (
            <Panel title="Knowledge gaps">
              <p className="text-sm text-muted-foreground">“Do you offer financing for tankless water heaters?”</p>
              <Link href="/voice/knowledge#knowledge-gaps" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                <BookOpen className="size-4" aria-hidden="true" /> Add an answer
              </Link>
            </Panel>
          )}
          <Panel title="Call data" bodyClassName="py-0 divide-y">
            <KeyValueRow label="Call ID" value={<span className="font-mono text-xs">{call.id}</span>} />
            <KeyValueRow label="Line" value="Main line" />
            <KeyValueRow label="Sentiment" value="Positive" tone="success" />
            <KeyValueRow label="Latency (p50)" value="620 ms" />
          </Panel>
          <Panel title="Activity feed">
            <ol className="relative flex flex-col gap-4 border-l pl-5">
              {[
                ['Call answered by Amy', call.time],
                ['Appointment booked', 'During call'],
                ['Confirmation SMS delivered', '+12s'],
                ['Summary generated', '+30s'],
              ].map(([t, when]) => (
                <li key={t} className="relative">
                  <span className="absolute top-1.5 -left-[25px] size-2 rounded-full bg-primary ring-4 ring-card" aria-hidden="true" />
                  <p className="text-sm font-medium">{t}</p>
                  <p className="text-xs text-muted-foreground">{when}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  )
}
