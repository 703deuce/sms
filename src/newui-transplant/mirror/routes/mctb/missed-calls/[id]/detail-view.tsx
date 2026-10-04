'use client'

import Link from 'next/link'
import { ArrowLeft, Check, ChevronDown, MessageSquare, Phone } from 'lucide-react'
import { Page, PageHeader, Panel, Pill, Rows } from '@/newui-transplant/components/app/kit'
import { OPUS_CARD } from '@/newui-transplant/components/app/opus-surfaces'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { RecoveryPill } from '@/newui-transplant/components/app/status'
import { MctbTeamActivityBriefPanel } from '@/newui-transplant/components/mctb/mctb-team-activity-brief-panel'
import { cn } from '@/lib/utils'
import type { MctbMissedCallDetailWired } from '@/lib/newui-transplant/adapters/mctb-missed-call-detail'

export function TransplantMctbMissedCallDetailView({ wired }: { wired: MctbMissedCallDetailWired }) {
  const convoHref = wired.conversationId
    ? `/mctb/conversations?conversation=${wired.conversationId}`
    : undefined

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

      {wired.teamBrief ? (
        <MctbTeamActivityBriefPanel brief={wired.teamBrief} className="mb-4" />
      ) : null}

      <Panel title="Recovery lifecycle" className="mb-4">
        <ol className="grid gap-4 sm:grid-cols-5">
          {wired.lifecycleSteps.map((s, i) => (
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
                {i < wired.lifecycleSteps.length - 1 ? (
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
            action={convoHref ? <Link href={convoHref} className="text-xs font-medium text-primary hover:underline">Open conversation</Link> : null}
          >
            {wired.messages.length ? (
              <ul className="flex flex-col gap-2">
                {wired.messages.map((m, i) => (
                  <li key={i} className={cn('flex', m.from === 'customer' ? 'justify-start' : 'justify-end')}>
                    <span
                      className={cn(
                        'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                        m.from === 'customer'
                          ? 'rounded-bl-md border bg-card'
                          : m.from === 'ai'
                            ? 'rounded-br-md bg-sidebar text-sidebar-foreground'
                            : 'rounded-br-md bg-primary text-primary-foreground',
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
                { label: 'Sender', value: <span className="font-mono text-xs">{wired.senderLabel ?? '—'}</span> },
                ...wired.textBackRows.map((r) => ({ label: r.label, value: r.value })),
              ]}
            />
          </Panel>
          <Panel title="Link activity">
            <p className="text-sm text-muted-foreground">{wired.linkActivity}</p>
          </Panel>
          <Panel title="Request form">
            <p className="text-sm text-muted-foreground">{wired.requestForm}</p>
          </Panel>
        </div>
        <div className="flex flex-col gap-4">
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
          {wired.showVoicemail ? (
            <Panel title="Voicemail">
              <audio
                controls
                preload="none"
                className="w-full"
                aria-label="Voicemail recording"
                src={wired.voicemailRecordingSrc}
              />
              {wired.voicemailSummary ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">AI summary: </span>
                  {wired.voicemailSummary}
                </p>
              ) : null}
              {wired.voicemailTranscript ? (
                <p className="mt-2 text-sm leading-relaxed">{wired.voicemailTranscript}</p>
              ) : null}
              {wired.voicemailId ? (
                <Link href={`/mctb/voicemail/${wired.voicemailId}`} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Open in Voicemail</Link>
              ) : null}
            </Panel>
          ) : null}
          <details className={`group ${OPUS_CARD}`}>
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold">
              Diagnostics
              <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <pre className="overflow-x-auto border-t bg-muted/40 px-5 py-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {wired.diagnostics}
            </pre>
          </details>
        </div>
      </div>
    </Page>
  )
}
