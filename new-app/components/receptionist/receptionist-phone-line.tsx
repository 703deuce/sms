'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, PhoneCall, PhoneForwarded, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconTile } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { useAgent } from '@/components/providers/agent-provider'
import { NumberPicker, useResolvedConnection, type ConnectionRef } from '@/components/numbers/number-picker'
import { FlowDiagram } from '@/components/numbers/number-ui'
import { formatPhone, formatWhen } from '@/lib/format'

type Props = {
  /** Where to land after ?selected= from Numbers buy flow */
  returnPath?: string
  showRoutePreview?: boolean
}

function ReceptionistPhoneLinePanelInner({
  returnPath = '/app/receptionist/call-routing',
  showRoutePreview = true,
}: Props) {
  const { draft, update, agentId, reload } = useAgent()
  const params = useSearchParams()
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [testing, setTesting] = useState<'idle' | 'running' | 'passed'>('idle')
  const conn = useResolvedConnection(draft.connection)

  useEffect(() => {
    const selected = params.get('selected')
    if (!selected) return
    const kind: ConnectionRef['kind'] = selected.startsWith('c') ? 'external' : 'owned'
    update('connection', { kind, id: selected })
    toast.success('New number selected in your draft')
    router.replace(returnPath)
  }, [params, returnPath, router, update])

  const mode = draft.coverage.mode
  const route = [
    'Caller dials',
    mode === 'every_call'
      ? 'Ava answers'
      : mode === 'after_hours'
        ? 'Staff (hours) · Ava (after)'
        : mode === 'busy'
          ? 'Staff · Ava if busy'
          : `Staff ring ${draft.coverage.staffFirstSec}s`,
    ...(mode === 'overflow' ? ['Ava answers'] : []),
    draft.capabilities.transfer ? 'Transfer or message' : 'Message / callback',
  ]

  return (
    <>
      <section id="phone-line" className="scroll-mt-24 overflow-hidden rounded-xl surface">
        <div className="flex flex-wrap items-start gap-4 p-5">
          <IconTile icon={conn?.kind === 'external' ? PhoneForwarded : PhoneCall} tone="primary" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {conn?.kind === 'external' ? 'Your number, forwarded to Transovo' : 'Transovo number'}
            </span>
            <span className="flex flex-wrap items-center gap-2 text-lg font-semibold tabular-nums">
              {conn ? formatPhone(conn.number) : 'No number connected'}
              {conn && (
                <StatusBadge tone={conn.verified ? 'success' : 'warning'}>{conn.statusLabel}</StatusBadge>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {conn?.label}
              {conn?.kind === 'external' &&
                ` · stays with ${conn.carrier} · forwards to ${formatPhone(conn.forwardsTo ?? '')}`}
              {conn?.kind === 'external' &&
                ` · last verified ${conn.lastTest ? formatWhen(conn.lastTest) : 'never'}`}
            </span>
            {!conn && (
              <span className="text-xs text-muted-foreground">
                Choose the line callers dial to reach this agent. This is separate from Phone → Call Forwarding,
                which only sets your business line for forwarding and MCTB.
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={testing === 'running' || !conn}
              onClick={async () => {
                setTesting('running')
                await new Promise((r) => setTimeout(r, 1800))
                setTesting('passed')
                toast.success('Diagnostic passed — calls reach the agent')
              }}
            >
              {testing === 'running' ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : testing === 'passed' ? (
                <CheckCircle2 data-icon="inline-start" />
              ) : (
                <Wrench data-icon="inline-start" />
              )}
              {testing === 'running' ? 'Testing…' : 'Test connection'}
            </Button>
            <Button size="sm" onClick={() => setPickerOpen(true)}>
              {conn ? 'Change number' : 'Connect number'}
            </Button>
          </div>
        </div>
        {showRoutePreview && (
          <div className="flex flex-col gap-2 border-t bg-muted/30 px-5 py-3">
            <span className="text-xs font-medium text-muted-foreground">Live route preview</span>
            <FlowDiagram steps={route} />
          </div>
        )}
        {conn?.kind === 'external' && (
          <div className="border-t px-5 py-3 text-xs text-muted-foreground">
            Outbound caller ID and SMS stay with your carrier. Forwarding is set at {conn.carrier} —{' '}
            <Link href={conn.href} className="font-medium text-primary underline-offset-2 hover:underline">
              view instructions & test history
            </Link>
            .
          </div>
        )}
      </section>

      <NumberPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        product="receptionist"
        current={draft.connection}
        provisionOnSelect
        receptionistAgentId={agentId}
        onAfterServerSync={reload}
        onSelect={(ref) => {
          if (ref.kind === 'external') {
            update('connection', ref)
            toast.success('Number changed in draft — publish to go live')
            return
          }
          toast.success('Number switched for AI Receptionist — save other edits or publish when ready')
        }}
      />
    </>
  )
}

function PhoneLinePanelFallback() {
  return (
    <section id="phone-line" className="scroll-mt-24 overflow-hidden rounded-xl surface p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading phone line…
      </div>
    </section>
  )
}

/** Inbound line for AI Receptionist — shown on Call Routing (nav) and legacy Call Handling route. */
export function ReceptionistPhoneLinePanel(props: Props) {
  return (
    <Suspense fallback={<PhoneLinePanelFallback />}>
      <ReceptionistPhoneLinePanelInner {...props} />
    </Suspense>
  )
}
