import type { Metadata } from 'next'
import { AlertCircle, CheckCircle2, PhoneCall } from 'lucide-react'
import { Panel } from '@/components/app/kit'
import { ButtonLink } from '@/components/app/button-link'
import { Button } from '@/components/ui/button'
import { BUSINESS } from '@/lib/data'

export const metadata: Metadata = { title: 'Test' }

const CHECKS = [
  { label: 'Business line connected', ok: true },
  { label: 'Forwarding verified', ok: true },
  { label: 'Sender registered', ok: true },
  { label: 'Consent disclosure published', ok: true },
  { label: 'Text-back opener saved', ok: true },
  { label: 'Custom voicemail greeting', ok: false, href: '/mctb/setup/voicemail' },
]

export default function TestSetupPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Setup checkpoints" description="5 of 6 ready">
        <ul className="flex flex-col gap-3">
          {CHECKS.map((c) => (
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
          <li className="flex gap-3"><span className="font-medium text-muted-foreground">1.</span> From a mobile phone, call <span className="font-mono">{BUSINESS.line}</span>.</li>
          <li className="flex gap-3"><span className="font-medium text-muted-foreground">2.</span> Let it ring without answering.</li>
          <li className="flex gap-3"><span className="font-medium text-muted-foreground">3.</span> Press 1 when prompted and watch for the text.</li>
        </ol>
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-dashed p-4">
          <span className="relative flex size-9 items-center justify-center rounded-full bg-accent">
            <PhoneCall className="size-4 text-accent-foreground" aria-hidden="true" />
          </span>
          <div className="flex-1 text-sm">
            <p className="font-medium">Ready to listen</p>
            <p className="text-xs text-muted-foreground">We&apos;ll detect the call automatically.</p>
          </div>
          <Button>Start test</Button>
        </div>
      </Panel>
    </div>
  )
}
