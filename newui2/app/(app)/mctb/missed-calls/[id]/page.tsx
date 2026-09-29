import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Check, MessageSquare, Phone } from 'lucide-react'
import { Avatar, KeyValueRow, Panel, StatusPill } from '@/components/app/primitives'
import { buttonVariants } from '@/components/ui/button'
import { conversations, missedCalls, recoveryTone, voicemails } from '@/lib/data'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Missed call' }

export default async function MissedCallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const call = missedCalls.find((m) => m.id === id)
  if (!call) notFound()
  const convo = conversations.find((c) => c.missedCallId === call.id)
  const voicemail = call.trigger === 'Voicemail' ? voicemails.find((v) => v.number === call.number) : undefined

  const stepsDone = { Replied: 5, 'Needs reply': 5, Sent: 4, 'Waiting for consent': 2, Suppressed: 1, Failed: 3 }[call.recovery]
  const steps = ['Missed call', 'Consent', 'Compliance text', 'Recovery text', 'Customer reply']

  return (
    <>
      <Link href="/mctb/missed-calls" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> Missed calls
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={call.caller} className="size-12 text-sm" />
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{call.caller}</h1>
              <StatusPill tone={recoveryTone[call.recovery]}>{call.recovery}</StatusPill>
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              {call.number} · {call.missed} · {call.line}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <a href={`tel:${call.number}`} className={cn(buttonVariants({ variant: 'outline' }), 'h-9')}>
            <Phone aria-hidden="true" /> Call customer
          </a>
          {convo && (
            <Link href={`/mctb/conversations?conversation=${convo.id}`} className={cn(buttonVariants(), 'h-9')}>
              <MessageSquare aria-hidden="true" /> Open conversation
            </Link>
          )}
        </div>
      </div>

      <Panel title="Recovery lifecycle">
        <ol className="grid gap-4 sm:grid-cols-5">
          {steps.map((s, i) => {
            const done = i < stepsDone
            const failed = call.recovery === 'Failed' && i === stepsDone
            return (
              <li key={s} className="flex items-center gap-3 sm:flex-col sm:items-start">
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    done ? 'bg-primary text-primary-foreground' : failed ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{s}</span>
                  <span className="text-xs text-muted-foreground">{done ? 'Complete' : failed ? 'Failed' : 'Pending'}</span>
                </div>
              </li>
            )
          })}
        </ol>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {convo ? (
            <Panel title="Conversation" action={<Link href={`/mctb/conversations?conversation=${convo.id}`} className="text-sm font-medium text-primary">Open</Link>}>
              <ul className="flex flex-col gap-3">
                {convo.messages.map((m, i) => (
                  <li key={i} className={cn('flex', m.from === 'customer' ? 'justify-start' : m.from === 'system' ? 'justify-center' : 'justify-end')}>
                    {m.from === 'system' ? (
                      <span className="text-xs text-muted-foreground">{m.text}</span>
                    ) : (
                      <span
                        className={cn(
                          'max-w-md rounded-2xl px-3.5 py-2 text-sm',
                          m.from === 'customer' ? 'bg-muted' : 'bg-primary text-primary-foreground',
                        )}
                      >
                        {m.text}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <Panel title="Conversation">
              <p className="text-sm text-muted-foreground">No conversation yet. A thread will appear once a recovery text is sent.</p>
            </Panel>
          )}

          {voicemail && (
            <Panel title="Voicemail" description={`${voicemail.duration} · ${voicemail.time}`}>
              <p className="text-sm text-pretty">{voicemail.summary}</p>
            </Panel>
          )}

          <details className="rounded-xl border bg-card px-5 py-4 text-sm">
            <summary className="cursor-pointer font-medium">Diagnostics</summary>
            <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-muted-foreground">
              <dt>Call SID</dt>
              <dd>CA{call.id.replace('m_', '')}f3a9e1</dd>
              <dt>Carrier status</dt>
              <dd>{call.trigger.toLowerCase().replace(' ', '-')}</dd>
              <dt>Message segments</dt>
              <dd>2</dd>
            </dl>
          </details>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Call details" bodyClassName="py-0 divide-y">
            <KeyValueRow label="Trigger" value={call.trigger} />
            <KeyValueRow label="Business line" value={call.line} />
            <KeyValueRow label="Ring time" value="22 sec" />
          </Panel>
          <Panel title="Consent" bodyClassName="py-0 divide-y">
            <KeyValueRow label="Mode" value="Press 1" />
            <KeyValueRow
              label="Status"
              value={call.recovery === 'Waiting for consent' ? 'Pending' : call.recovery === 'Suppressed' ? 'Excluded' : 'Granted'}
              tone={call.recovery === 'Waiting for consent' ? 'warning' : call.recovery === 'Suppressed' ? 'neutral' : 'success'}
            />
          </Panel>
          <Panel title="Text back" bodyClassName="py-0 divide-y">
            <KeyValueRow label="Sent" value={stepsDone >= 4 ? 'Yes · 8s after call' : 'No'} />
            <KeyValueRow label="Link clicks" value="1" />
            <KeyValueRow label="Request form" value="Not submitted" />
          </Panel>
        </div>
      </div>
    </>
  )
}
