'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowRight,
  AudioLines,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  MessageSquareText,
  Pencil,
  PhoneCall,
  PhoneForwarded,
  Plus,
  Route,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Users,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { IconTile } from '@/components/app/page-primitives'
import { OptionGroup } from '@/components/app/option-group'
import { SimpleSelect } from '@/components/app/filters'
import { StatusBadge } from '@/components/app/status'
import { useAgent } from '@/components/providers/agent-provider'
import { NumberPicker, useResolvedConnection, type ConnectionRef } from '@/components/numbers/number-picker'
import { Callout, FlowDiagram } from '@/components/numbers/number-ui'
import type { AgentConfig, SpamRule, TransferDestination } from '@/lib/agent'
import { formatPhone, formatWhen } from '@/lib/format'
import { DemoNote, JumpChips, Pills, Section, ToggleRow } from './ai-ui'
import { OperationsEditor } from './operations-editor'

const MODES: { value: AgentConfig['coverage']['mode']; label: string; description: string; disabled?: boolean }[] = [
  { value: 'every_call', label: 'Every call', description: 'Ava answers immediately, day and night.' },
  { value: 'after_hours', label: 'After hours', description: 'Staff answer during business hours; Ava after.' },
  { value: 'overflow', label: 'No answer / overflow', description: 'Ring staff first, then Ava picks up.' },
  { value: 'busy', label: 'Line busy', description: 'Ava answers when every staff line is busy.' },
  { value: 'custom', label: 'Custom schedule', description: 'Per-day windows when Ava answers (see Operations below).' },
]

const FALLBACK_LABEL: Record<TransferDestination['fallback'], string> = { backup: 'Try backup destination', callback: 'Schedule a callback', message: 'Take a message', end: 'End politely' }
const SPAM_LABEL: Record<SpamRule['kind'], string> = { spam_likely: 'Spam likely', solicitor: 'Unwanted solicitor', blocked: 'Blocked numbers' }
const SPAM_ACTION: Record<SpamRule['action'], string> = { screen: 'Screen — ask purpose', message: 'Take a message', transfer: 'Transfer to staff', end: 'End the call' }

