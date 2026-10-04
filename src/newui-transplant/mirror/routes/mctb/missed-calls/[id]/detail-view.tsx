'use client'

import Link from 'next/link'
import { ArrowLeft, ChevronDown, MessageSquare, Phone } from 'lucide-react'
import { Page, PageHeader, Panel, Rows, TextLink } from '@/newui-transplant/components/app/kit'
import { OPUS_CARD } from '@/newui-transplant/components/app/opus-surfaces'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { MctbRecoveryBriefPanel, MctbRecoveryBriefPlaceholder } from '@/newui-transplant/components/mctb/mctb-recovery-brief-panel'
import { MctbMissedCallInfoRail } from '@/newui-transplant/components/mctb/mctb-missed-call-info-rail'
import { MctbDetailConversationThread } from '@/newui-transplant/components/mctb/mctb-detail-conversation-thread'
import type { MctbMissedCallDetailWired } from '@/lib/newui-transplant/adapters/mctb-missed-call-detail'

export function TransplantMctbMissedCallDetailView({ wired }: { wired: MctbMissedCallDetailWired }) {
  const convoHref = wired.conversationId
    ? `/mctb/conversations?conversation=${wired.conversationId}`
    : undefined
  const callerFirstName = wired.caller !== wired.phone ? wired.caller.split(' ')[0] : null

  return (
    <Page>
      <Link
        href="/mctb/missed-calls"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Missed calls
      </Link>

      <PageHeader
        title={wired.caller}
        meta={
          <span className="block space-y-1">
            <span className="font-mono text-sm text-muted-foreground">
              {wired.phone} · Missed {wired.missed}
            </span>
            <span className="text-sm text-muted-foreground">{wired.headerStatusLine}</span>
          </span>
        }
        actions={
          <>
            <ButtonLink href={`tel:${wired.phoneTel}`} variant="outline">
              <Phone /> Call
            </ButtonLink>
            {convoHref ? (
              <ButtonLink href={convoHref}>
                <MessageSquare /> Text
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] lg:items-stretch">
        <div className="min-w-0">
          {wired.teamBrief ? (
            <MctbRecoveryBriefPanel
              brief={wired.teamBrief}
              callerFirstName={callerFirstName}
              onCall={() => {
                window.location.href = `tel:${wired.phoneTel}`
              }}
            />
          ) : (
            <MctbRecoveryBriefPlaceholder />
          )}
        </div>
        <MctbMissedCallInfoRail sections={wired.infoRailSections} className="h-full" />
      </div>

      <Panel
        className="mb-4"
        title="Conversation"
        action={convoHref ? <TextLink href={convoHref}>Open conversation</TextLink> : undefined}
      >
        <MctbDetailConversationThread
          messages={wired.messages}
          conversationHref={convoHref}
          emptyHint={wired.conversationEmptyHint}
        />
      </Panel>

      <Panel className="mb-4" title="Voicemail">
        {wired.showVoicemail ? (
          <>
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
              <Link
                href={`/mctb/voicemail/${wired.voicemailId}`}
                className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
              >
                Open in Voicemail
              </Link>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No voicemail was left.</p>
        )}
      </Panel>

      <details className={`group mb-4 ${OPUS_CARD}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold">
          Recovery &amp; delivery details
          <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-4 border-t px-5 py-4">
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recovery lifecycle
            </h3>
            <ol className="space-y-3">
              {wired.lifecycleSteps.map((s) => (
                <li key={s.label} className="flex gap-3 text-sm">
                  <span
                    className={`mt-0.5 size-2 shrink-0 rounded-full ${s.done ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Text-back</h3>
            <Rows
              items={[
                { label: 'Sender', value: <span className="font-mono text-xs">{wired.senderLabel ?? '—'}</span> },
                ...wired.textBackRows.map((r) => ({ label: r.label, value: r.value })),
              ]}
            />
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consent</h3>
            <Rows items={wired.consentRows.map((r) => ({ label: r.label, value: r.value }))} />
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Link activity</h3>
            <p className="text-sm text-muted-foreground">{wired.linkActivity}</p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Request form</h3>
            <p className="text-sm text-muted-foreground">{wired.requestForm}</p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diagnostics</h3>
            <pre className="overflow-x-auto rounded-lg bg-muted/40 px-4 py-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {wired.diagnostics}
            </pre>
          </div>
        </div>
      </details>
    </Page>
  )
}
