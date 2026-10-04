'use client'

import Link from 'next/link'
import { ArrowLeft, Check, ChevronDown, MessageSquare, Phone } from 'lucide-react'
import { Page, PageHeader, Panel, Pill, Rows } from '@/newui-transplant/components/app/kit'
import { OPUS_CARD } from '@/newui-transplant/components/app/opus-surfaces'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { RecoveryPill } from '@/newui-transplant/components/app/status'
import { MctbHandoffSummaryPanel } from '@/newui-transplant/components/mctb/mctb-handoff-summary-panel'
import { cn } from '@/lib/utils'
import type { MctbMissedCallDetailWired } from '@/lib/newui-transplant/adapters/mctb-missed-call-detail'

export function TransplantMctbMissedCallDetailView({ wired }: { wired: MctbMissedCallDetailWired }) {
  const convoHref = wired.conversationId
    ? `/mctb/conversations?conversation=${wired.conversationId}`
    : undefined
  const hasThread = wired.messages.length > 0 || Boolean(wired.teamBrief?.hasTextReplies)

  return (
    <Page>
      <Link href="/mctb/missed-calls" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Missed calls
      </Link>
      <PageHeader
        title={wired.caller}
        status={<RecoveryPill status={wired.recovery} />}
        meta={<span className="font-mono">{wired.phone} · {wired.line} · {wired.missed}</span>}
        actions={
          <>
            <ButtonLink href={`tel:${wired.phoneTel}`} variant="outline">
              <Phone /> Call customer
            </ButtonLink>
            {convoHref ? (
              <ButtonLink href={convoHref}>
                <MessageSquare /> Reply now
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {wired.handoff ? (
        <MctbHandoffSummaryPanel handoff={wired.handoff} conversationHref={convoHref} className="mb-4" />
      ) : null}

      <Panel
        title="Conversation"
        className="mb-4"
        action={convoHref ? <Link href={convoHref} className="text-xs font-medium text-primary hover:underline">Open full conversation</Link> : null}
      >
        {wired.messages.length ? (
          <ul className="flex flex-col gap-3">
            {wired.messages.map((m, i) => (
              <li key={i} className={cn('flex flex-col gap-1', m.from === 'customer' ? 'items-start' : 'items-end')}>
                <span className="text-xs font-medium text-muted-foreground">
                  {m.label}
                  {m.time ? ` · ${m.time}` : ''}
                </span>
                <span
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                    m.from === 'customer'
                      ? 'rounded-bl-md border bg-card'
                      : m.from === 'ai'
                        ? 'rounded-br-md bg-sidebar text-sidebar-foreground'
                        : m.from === 'system'
                          ? 'rounded-br-md border border-dashed bg-muted/40 text-muted-foreground'
                          : 'rounded-br-md bg-primary text-primary-foreground',
                  )}
                >
                  {m.text}
                </span>
              </li>
            ))}
          </ul>
        ) : hasThread ? (
          <p className="text-sm text-muted-foreground">
            This caller has SMS activity tied to this missed call. Open the full conversation to see every message.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No messages yet — recovery may still be in progress.</p>
        )}
      </Panel>

      {wired.showVoicemail ? (
        <Panel title="Voicemail" className="mb-4">
          <audio
            controls
            preload="none"
            className="w-full"
            aria-label="Voicemail recording"
            src={wired.voicemailRecordingSrc}
          />
          {wired.voicemailSummary ? (
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Summary: </span>
              {wired.voicemailSummary}
            </p>
          ) : null}
          {wired.voicemailTranscript ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{wired.voicemailTranscript}</p>
          ) : null}
          {wired.voicemailId ? (
            <Link href={`/mctb/voicemail/${wired.voicemailId}`} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Open in Voicemail</Link>
          ) : null}
        </Panel>
      ) : null}

      <Panel title="Activity" className="mb-4">
        <ol className="space-y-2">
          {wired.activitySteps.map((step) => (
            <li key={step.label} className="flex items-start gap-2 text-sm">
              <Check className={cn('mt-0.5 size-4 shrink-0', step.done ? 'text-success' : 'text-muted-foreground')} aria-hidden="true" />
              <span>
                <span className="font-medium">{step.label}</span>
                {step.at ? <span className="text-muted-foreground"> — {step.at}</span> : null}
              </span>
            </li>
          ))}
        </ol>
        {wired.technicalSteps.length > 0 ? (
          <details className="mt-4 rounded-lg border bg-muted/30 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-primary">View delivery details</summary>
            <ol className="mt-2 space-y-1.5 border-t pt-2">
              {wired.technicalSteps.map((step) => (
                <li key={`${step.label}-${step.at}`} className="text-xs text-muted-foreground">
                  {step.label}
                  {step.at ? ` · ${step.at}` : ''}
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Call details">
          <Rows items={wired.callDetailsRows.map((r) => ({ label: r.label, value: r.value }))} />
        </Panel>
        <Panel title="Consent">
          <Rows
            items={wired.consentRows.map((r) => ({
              label: r.label,
              value: r.value === 'Pending' ? <Pill tone="warning">Pending</Pill> : r.value === 'Granted' ? <Pill tone="success">Granted</Pill> : r.value,
            }))}
          />
        </Panel>
      </div>

      <details className={`mt-4 group ${OPUS_CARD}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold">
          Text-back &amp; delivery
          <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-4 border-t px-5 py-4">
          <Rows
            items={[
              { label: 'Sender', value: <span className="font-mono text-xs">{wired.senderLabel ?? '—'}</span> },
              ...wired.textBackRows.map((r) => ({ label: r.label, value: r.value })),
            ]}
          />
          <p className="text-sm text-muted-foreground">{wired.linkActivity}</p>
          <p className="text-sm text-muted-foreground">{wired.requestForm}</p>
        </div>
      </details>

      <details className={`mt-4 group ${OPUS_CARD}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold">
          Diagnostics
          <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <pre className="overflow-x-auto border-t bg-muted/40 px-5 py-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {wired.diagnostics}
        </pre>
      </details>
    </Page>
  )
}