export function CallHandlingEditor() {
  const { draft, update, agentId, reload } = useAgent()
  const params = useSearchParams()
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [testing, setTesting] = useState<'idle' | 'running' | 'passed'>('idle')
  const [editDest, setEditDest] = useState<TransferDestination | null>(null)
  const [confirmRecording, setConfirmRecording] = useState<AgentConfig['audio']['recording'] | null>(null)
  const [recoveryPreview, setRecoveryPreview] = useState(false)
  const conn = useResolvedConnection(draft.connection)

  useEffect(() => {
    const selected = params.get('selected')
    if (!selected) return
    const kind: ConnectionRef['kind'] = selected.startsWith('c') ? 'external' : 'owned'
    update('connection', { kind, id: selected })
    toast.success('New number selected in your draft')
    router.replace('/app/receptionist/call-handling')
  }, [params, router, update])

  const mode = draft.coverage.mode
  const route = [
    'Caller dials',
    mode === 'every_call' ? 'Ava answers' : mode === 'after_hours' ? 'Staff (hours) · Ava (after)' : mode === 'busy' ? 'Staff · Ava if busy' : `Staff ring ${draft.coverage.staffFirstSec}s`,
    ...(mode === 'overflow' ? ['Ava answers'] : []),
    draft.capabilities.transfer ? 'Transfer or message' : 'Message / callback',
  ]
  const mctbShares = conn?.products.includes('mctb')

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-xl surface">
        <div className="flex flex-wrap items-start gap-4 p-5">
          <IconTile icon={conn?.kind === 'external' ? PhoneForwarded : PhoneCall} tone="primary" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{conn?.kind === 'external' ? 'Your number, forwarded to Transovo' : 'Transovo number'}</span>
            <span className="flex flex-wrap items-center gap-2 text-lg font-semibold tabular-nums">
              {conn ? formatPhone(conn.number) : 'No number connected'}
              {conn && <StatusBadge tone={conn.verified ? 'success' : 'warning'}>{conn.statusLabel}</StatusBadge>}
            </span>
            <span className="text-xs text-muted-foreground">
              {conn?.label}
              {conn?.kind === 'external' && ` · stays with ${conn.carrier} · forwards to ${formatPhone(conn.forwardsTo ?? '')}`}
              {conn?.kind === 'external' && ` · last verified ${conn.lastTest ? formatWhen(conn.lastTest) : 'never'}`}
            </span>
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
              {testing === 'running' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : testing === 'passed' ? <CheckCircle2 data-icon="inline-start" /> : <Wrench data-icon="inline-start" />}
              {testing === 'running' ? 'Testing…' : 'Test connection'}
            </Button>
            <Button size="sm" onClick={() => setPickerOpen(true)}>Change number</Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t bg-muted/30 px-5 py-3">
          <span className="text-xs font-medium text-muted-foreground">Live route preview</span>
          <FlowDiagram steps={route} />
        </div>
        {conn?.kind === 'external' && (
          <div className="border-t px-5 py-3 text-xs text-muted-foreground">
            Outbound caller ID and SMS stay with your carrier. Forwarding is set at {conn.carrier} —{' '}
            <Link href={conn.href} className="font-medium text-primary underline-offset-2 hover:underline">view instructions & test history</Link>.
          </div>
        )}
      </section>

      <JumpChips items={[{ id: 'coverage', label: 'Coverage' }, { id: 'transfers', label: 'Transfers' }, { id: 'operations', label: 'Hours & on-call' }, { id: 'messages', label: 'Messages & alerts' }, { id: 'recovery', label: 'Recovery SMS' }, { id: 'protection', label: 'Protection' }, { id: 'advanced', label: 'Advanced' }]} />

      <Section id="coverage" icon={Route} title="Coverage & routing" description="When Ava answers, and who rings first.">
        <OptionGroup label="Answer mode" value={mode} onChange={(v) => update('coverage', (c) => ({ ...c, mode: v }))} options={MODES} columns={2} />
        {(mode === 'overflow' || mode === 'busy') && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="staff-sec" className="flex items-center justify-between">
              Ring staff first
              <span className="text-xs font-semibold tabular-nums text-primary">{draft.coverage.staffFirstSec} sec</span>
            </Label>
            <input id="staff-sec" type="range" min={10} max={45} step={5} value={draft.coverage.staffFirstSec} onChange={(e) => update('coverage', (c) => ({ ...c, staffFirstSec: Number(e.target.value) }))} className="accent-[var(--primary)]" />
            <span className="text-xs text-muted-foreground">About {Math.round(draft.coverage.staffFirstSec / 5)} rings before Ava picks up.</span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-sm">
          <span className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" aria-hidden />Business hours Mon–Fri 8a–6p, Sat 9a–2p · Central time</span>
          <Link href="/app/settings?tab=business" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">Edit shared hours & holidays<ChevronRight className="size-3" /></Link>
        </div>
        {mctbShares && (
          <Callout tone="warning" icon={TriangleAlert} title="Missed Call Text Back shares this number">
            Calls Ava answers are never treated as missed, so MCTB won&apos;t text those callers. MCTB only fires if neither staff nor Ava picks up.
          </Callout>
        )}
      </Section>

      <Section id="transfers" icon={Users} title="Human transfers & emergencies" description="Where Ava hands off, and what happens if nobody answers.">
        <div className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/8">
          {draft.transfers.map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 text-sm font-medium">{t.name}{!t.enabled && <StatusBadge tone="muted">Off</StatusBadge>}</span>
                <span className="truncate text-xs text-muted-foreground"><span className="tabular-nums">{formatPhone(t.number)}</span> · {t.reason} · If no answer: {FALLBACK_LABEL[t.fallback].toLowerCase()}</span>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${t.name}`} onClick={() => setEditDest(t)}><Pencil /></Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="self-start" onClick={() => setEditDest({ id: `tr_${Date.now()}`, name: '', number: '', enabled: true, reason: '', fallback: 'message' })}><Plus data-icon="inline-start" />Add destination</Button>
        <div className="flex flex-col">
          <span className="text-sm font-medium">Transfer when</span>
          <div className="divide-y">
            <ToggleRow title="Caller asks for a person" checked={draft.triggers.asks_person} onChange={(v) => update('triggers', (t) => ({ ...t, asks_person: v }))} />
            <ToggleRow title="Emergency or urgent" description="Pain, swelling, trauma — uses your On-call destination." checked={draft.triggers.emergency} onChange={(v) => update('triggers', (t) => ({ ...t, emergency: v }))} />
            <ToggleRow title="Request Ava can't handle" checked={draft.triggers.unsupported} onChange={(v) => update('triggers', (t) => ({ ...t, unsupported: v }))} />
            <ToggleRow title="Booking requires staff" checked={draft.triggers.booking_staff} onChange={(v) => update('triggers', (t) => ({ ...t, booking_staff: v }))} />
            <ToggleRow title="Business-specific trigger" checked={draft.triggers.custom} onChange={(v) => update('triggers', (t) => ({ ...t, custom: v }))} />
          </div>
          {draft.triggers.custom && <Input aria-label="Custom trigger" placeholder="e.g. caller mentions a lawsuit" value={draft.customTrigger} onChange={(e) => update('customTrigger', e.target.value)} />}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Pills label="Transfer style" value={draft.transferStyle} onChange={(v) => update('transferStyle', v)} options={[{ value: 'cold', label: 'Cold — connect directly' }, { value: 'warm', label: 'Warm — brief staff' }]} />
        </div>
      </Section>

      <div id="operations" className="flex flex-col gap-4 scroll-mt-20">
        <OperationsEditor draft={draft} update={update} />
      </div>

      <Section id="messages" icon={BellRing} title="Messages, callbacks & notifications" description="What Ava collects and who hears about it.">
        <div className="divide-y">
          <ToggleRow title="Take messages" checked={draft.messages.takeMessage} onChange={(v) => update('messages', (m) => ({ ...m, takeMessage: v }))} />
          <ToggleRow title="Offer callbacks" checked={draft.messages.callbacks} onChange={(v) => update('messages', (m) => ({ ...m, callbacks: v }))} />
        </div>
        {draft.messages.callbacks && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Required for every callback</legend>
            <div className="flex flex-wrap gap-2">
              {([['ani', 'Caller ID number'], ['confirm', 'Confirm best number'], ['time', 'Preferred time'], ['reason', 'Reason for call']] as const).map(([k, l]) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 rounded-full surface px-3 py-1.5 text-xs font-medium has-[:checked]:ring-2 has-[:checked]:ring-primary">
                  <input type="checkbox" className="accent-[var(--primary)]" checked={draft.messages.requiredFields[k]} onChange={(e) => update('messages', (m) => ({ ...m, requiredFields: { ...m.requiredFields, [k]: e.target.checked } }))} />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2"><Label htmlFor="sms-r">SMS recipients</Label><Input id="sms-r" value={draft.messages.smsRecipients} onChange={(e) => update('messages', (m) => ({ ...m, smsRecipients: e.target.value }))} /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="email-r">Email recipients</Label><Input id="email-r" value={draft.messages.emailRecipients} onChange={(e) => update('messages', (m) => ({ ...m, emailRecipients: e.target.value }))} /></div>
        </div>
        <div className="divide-y">
          <ToggleRow title="Urgent call alerts" checked={draft.messages.urgentAlerts} onChange={(v) => update('messages', (m) => ({ ...m, urgentAlerts: v }))} />
          <ToggleRow title="Booking failure alerts" description="When a booking or transfer attempt fails." checked={draft.messages.bookingFailureAlerts} onChange={(v) => update('messages', (m) => ({ ...m, bookingFailureAlerts: v }))} />
          <ToggleRow title="Daily digest" checked={draft.messages.dailyDigest} onChange={(v) => update('messages', (m) => ({ ...m, dailyDigest: v }))} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Quiet hours: {draft.messages.quietHours} (urgent alerts still send)</span>
          <Link href="/app/integrations" className="font-medium text-primary hover:underline">Webhooks in Integrations</Link>
        </div>
      </Section>

      <Section id="recovery" icon={MessageSquareText} title="AI Call Recovery SMS" defaultOpen={false} description="Texts callers after an AI-answered call ends unresolved. Not the same as Missed Call Text Back." badge={<StatusBadge tone={draft.recovery.enabled ? 'success' : 'muted'}>{draft.recovery.enabled ? 'On' : 'Off'}</StatusBadge>}>
        <Callout icon={ShieldCheck}>Eligible only when Ava answered and the call ended without a booking, transfer or message. Never sent after a successful outcome, never alongside an MCTB text, and opt-outs are always honored.</Callout>
        <ToggleRow title="Enable recovery SMS" checked={draft.recovery.enabled} disabled={draft.recovery.consentMode === 'disabled'} onChange={(v) => update('recovery', (r) => ({ ...r, enabled: v }))} description={draft.recovery.consentMode === 'disabled' ? 'Choose a consent mode first.' : undefined} />
        <OptionGroup label="Consent" value={draft.recovery.consentMode} onChange={(v) => update('recovery', (r) => ({ ...r, consentMode: v, enabled: v === 'disabled' ? false : r.enabled }))} columns={3} options={[{ value: 'disabled', label: 'Disabled', description: 'Never text.' }, { value: 'existing', label: 'Existing consent', description: 'Only contacts who opted in.' }, { value: 'platform', label: 'Ask on the call', description: 'Ava asks before ending.' }]} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Pills label="Delay after hang-up" value={String(draft.recovery.delaySec) as '0' | '15' | '30'} onChange={(v) => update('recovery', (r) => ({ ...r, delaySec: Number(v) as 0 | 15 | 30 }))} options={[{ value: '0', label: 'Immediately' }, { value: '15', label: '15 sec' }, { value: '30', label: '30 sec' }]} />
          <ToggleRow title="Carry conversation over" description="Replies continue in the same thread with call context." checked={draft.recovery.carryover} onChange={(v) => update('recovery', (r) => ({ ...r, carryover: v }))} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
          <span className="text-xs text-muted-foreground">Approved template · sent from Main line · 2 numbers suppressed (opted out)</span>
          <Button variant="outline" size="sm" onClick={() => setRecoveryPreview(true)}>Preview & test</Button>
        </div>
      </Section>

      <Section id="protection" icon={ShieldAlert} title="Call protection" defaultOpen={false} description="Spam, solicitors and blocked numbers.">
        <div className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/8">
          {draft.protection.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{SPAM_LABEL[r.kind]}</span>
                <span className="text-xs text-muted-foreground">{r.note}</span>
              </div>
              <SimpleSelect label={`${SPAM_LABEL[r.kind]} action`} className="w-48" value={r.action} onChange={(v) => update('protection', (list) => list.map((x) => (x.id === r.id ? { ...x, action: v } : x)))} options={(Object.keys(SPAM_ACTION) as SpamRule['action'][]).map((a) => ({ value: a, label: SPAM_ACTION[a] }))} />
            </div>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">Screened calls still appear in Calls with an outcome you can review.</span>
      </Section>

      <Section id="advanced" icon={AudioLines} title="Advanced audio & operations" defaultOpen={false} description="Recording, connection greeting, on-call and diagnostics.">
        <Pills label="Call recording" value={draft.audio.recording} onChange={(v) => setConfirmRecording(v)} options={[{ value: 'all', label: 'All calls' }, { value: 'inbound', label: 'Inbound only' }, { value: 'off', label: 'Off' }]} />
        <div className="flex flex-col gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Connection greeting</span>
            <span className="text-xs text-muted-foreground">Plays <strong className="font-medium text-foreground">before</strong> Ava speaks — separate from her opening line in Agent Settings.</span>
          </div>
          <Pills label="Greeting type" value={draft.audio.connectionGreeting} onChange={(v) => update('audio', (a) => ({ ...a, connectionGreeting: v }))} options={[{ value: 'none', label: 'None' }, { value: 'professional', label: 'Professional' }, { value: 'warm', label: 'Warm' }, { value: 'tts', label: 'Write text' }, { value: 'upload', label: 'Upload audio' }]} />
          {draft.audio.connectionGreeting === 'tts' && <Textarea aria-label="Connection greeting text" value={draft.audio.connectionGreetingText} onChange={(e) => update('audio', (a) => ({ ...a, connectionGreetingText: e.target.value }))} rows={2} />}
          {draft.audio.connectionGreeting === 'upload' && <Input type="file" accept="audio/mpeg,audio/wav" aria-label="Upload connection audio" />}
          <FlowDiagram steps={['Call connects', draft.audio.connectionGreeting === 'none' ? 'No connection audio' : 'Connection greeting', 'Ava: opening line']} />
        </div>
        <AdvRow title="Callback SLA" text={`Follow-ups flagged after ${draft.messages.slaHours} hours (also in operating maturity).`} />
        <AdvRow title="Ingress diagnostics" text="SIP trunk healthy · worker region us-central · 182 ms avg pickup" />
      </Section>

      <DemoNote />

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
      <DestinationSheet value={editDest} onClose={() => setEditDest(null)} />

      <Dialog open={!!confirmRecording} onOpenChange={(o) => !o && setConfirmRecording(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change recording policy?</DialogTitle>
            <DialogDescription>
              {confirmRecording === 'off' ? 'New calls will not be recorded. Transcripts stay available, audio does not.' : 'Some states require all-party consent. Your connection greeting should mention recording.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRecording(null)}>Cancel</Button>
            <Button onClick={() => { if (confirmRecording) update('audio', (a) => ({ ...a, recording: confirmRecording })); setConfirmRecording(null) }}>Update draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recoveryPreview} onOpenChange={setRecoveryPreview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recovery SMS preview</DialogTitle>
            <DialogDescription>Sent {draft.recovery.delaySec ? `${draft.recovery.delaySec} seconds` : 'right'} after an unresolved AI call.</DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl rounded-bl-sm bg-muted p-3 text-sm leading-relaxed">Hi, it&apos;s Harbor &amp; Pine Dental — sorry we couldn&apos;t sort everything out on the call. Reply here and our team will help. Reply STOP to opt out.</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecoveryPreview(false)}>Close</Button>
            <Button onClick={() => { toast.success('Test text sent to your phone'); setRecoveryPreview(false) }}>Send test to me</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AdvRow({ title, text, badge }: { title: string; text: string; badge?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3">
      <span className="flex items-center justify-between gap-2 text-sm font-medium">{title}{badge}</span>
      <span className="text-xs text-muted-foreground">{text}</span>
    </div>
  )
}

function DestinationSheet({ value, onClose }: { value: TransferDestination | null; onClose: () => void }) {
  const { draft, update } = useAgent()
  const [form, setForm] = useState<TransferDestination | null>(null)
  const f = form ?? value
  const exists = !!value && draft.transfers.some((t) => t.id === value.id)
  const valid = !!f && f.name.trim() && /^\+?[\d\s()-]{10,}$/.test(f.number)
  const close = () => { onClose(); setForm(null) }

  return (
    <Sheet open={!!value} onOpenChange={(o) => { if (!o) close() }}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-5">
          <SheetTitle>{exists ? 'Edit destination' : 'Add destination'}</SheetTitle>
          <SheetDescription>Changes apply to the draft until you publish.</SheetDescription>
        </SheetHeader>
        {f && (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
            <div className="flex flex-col gap-2"><Label htmlFor="d-name">Name</Label><Input id="d-name" value={f.name} onChange={(e) => setForm({ ...f, name: e.target.value })} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="d-num">Phone number</Label><Input id="d-num" inputMode="tel" placeholder="+1 312 555 0100" value={f.number} onChange={(e) => setForm({ ...f, number: e.target.value })} /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="d-reason">When to use it</Label><Input id="d-reason" value={f.reason} onChange={(e) => setForm({ ...f, reason: e.target.value })} /></div>
            <div className="flex flex-col gap-2">
              <Label>If busy or no answer</Label>
              <SimpleSelect label="Fallback" value={f.fallback} onChange={(v) => setForm({ ...f, fallback: v })} options={(Object.keys(FALLBACK_LABEL) as TransferDestination['fallback'][]).map((k) => ({ value: k, label: FALLBACK_LABEL[k] }))} />
            </div>
            <ToggleRow title="Enabled" checked={f.enabled} onChange={(v) => setForm({ ...f, enabled: v })} />
          </div>
        )}
        <SheetFooter className="flex-row justify-between border-t p-4">
          {exists ? (
            <Button variant="ghost" className="text-destructive" onClick={() => { update('transfers', (l) => l.filter((t) => t.id !== value!.id)); close() }}><Trash2 data-icon="inline-start" />Remove</Button>
          ) : <span />}
          <Button
            disabled={!valid}
            onClick={() => {
              if (!f) return
              update('transfers', (l) => (exists ? l.map((t) => (t.id === f.id ? f : t)) : [...l, f]))
              close()
            }}
          >
            Save to draft<ArrowRight data-icon="inline-end" />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
