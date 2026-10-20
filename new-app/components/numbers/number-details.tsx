'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowRightLeft,
  CheckCircle2,
  Circle,
  CircleAlert,
  FileText,
  Hash,
  Loader2,
  Pencil,
  PhoneCall,
  PhoneForwarded,
  Star,
  Trash2,
  Unplug,
  Workflow,
  XCircle,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, KeyValue, Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { useNumbers } from '@/components/providers/numbers-provider'
import { CONNECTION_STATUS, FORWARDING_LABEL, inboundFlow, OWNED_STATUS, PORT_STATUS, PRODUCT_LABEL } from '@/lib/numbers'
import { formatFull, formatPhone, formatWhen } from '@/lib/format'
import { CapabilityChips, Callout, FlowDiagram, ProductChips } from './number-ui'
import { AssignmentSheet } from './assignment-sheet'
import { DisconnectDialog, ReleaseDialog, RenameDialog } from './number-dialogs'
import { cn } from '@/lib/utils'
import { NumberIncomingCallsPanel } from '@/components/phone/number-incoming-calls-panel'

const crumbs = (label: string, tab?: string) => [
  { label: 'Numbers', href: tab ? `/app/numbers?tab=${tab}` : '/app/numbers' },
  { label },
]

function NotFound({ what, tab }: { what: string; tab?: string }) {
  return (
    <Page>
      <Panel>
        <EmptyState icon={Hash} title={`${what} not found`} description="It may have been released or removed." action={<Button render={<Link href={tab ? `/app/numbers?tab=${tab}` : '/app/numbers'} />}>Back to numbers</Button>} />
      </Panel>
    </Page>
  )
}

