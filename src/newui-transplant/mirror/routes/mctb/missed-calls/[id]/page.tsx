import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Check, ChevronDown, MessageSquare, Phone } from 'lucide-react'
import { Page, PageHeader, Panel, Pill, Rows } from '@/newui-transplant/components/app/kit'
import { OPUS_CARD } from '@/newui-transplant/components/app/opus-surfaces'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { RecoveryPill } from '@/newui-transplant/components/app/status'
import { BUSINESS, CONVERSATIONS, MISSED_CALLS } from '@/newui-transplant/lib/sandbox-data'
import { cn } from '@/lib/utils'

export async function TransplantMctbMissedCallsIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const call = MISSED_CALLS.find((m) => m.id === id)
  if (!call) notFound()
  const convo = CONVERSATIONS.find((c) => c.id === call.conversationId)

  const replied = call.recovery === 'Replied' || call.recovery === 'Needs attention'
  const sent = replied || call.recovery === 'Sent'
  const steps = [
    { label: 'Call missed', detail: `${call.trigger} · ${call.missed}`, done: true },
    { label: 'Consent', detail: call.recovery === 'Waiting for consent' ? 'Waiting for caller to press 1' : 'Pressed 1', done: call.recovery !== 'Waiting for consent' && call.recovery !== 'Suppressed' },
    { label: 'Compliance text', detail: 'STOP disclosure delivered', done: sent },
    { label: 'Recovery text', detail: sent ? 'Delivered' : 'Not sent', done: sent },
    { label: 'Reply', detail: call.reply ? 'Customer replied' : 'No reply yet', done: replied },
  ]

  return (
    <Page>
      <Link href="/mctb/missed-calls" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Missed calls
      </Link>
      <PageHeader
        title={call.caller}
        status={<RecoveryPill status={call.recovery} />}
        meta={<span className="font-mono">{call.phone} · {call.line} · {call.missed}</span>}
        actions={
          <>
            <ButtonLink href={`tel:${call.phone}`} variant="outline">
              <Phone /> Call customer
            </ButtonLink>
            {convo ? (
              <ButtonLink href={`/mctb/conversations?conversation=${convo.id}`}>
                <MessageSquare /> Reply now
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <Panel title="Recovery lifecycle" className="mb-4">
        <ol className="grid gap-4 sm:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-start gap-3 sm:flex-col sm:gap-2">
              <div className="flex items-center gap-2 sm:w-full">
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                    s.done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {s.done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                </span>
                {i < steps.length - 1 ? (
                  <span className={cn('hidden h-px flex-1 sm:block', s.done ? 'bg-primary/40' : 'bg-border')} />
                ) : null}
              </div>
              <div>
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel
            title="Conversation"
            action={convo ? <Link href={`/mctb/conversations?conversation=${convo.id}`} className="text-xs font-medium text-primary hover:underline">Open conversation</Link> : null}
          >
            {convo ? (
              <ul className="flex flex-col gap-2">
                {convo.messages.filter((m) => m.from !== 'system').map((m, i) => (
                  <li key={i} className={cn('flex', m.from === 'customer' ? 'justify-start' : 'justify-end')}>
                    <span
                      className={cn(
                        'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm',
                        m.from === 'customer' ? 'bg-muted' : 'bg-primary text-primary-foreground',
                      )}
                    >
                      {m.text}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No conversation has started with this caller.</p>
            )}
          </Panel>
          <Panel title="Text-back">
            <Rows
              items={[
                { label: 'Sender', value: <span className="font-mono text-xs">{BUSINESS.sender}</span> },
                { label: 'Template', value: 'Default opener' },
                { label: 'Delay', value: '30 seconds' },
                { label: 'Delivery', value: sent ? <Pill tone="success">Delivered</Pill> : <Pill>Not sent</Pill> },
              ]}
            />
          </Panel>
          <Panel title="Link activity">
            <p className="text-sm text-muted-foreground">
              {sent ? 'Booking link sent · not clicked yet' : 'No links sent.'}
            </p>
          </Panel>
          <Panel title="Request form">
            <p className="text-sm text-muted-foreground">No request form submitted.</p>
          </Panel>
        </div>
        <div className="flex flex-col gap-4">
          <Panel title="Call details">
            <Rows
              items={[
                { label: 'Trigger', value: call.trigger },
                { label: 'Business line', value: call.line },
                { label: 'Ring time', value: '22s' },
                { label: 'Caller type', value: 'Mobile' },
              ]}
            />
          </Panel>
          <Panel title="Consent">
            <Rows
              items={[
                { label: 'Mode', value: 'Press 1' },
                { label: 'Status', value: call.recovery === 'Waiting for consent' ? <Pill tone="warning">Pending</Pill> : <Pill tone="success">Granted</Pill> },
              ]}
            />
          </Panel>
          {call.trigger === 'Voicemail' ? (
            <Panel title="Voicemail">
              <audio controls preload="none" className="w-full" aria-label="Voicemail recording" />
              <Link href="/mctb/voicemail" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Open in Voicemail</Link>
            </Panel>
          ) : null}
          <details className={`group ${OPUS_CARD}`}>
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold">
              Diagnostics
              <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <pre className="overflow-x-auto border-t bg-muted/40 px-5 py-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
{`call_sid: CA8f2…${call.id}
sip_code: 480
carrier: Verizon Wireless
forwarded_from: ${BUSINESS.line}
eligible: ${call.recovery !== 'Suppressed'}`}
            </pre>
          </details>
        </div>
      </div>
    </Page>
  )
}
