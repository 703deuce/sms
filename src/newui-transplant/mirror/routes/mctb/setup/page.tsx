import Link from 'next/link'
import { AlertTriangle, ChevronRight, Pause } from 'lucide-react'
import { Panel, Pill } from '@/newui-transplant/components/app/kit'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { Button } from '@/newui-transplant/components/ui/button'
import { BUSINESS } from '@/newui-transplant/lib/sandbox-data'

export type MctbSetupOverviewSummaryRow = {
  label: string
  value: string
  href: string
  tone?: 'success' | 'warning'
}

export type MctbSetupOverviewWired = {
  businessLine?: string
  sender?: string
  recoveryActive?: boolean
  recoveryLabel?: string
  forwardingVerified?: boolean
  forwardingPillLabel?: string
  forwardingPillTone?: 'success' | 'warning'
  lastTestLabel?: string
  callFlowRows?: MctbSetupOverviewSummaryRow[]
  operationsRows?: MctbSetupOverviewSummaryRow[]
  activity?: Array<{ time: string; text: string }>
  attentionHeadline?: string
  attentionIssues?: Array<{ message: string; fixHref: string }>
  onPauseToggle?: () => void | Promise<void>
  pauseButtonLabel?: string
}


const CALL_FLOW = [
  { label: 'Phone & Forwarding', value: `Forwarding verified · ${BUSINESS.line}`, href: '/mctb/setup/phone', tone: 'success' as const }, // default copy; wired overrides in status strip
  { label: 'Consent', value: 'Press 1 · disclosure published', href: '/mctb/setup/consent', tone: 'success' as const },
  { label: 'Text Back', value: 'Opener customized · 1 segment', href: '/mctb/setup/text-back', tone: 'success' as const },
  { label: 'Recovery', value: '5 triggers · 30s delay', href: '/mctb/setup/recovery', tone: 'success' as const },
  { label: 'Voicemail', value: 'Greeting not recorded', href: '/mctb/setup/voicemail', tone: 'warning' as const },
]

const OPERATIONS = [
  { label: 'Notifications', value: '3 recipients', href: '/mctb/setup/notifications' },
  { label: 'Exclusions', value: '4 numbers', href: '/mctb/setup/exclusions' },
  { label: 'Links', value: 'Booking link default', href: '/mctb/setup/links' },
  { label: 'Test', value: 'Passed Sep 24', href: '/mctb/setup/test' },
]

const ACTIVITY = [
  ['Sep 24, 4:18 PM', 'Live test passed'],
  ['Sep 22, 10:02 AM', 'Text-back opener updated by Dana'],
  ['Sep 20, 8:45 AM', 'Sender (512) 555-0199 registered'],
]

function SummaryRow({ label, value, href, tone }: { label: string; value: string; href: string; tone?: 'success' | 'warning' }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50">
        <span className="w-40 shrink-0 text-sm font-medium">{label}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{value}</span>
        {tone ? <Pill tone={tone}>{tone === 'success' ? 'Ready' : 'Review'}</Pill> : null}
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  )
}

export function TransplantMctbSetupPage({ wired }: { wired?: MctbSetupOverviewWired }) {
  const live = wired !== undefined
  const businessLine = wired?.businessLine ?? BUSINESS.line
  const sender = wired?.sender ?? BUSINESS.sender
  const recoveryTone = wired?.recoveryActive === false ? 'warning' : 'success'
  const recoveryLabel =
    wired?.recoveryLabel ??
    (wired?.recoveryActive === false ? 'Paused' : 'Active')
  const callFlow = live && wired?.callFlowRows?.length ? wired.callFlowRows : CALL_FLOW
  const operations = live && wired?.operationsRows?.length ? wired.operationsRows : OPERATIONS
  const activity = live
    ? (wired?.activity ?? [])
    : ACTIVITY.map(([time, text]) => ({ time, text }))
  const forwardingPillTone = wired?.forwardingPillTone ?? 'success'
  const forwardingPillLabel = wired?.forwardingPillLabel ?? 'Verified'
  const lastTest = wired?.lastTestLabel ?? 'Sep 24'
  const attentionIssues = wired?.attentionIssues ?? []
  const showAttention = live ? attentionIssues.length > 0 : true
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Status" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-5">
        {[
          ['Recovery', <Pill key="r" tone={recoveryTone}>{recoveryLabel}</Pill>],
          ['Business line', <span key="b" className="font-mono text-sm">{businessLine}</span>],
          ['Text-back sender', <span key="s" className="font-mono text-sm">{sender}</span>],
          ['Forwarding', <Pill key="f" tone={forwardingPillTone}>{forwardingPillLabel}</Pill>],
          ['Last test', <span key="t" className="text-sm">{lastTest}</span>],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="mt-1.5">{value}</div>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-sm font-medium">Pause recovery</p>
          <p className="text-xs text-muted-foreground">Temporarily stop sending recovery texts, e.g. during a holiday.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void wired?.onPauseToggle?.()}>
          <Pause /> {wired?.pauseButtonLabel ?? 'Pause'}
        </Button>
      </div>

      {showAttention ? (
        <details className="group rounded-xl border border-warning/40 bg-warning/5" open={attentionIssues.length === 1}>
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm">
            <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
            <span className="flex-1 font-medium">
              {wired?.attentionHeadline ?? 'Needs attention · 8 of 9 core systems ready'}
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">
              View {attentionIssues.length || 1} issue{attentionIssues.length === 1 ? '' : 's'}
            </span>
          </summary>
          {attentionIssues.length
            ? attentionIssues.map((issue) => (
                <div
                  key={issue.message}
                  className="flex items-center justify-between gap-3 border-t border-warning/30 px-4 py-3 text-sm"
                >
                  <span>{issue.message}</span>
                  <ButtonLink href={issue.fixHref} size="sm" variant="outline">Fix</ButtonLink>
                </div>
              ))
            : (
                <div className="flex items-center justify-between gap-3 border-t border-warning/30 px-4 py-3 text-sm">
                  <span>No custom voicemail greeting — callers hear the default carrier greeting.</span>
                  <ButtonLink href="/mctb/setup/voicemail" size="sm" variant="outline">Fix</ButtonLink>
                </div>
              )}
        </details>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel title="Call flow" bodyClassName="p-0">
            <ul className="divide-y">{callFlow.map((r) => <SummaryRow key={r.label} {...r} />)}</ul>
          </Panel>
          <Panel title="Operations" bodyClassName="p-0">
            <ul className="divide-y">{operations.map((r) => <SummaryRow key={r.label} {...r} />)}</ul>
          </Panel>
        </div>
        <div className="flex flex-col gap-4">
          <Panel title="Quick actions">
            <div className="flex flex-col gap-2">
              <ButtonLink href="/mctb/setup/test" variant="outline" className="justify-start">Run live test</ButtonLink>
              <ButtonLink href="/mctb/setup/text-back" variant="outline" className="justify-start">Edit text-back message</ButtonLink>
              <ButtonLink href="/mctb/setup/exclusions" variant="outline" className="justify-start">Add excluded number</ButtonLink>
            </div>
          </Panel>
          <Panel title="Recent system activity">
            <ol className="relative flex flex-col gap-4 border-l pl-4">
              {activity.map((row) => (
                <li key={`${row.time}-${row.text}`} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" aria-hidden="true" />
                  <p className="text-sm">{row.text}</p>
                  <p className="text-xs text-muted-foreground">{row.time}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  )
}
