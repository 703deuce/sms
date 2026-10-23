import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, Bot, MessageSquareReply, PhoneIncoming, Voicemail, Wrench } from 'lucide-react'
import { KeyValue, Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { AI_OUTCOME, CALL_OUTCOME, MCTB_STATE, StatusBadge } from '@/components/app/status'
import { type Call } from '@/lib/data'
import { formatDuration, formatFull, formatPhone, formatWhen, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CallActions, CallNotes } from './call-actions'
import { CallRecordingPlayer } from './call-recording-player'

export function CallDetail({ call, from }: { call: Call; from: { label: string; href: string } }) {
  const contact = call.contactSummary
  const line = call.lineSummary
  const outcome = CALL_OUTCOME[call.outcome]

  const timeline: { icon: React.ComponentType<{ className?: string }>; title: string; detail: string; tone?: string }[] = [
    {
      icon: call.direction === 'outbound' ? ArrowUpRight : PhoneIncoming,
      title: call.direction === 'outbound' ? `Outbound call from ${line?.label ?? 'Business line'}` : `Inbound call to ${line?.label ?? 'Business line'}`,
      detail: line?.e164 ? formatPhone(line.e164) : formatPhone(call.callerNumber),
    },
    { icon: ArrowDownLeft, title: `Routed: ${call.routedTo}`, detail: call.user ? `Answered by ${call.user}` : 'Routing policy applied' },
  ]
  if (call.voicemail) timeline.push({ icon: Voicemail, title: 'Voicemail left', detail: `${formatDuration(call.voicemail.durationSec)} · transcribed` })
  if (call.ai) timeline.push({ icon: Bot, title: `AI Receptionist: ${AI_OUTCOME[call.ai.outcome].label}`, detail: call.ai.intent, tone: 'text-primary' })
  if (call.mctb)
    timeline.push({
      icon: MessageSquareReply,
      title: `Missed Call Text Back: ${MCTB_STATE[call.mctb.state].label}`,
      detail: call.mctb.suppressionReason ?? `Message ${call.mctb.messageStatus}`,
      tone: 'text-primary',
    })

  return (
    <Page>
      <PageHeader
        breadcrumbs={[{ label: from.label, href: from.href }, { label: call.caller }]}
        eyebrow={
          <>
            <StatusBadge tone={outcome.tone}>{outcome.label}</StatusBadge>
            {call.ai && <StatusBadge tone={AI_OUTCOME[call.ai.outcome].tone}>{AI_OUTCOME[call.ai.outcome].label}</StatusBadge>}
            {call.mctb && <StatusBadge tone={MCTB_STATE[call.mctb.state].tone}>{MCTB_STATE[call.mctb.state].label}</StatusBadge>}
            {call.metadata?.crmSync && typeof call.metadata.crmSync === 'object' && (
              <StatusBadge
                tone={
                  (call.metadata.crmSync as { status?: string }).status === 'succeeded'
                    ? 'success'
                    : (call.metadata.crmSync as { status?: string }).status === 'failed'
                      ? 'danger'
                      : 'muted'
                }
              >
                CRM {(call.metadata.crmSync as { status?: string }).status || 'none'}
              </StatusBadge>
            )}
          </>
        }
        title={call.caller}
        description={
          <span className="font-mono">
            {formatPhone(call.callerNumber)} · {formatFull(call.startedAt)} · {formatDuration(call.durationSec)}
            {call.callSource && (
              <>
                {' '}
                · Source: {call.callSource.label}
                {call.callSource.campaignId && (
                  <>
                    {' '}
                    ·{' '}
                    <Link href={`/app/power-dialer/campaigns/${call.callSource.campaignId}`} className="text-primary hover:underline">
                      Campaign
                    </Link>
                  </>
                )}
                {call.callSource.listId && (
                  <>
                    {' '}
                    ·{' '}
                    <Link href={`/app/power-dialer/calling-lists/${call.callSource.listId}`} className="text-primary hover:underline">
                      List
                    </Link>
                  </>
                )}
              </>
            )}
          </span>
        }
        actions={<CallActions call={call} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {call.ai && (
            <Panel
              title={call.callSource ? 'Conversation intelligence' : 'AI summary'}
              description={`Intent: ${call.ai.intent}${call.callSource ? ' · Model-derived from transcript' : ''}`}
              actions={<StatusBadge tone={call.ai.followUp === 'open' ? 'warning' : 'muted'}>Follow-up {call.ai.followUp}</StatusBadge>}
            >
              <p className="text-sm leading-relaxed text-pretty">{call.ai.summary}</p>
              {call.ai.tools.length > 0 && (
                <div className="mt-5 flex flex-col gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Wrench className="size-3.5" aria-hidden /> Actions taken
                  </p>
                  <ul className="flex flex-col divide-y rounded-lg border">
                    {call.ai.tools.map((t) => (
                      <li key={t.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="font-mono text-xs">{t.name}</span>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-xs text-muted-foreground">{t.detail}</span>
                          <StatusBadge tone={t.status === 'success' ? 'success' : t.status === 'failed' ? 'danger' : 'muted'}>{t.status}</StatusBadge>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          )}

          {call.ai && call.ai.transcript.length > 0 && (
            <Panel title="Transcript" description="Speaker-separated, AI-generated transcript">
              <ol className="flex flex-col gap-4">
                {call.ai.transcript.map((line, i) => (
                  <li key={i} className={cn('flex gap-3', line.speaker === 'caller' && 'flex-row-reverse text-right')}>
                    <span className="w-10 shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground">{line.at}</span>
                    <div
                      className={cn(
                        'max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
                        line.speaker === 'agent' ? 'bg-accent text-accent-foreground' : 'bg-muted',
                      )}
                    >
                      <p className="mb-0.5 text-[11px] font-medium opacity-70">{line.speaker === 'agent' ? 'Ava (AI)' : call.caller}</p>
                      {line.text}
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          {call.voicemail && (
            <Panel title="Voicemail" description={`${formatDuration(call.voicemail.durationSec)} · Transcribed automatically`}>
              <blockquote className="border-l-2 border-warning pl-4 text-sm leading-relaxed text-pretty">{call.voicemail.transcript}</blockquote>
            </Panel>
          )}

          {call.mctb && (
            <Panel
              title="Missed Call Text Back"
              description="Consent, delivery and reply for this missed call"
              actions={
                call.mctb.threadId ? (
                  <Link href={`/app/mctb/conversations?thread=${call.mctb.threadId}`} className="text-xs font-medium text-primary hover:underline">
                    Open conversation
                  </Link>
                ) : undefined
              }
            >
              <KeyValue
                items={[
                  { label: 'Recovery state', value: <StatusBadge tone={MCTB_STATE[call.mctb.state].tone}>{MCTB_STATE[call.mctb.state].label}</StatusBadge> },
                  { label: 'Press-1 consent', value: call.mctb.pressOne.replace('_', ' ') },
                  { label: 'Message', value: call.mctb.template ?? '—' },
                  { label: 'Delivery', value: call.mctb.messageStatus.replace('_', ' ') },
                ]}
              />
              {call.mctb.suppressionReason && (
                <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Why: </span>
                  {call.mctb.suppressionReason}
                </p>
              )}
              {call.mctb.reply && (
                <div className="mt-4 flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">Caller replied</p>
                  <p className="rounded-xl bg-muted px-3.5 py-2.5 text-sm leading-relaxed">{call.mctb.reply}</p>
                </div>
              )}
            </Panel>
          )}

          {!call.ai && !call.voicemail && !call.mctb && (
            <Panel title="Recording">
              {call.recording ? (
                <CallRecordingPlayer callId={call.id} durationSec={call.durationSec} />
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">Recording was not enabled for this call.</p>
              )}
            </Panel>
          )}

          <CallNotes callId={call.id} initial={call.callNotes ?? []} />
        </div>

        <div className="flex flex-col gap-6">
          {contact && (
            <Panel title="Contact">
              <Link href={`/app/contacts/${contact.id}`} className="flex items-center gap-3 rounded-lg hover:bg-muted/60">
                <span className="flex size-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {initials(contact.name)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{contact.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{formatPhone(contact.phone)}</span>
                </span>
              </Link>
              <div className="mt-4">
                <KeyValue
                  items={[
                    { label: 'Owner', value: contact.owner ?? '—' },
                    { label: 'Status', value: contact.status.replace('_', ' ') },
                    {
                      label: 'Last interaction',
                      value: contact.lastInteraction ? formatWhen(contact.lastInteraction) : '—',
                    },
                    { label: 'Company', value: contact.company ?? '—' },
                  ]}
                />
              </div>
            </Panel>
          )}

          <Panel title="Activity" description="Linked events across products">
            <ol className="relative flex flex-col gap-5">
              <span aria-hidden className="absolute top-2 bottom-2 left-[15px] w-px bg-border" />
              {timeline.map((e, i) => (
                <li key={i} className="relative flex gap-3">
                  <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card">
                    <e.icon className={cn('size-4 text-muted-foreground', e.tone)} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5 pt-1">
                    <span className="text-sm font-medium">{e.title}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{e.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Call metadata">
            <KeyValue
              items={[
                { label: 'Call ID', value: <span className="font-mono text-xs">{call.id}</span> },
                { label: 'Direction', value: call.direction },
                { label: 'Line', value: line?.label ?? '—' },
                { label: 'Recording', value: call.recording ? 'Stored' : 'Off' },
              ]}
            />
          </Panel>
        </div>
      </div>
    </Page>
  )
}