export function OwnedNumberDetail({ id }: { id: string }) {
  const { owned, updateOwned } = useNumbers()
  const n = owned.find((x) => x.id === id)
  const [rename, setRename] = useState(false)
  const [assign, setAssign] = useState(false)
  const [release, setRelease] = useState(false)
  if (!n) return <NotFound what="Number" />

  return (
    <Page>
      <PageHeader
        breadcrumbs={crumbs(formatPhone(n.number))}
        eyebrow={n.nickname}
        title={formatPhone(n.number)}
        description={`${n.numberType === 'toll_free' ? 'Toll-free' : 'Local'} · ${n.region} · Added ${formatWhen(n.addedAt)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setRename(true)}><Pencil data-icon="inline-start" />Rename</Button>
            <Button onClick={() => setAssign(true)} disabled={n.status !== 'active'}><Workflow data-icon="inline-start" />Manage assignments</Button>
          </>
        }
      />

      {n.status === 'releasing' && <Callout tone="warning" icon={Clock} title="Release in progress">Waiting for carrier confirmation. Calls still route until the release completes.</Callout>}
      {n.status === 'provisioning' && <Callout icon={Loader2} title="Provisioning">The carrier is activating this number. Voice usually works within minutes.</Callout>}
      {n.status === 'issue' && <Callout tone="danger" icon={CircleAlert} title="Carrier issue">Inbound calls may fail. Our team has been notified.</Callout>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <NumberIncomingCallsPanel phoneNumberId={n.id} />
          <Panel title="Inbound flow" icon={Workflow} description="What happens when someone calls this number." actions={<Button variant="ghost" size="sm" onClick={() => setAssign(true)} disabled={n.status !== 'active'}>Edit</Button>}>
            <FlowDiagram steps={inboundFlow(n.assignments)} />
          </Panel>
          <Panel title="Assignments" icon={PhoneCall} bodyClassName="p-0">
            {n.assignments.length === 0 ? (
              <EmptyState icon={Workflow} title="Not assigned" description="Callers hear an unavailable message." action={<Button onClick={() => setAssign(true)} disabled={n.status !== 'active'}>Assign to a product</Button>} />
            ) : (
              <ul className="divide-y">
                {[...n.assignments].sort((a, b) => a.priority - b.priority).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">{a.priority}</span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium">{a.target}</span>
                      <span className="text-xs text-muted-foreground">{PRODUCT_LABEL[a.product]} · {a.schedule}</span>
                    </div>
                    <StatusBadge tone={a.status === 'active' ? 'success' : 'warning'}>{a.status === 'active' ? 'Active' : 'Pending'}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Details" icon={FileText}>
            <KeyValue
              items={[
                { label: 'Status', value: <StatusBadge tone={OWNED_STATUS[n.status].tone}>{OWNED_STATUS[n.status].label}</StatusBadge> },
                { label: 'Capabilities', value: <CapabilityChips caps={n.capabilities} /> },
                { label: 'Products', value: <ProductChips products={n.assignments.map((a) => a.product)} /> },
                { label: 'Monthly', value: n.monthly != null ? `$${n.monthly.toFixed(2)}` : 'Included' },
                { label: 'Country', value: n.country },
              ]}
            />
          </Panel>
          <Panel title="Caller ID" icon={Star}>
            {n.defaultCallerId ? (
              <p className="text-sm text-muted-foreground">This is the workspace default for outbound calls.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">Outbound calls currently show a different number.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  disabled={n.status !== 'active' || !n.capabilities.voice}
                  onClick={() => {
                    owned.forEach((o) => o.defaultCallerId && updateOwned(o.id, { defaultCallerId: false }))
                    updateOwned(n.id, { defaultCallerId: true })
                    toast.success('Default caller ID updated')
                  }}
                >
                  Make default
                </Button>
              </div>
            )}
          </Panel>
          <Panel title="Danger zone" className="ring-destructive/15">
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Return this number to the carrier. It may not be recoverable.</p>
              <Button variant="destructive" size="sm" className="self-start" disabled={n.status === 'releasing'} onClick={() => setRelease(true)}>
                <Trash2 data-icon="inline-start" />
                Release number
              </Button>
            </div>
          </Panel>
        </div>
      </div>

      <RenameDialog number={n} open={rename} onOpenChange={setRename} />
      <AssignmentSheet number={n} open={assign} onOpenChange={setAssign} />
      <ReleaseDialog number={n} open={release} onOpenChange={setRelease} />
    </Page>
  )
}

export function ConnectionDetail({ id }: { id: string }) {
  const { connections, updateConnection } = useNumbers()
  const c = connections.find((x) => x.id === id)
  const [testing, setTesting] = useState(false)
  const [disc, setDisc] = useState(false)
  if (!c) return <NotFound what="Connection" tab="connected" />

  async function runTest(fail = false) {
    if (!c) return
    setTesting(true)
    updateConnection(c.id, { status: 'pending' })
    await new Promise((r) => setTimeout(r, 2000))
    const at = new Date().toISOString()
    updateConnection(c.id, {
      status: fail ? 'needs_attention' : 'verified',
      lastTest: at,
      tests: [
        {
          id: `t_${Date.now()}`,
          at,
          result: fail ? 'failed' : 'passed',
          callerId: fail ? null : '+13125550147',
          calledLine: fail ? null : c.number,
          routedTo: fail ? null : c.products.includes('receptionist') ? 'Ava (AI agent)' : 'Missed-call recovery',
          note: fail ? 'No forwarded call arrived within 90 seconds.' : 'Forwarded call reached Transovo with original caller ID.',
        },
        ...c.tests,
      ],
    })
    setTesting(false)
    toast[fail ? 'error' : 'success'](fail ? 'Test failed' : 'Test passed')
  }

  return (
    <Page>
      <PageHeader
        breadcrumbs={crumbs(c.label, 'connected')}
        eyebrow="Connected line"
        title={formatPhone(c.number)}
        description={`${c.label} · stays with ${c.carrier}`}
        actions={
          <>
            <Button variant="outline" render={<Link href={`/app/numbers/port?number=${c.number}`} />}><ArrowRightLeft data-icon="inline-start" />Port to Transovo</Button>
            <Button onClick={() => runTest()} disabled={testing}>
              {testing ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <PhoneCall data-icon="inline-start" />}
              {testing ? 'Listening…' : 'Run test call'}
            </Button>
          </>
        }
      />

      {c.status === 'needs_attention' && (
        <Callout tone="danger" icon={CircleAlert} title="Forwarding isn't reaching Transovo">
          Confirm with {c.carrier} that calls forward to {formatPhone(c.forwardsTo)} for: {c.forwardingTypes.map((f) => FORWARDING_LABEL[f].toLowerCase()).join(', ')}.
        </Callout>
      )}
      {c.status === 'not_tested' && <Callout tone="warning" icon={Clock} title="Not tested yet">Run a test call to confirm forwarded calls arrive.</Callout>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Test history" icon={PhoneCall} className="lg:col-span-2" bodyClassName="p-0">
          {c.tests.length === 0 ? (
            <EmptyState icon={PhoneCall} title="No tests yet" description="Call your business number from another phone while we listen." />
          ) : (
            <ul className="divide-y">
              {c.tests.map((t) => (
                <li key={t.id} className="flex gap-3 px-5 py-4">
                  {t.result === 'passed' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {t.result === 'passed' ? 'Passed' : 'Failed'}
                      <span className="text-xs font-normal text-muted-foreground">{formatFull(t.at)}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{t.note}</span>
                    {t.result === 'passed' && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Caller {t.callerId ? formatPhone(t.callerId) : '—'} → {t.routedTo}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t px-5 py-2">
            <button type="button" className="text-[11px] text-muted-foreground underline" disabled={testing} onClick={() => runTest(true)}>Simulate failed test</button>
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Setup" icon={PhoneForwarded}>
            <KeyValue
              items={[
                { label: 'Status', value: <StatusBadge tone={CONNECTION_STATUS[c.status].tone}>{CONNECTION_STATUS[c.status].label}</StatusBadge> },
                { label: 'Carrier', value: c.carrier },
                { label: 'Forwards to', value: <span className="tabular-nums">{formatPhone(c.forwardsTo)}</span> },
                { label: 'When', value: c.forwardingTypes.map((f) => FORWARDING_LABEL[f]).join(', ') },
                { label: 'Handled by', value: <ProductChips products={c.products} /> },
                { label: 'Last test', value: c.lastTest ? formatWhen(c.lastTest) : 'Never' },
              ]}
            />
          </Panel>
          <Panel title="Limits" icon={CircleAlert}>
            <p className="text-sm leading-relaxed text-muted-foreground">Outbound calls, caller ID and SMS from this number stay with {c.carrier}. Port it to manage everything in Transovo.</p>
          </Panel>
          <Button variant="outline" className="self-start text-destructive" onClick={() => setDisc(true)}><Unplug data-icon="inline-start" />Disconnect</Button>
        </div>
      </div>
      <DisconnectDialog connection={c} open={disc} onOpenChange={setDisc} onDone={() => history.back()} />
    </Page>
  )
}

export function PortDetail({ id }: { id: string }) {
  const { ports, updatePort } = useNumbers()
  const p = ports.find((x) => x.id === id)
  if (!p) return <NotFound what="Port request" tab="porting" />
  const s = PORT_STATUS[p.status]

  return (
    <Page>
      <PageHeader
        breadcrumbs={crumbs(formatPhone(p.number), 'porting')}
        eyebrow={p.reference ?? 'Draft'}
        title={`Porting ${formatPhone(p.number)}`}
        description={`From ${p.carrierFrom} · started ${formatWhen(p.requestedAt)}`}
        actions={<StatusBadge tone={s.tone} className="h-6 px-2.5 text-xs">{s.label}</StatusBadge>}
      />

      {p.status === 'info_needed' && (
        <Callout tone="warning" icon={CircleAlert} title="The carrier needs more information">
          <span className="flex flex-wrap items-center gap-3">
            The account number didn&apos;t match their records. Upload a recent bill showing the account number.
            <Button size="sm" onClick={() => { updatePort(p.id, { status: 'in_review', documents: [...p.documents, { name: 'carrier-bill.pdf', uploadedAt: new Date().toISOString() }] }); toast.success('Sent to carrier') }}>Upload bill</Button>
          </span>
        </Callout>
      )}
      {p.status === 'rejected' && <Callout tone="danger" icon={XCircle} title="Port rejected">The carrier rejected this request. Correct the details and submit a new port.</Callout>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Progress" icon={Clock} className="lg:col-span-2">
          <ol className="flex flex-col">
            {p.milestones.map((m, i) => (
              <li key={m.label} className="relative flex gap-3 pb-6 last:pb-0">
                {i < p.milestones.length - 1 && <span aria-hidden className={cn('absolute top-6 left-2.5 h-[calc(100%-1.25rem)] w-px', m.state === 'done' ? 'bg-success/40' : 'bg-border')} />}
                <span className="relative z-10 mt-0.5">
                  {m.state === 'done' ? <CheckCircle2 className="size-5 text-success" /> : m.state === 'attention' ? <CircleAlert className="size-5 text-warning-foreground" /> : m.state === 'current' ? <Loader2 className="size-5 animate-spin text-primary" /> : <Circle className="size-5 text-muted-foreground/40" />}
                </span>
                <div className="flex flex-col">
                  <span className={cn('text-sm font-medium', m.state === 'upcoming' && 'text-muted-foreground')}>{m.label}</span>
                  <span className="text-xs text-muted-foreground">{m.at ? formatFull(m.at) : m.state === 'current' ? 'In progress' : 'Pending'}</span>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel title="Request" icon={FileText}>
            <KeyValue
              items={[
                { label: 'Expected', value: p.expectedDate ? formatFull(p.expectedDate) : 'Not scheduled' },
                { label: 'Account holder', value: p.owner },
                { label: 'Account', value: p.accountMasked },
                { label: 'Service address', value: p.serviceAddress },
              ]}
            />
          </Panel>
          <Panel title="Documents" icon={FileText}>
            {p.documents.length ? (
              <ul className="flex flex-col gap-2">
                {p.documents.map((d) => (
                  <li key={d.name} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{d.name}</span>
                    <span className="text-xs text-muted-foreground">{formatWhen(d.uploadedAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">None uploaded.</p>
            )}
          </Panel>
          <Callout>Keep your current service active until the number shows as moved.</Callout>
        </div>
      </div>
    </Page>
  )
}
