'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CalendarCheck, MessageSquare, Phone, PhoneIncoming, Sparkles } from 'lucide-react'
import { Page, PageHeader, Panel, Pill, Rows } from '@/newui-transplant/components/app/kit'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { OutcomePill } from '@/newui-transplant/components/app/status'
import type { VoiceCallDetailWired } from '@/lib/newui-transplant/adapters/voice-call-detail'

const ICONS = [PhoneIncoming, Sparkles, CalendarCheck, MessageSquare]

export function TransplantVoiceCallDetailView({ wired }: { wired: VoiceCallDetailWired }) {
  const lifecycle =
    wired.lifecycleSteps.length > 0
      ? wired.lifecycleSteps
      : [
          'Inbound call answered',
          'Intent identified',
          'Call completed',
        ]

  return (
    <Page>
      <Link href="/voice/calls" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden="true" /> All calls
      </Link>
      <PageHeader
        title={wired.caller}
        status={<OutcomePill outcome={wired.outcome} />}
        meta={
          <span className="font-mono">
            {wired.phone} · {wired.date} {wired.time} · {wired.duration}
          </span>
        }
        actions={
          <>
            {wired.conversationHref ? (
              <ButtonLink href={wired.conversationHref} variant="outline">
                <MessageSquare /> Open conversation
              </ButtonLink>
            ) : null}
            <ButtonLink href={`tel:${wired.phoneTel}`}>
              <Phone /> Call back
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel title="What happened">
            <ol className="relative flex flex-col gap-4 border-l pl-5">
              {lifecycle.map((text, i) => {
                const Icon = ICONS[i % ICONS.length]
                return (
                  <li key={`${text}-${i}`} className="relative text-sm">
                    <span className="absolute -left-[29px] flex size-4 items-center justify-center rounded-full bg-card ring-2 ring-primary/30">
                      <Icon className="size-2.5 text-primary" aria-hidden="true" />
                    </span>
                    {text}
                  </li>
                )
              })}
            </ol>
          </Panel>

          {wired.attention ? (
            <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 p-4">
              <AlertTriangle className="mt-0.5 size-4 text-warning" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium">Still needs follow-up</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{wired.attention}</p>
              </div>
              <ButtonLink href={`tel:${wired.phoneTel}`} size="sm" variant="outline">Mark handled</ButtonLink>
            </div>
          ) : null}

          <Panel title="Summary">
            <p className="text-pretty text-sm leading-relaxed">{wired.summary}</p>
          </Panel>

          <Panel title="Recording" description="Stored for 90 days">
            {wired.recordingUrl ? (
              <audio controls preload="none" className="w-full">
                <source src={wired.recordingUrl} type="audio/mpeg" />
              </audio>
            ) : (
              <p className="text-sm text-muted-foreground">No recording available.</p>
            )}
          </Panel>

          <Panel title="Transcript">
            {wired.transcript.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transcript available.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {wired.transcript.map((line, i) => (
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
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Information collected">
            <Rows
              items={wired.collectedRows.map((r) => ({ label: r.label, value: r.value }))}
            />
          </Panel>
          <Panel title="Knowledge gaps">
            <p className="text-sm text-muted-foreground">{wired.knowledgeGapsText}</p>
          </Panel>
          <Panel title="Call data">
            <Rows items={wired.callDataRows.map((r) => ({ label: r.label, value: r.value }))} />
          </Panel>
          <Panel title="Activity feed">
            <ul className="flex flex-col gap-3 text-sm">
              {wired.activityFeed.map((row, i) => (
                <li key={i}><span className="text-muted-foreground">{row.time}</span> · {row.text}</li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </Page>
  )
}
