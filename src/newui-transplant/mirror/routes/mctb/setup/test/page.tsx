'use client'

import { AlertCircle, CheckCircle2, PhoneCall } from 'lucide-react'
import { Panel } from '@/newui-transplant/components/app/kit'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { Button } from '@/newui-transplant/components/ui/button'
import { BUSINESS } from '@/newui-transplant/lib/sandbox-data'

export type MctbSetupTestWired = {
  checks: Array<{ label: string; ok: boolean; href?: string }>
  businessLine: string
  liveStatusTitle: string
  liveStatusDetail: string
  liveListening: boolean
  onStartTest?: () => Promise<void>
}

const DEMO_CHECKS = [
  { label: 'Business line connected', ok: true },
  { label: 'Forwarding verified', ok: true },
  { label: 'Sender registered', ok: true },
  { label: 'Consent disclosure published', ok: true },
  { label: 'Text-back opener saved', ok: true },
  { label: 'Custom voicemail greeting', ok: false, href: '/mctb/setup/voicemail' },
]

export function TransplantMctbSetupTestPage({ wired }: { wired?: MctbSetupTestWired }) {
  const checks = wired?.checks ?? DEMO_CHECKS
  const line = wired?.businessLine ?? BUSINESS.line

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Setup checkpoints" description={`${checks.filter((c) => c.ok).length} of ${checks.length} ready`}>
        <ul className="flex flex-col gap-3">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-3 text-sm">
              {c.ok ? (
                <CheckCircle2 className="size-4 text-success" aria-label="Ready" />
              ) : (
                <AlertCircle className="size-4 text-warning" aria-label="Needs attention" />
              )}
              <span className="flex-1">{c.label}</span>
              {c.href ? <ButtonLink href={c.href} size="xs" variant="outline">Fix</ButtonLink> : null}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Live forward test">
        <ol className="flex flex-col gap-3 text-sm">
          <li className="flex gap-3"><span className="font-medium text-muted-foreground">1.</span> From a mobile phone, call <span className="font-mono">{line}</span>.</li>
          <li className="flex gap-3"><span className="font-medium text-muted-foreground">2.</span> Let it ring without answering.</li>
          <li className="flex gap-3"><span className="font-medium text-muted-foreground">3.</span> Press 1 when prompted and watch for the text.</li>
        </ol>
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-dashed p-4">
          <span className="relative flex size-9 items-center justify-center rounded-full bg-accent">
            <PhoneCall className="size-4 text-accent-foreground" aria-hidden="true" />
          </span>
          <div className="flex-1 text-sm">
            <p className="font-medium">{wired?.liveStatusTitle ?? 'Ready to listen'}</p>
            <p className="text-xs text-muted-foreground">{wired?.liveStatusDetail ?? "We'll detect the call automatically."}</p>
          </div>
          <Button type="button" onClick={() => void wired?.onStartTest?.()}>
            {wired?.liveListening ? 'Listening…' : 'Start test'}
          </Button>
        </div>
      </Panel>
    </div>
  )
}
