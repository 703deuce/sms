'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Pause, Phone, Play, Plus, SkipForward, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Panel } from '@/components/app/page-primitives'
import { SimpleSelect } from '@/components/app/filters'
import { StatusBadge, type Tone } from '@/components/app/status'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { useNumbers } from '@/components/providers/numbers-provider'
import {
  createPowerCampaign,
  createPowerList,
  fetchPowerCampaigns,
  fetchPowerLists,
  fetchPowerSession,
  importPowerListRows,
  patchPowerCampaign,
  powerSessionAction,
  savePowerAttemptOutcome,
  startPowerSession,
  type PowerCampaignDto,
  type PowerListDto,
  type PowerSessionStateDto,
} from '@/lib/phone-api'
import { formatPhone, formatWhen } from '@/lib/format'
import { cn } from '@/lib/utils'

const CAMPAIGN_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  draft: { label: 'Draft', tone: 'muted' },
  completed: { label: 'Completed', tone: 'neutral' },
}

const DISPOSITIONS = ['Booked', 'Interested', 'Callback', 'No answer', 'Voicemail', 'Not interested', 'Wrong number', 'Do not call'] as const

export function PowerDialer({ initialTab = 'session' }: { initialTab?: string }) {
  return (
    <Tabs defaultValue={initialTab} className="gap-6">
      <TabsList>
        <TabsTrigger value="session">Session</TabsTrigger>
        <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        <TabsTrigger value="lists">Lists</TabsTrigger>
      </TabsList>
      <TabsContent value="session"><Session /></TabsContent>
      <TabsContent value="campaigns"><Campaigns /></TabsContent>
      <TabsContent value="lists"><Lists /></TabsContent>
    </Tabs>
  )
}

function contactLabel(c: { firstName: string | null; lastName: string | null; phone: string }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
  return name || formatPhone(c.phone)
}

function Session() {
  const { startCall, endCall, activeCall } = useWorkspace()
  const [campaigns, setCampaigns] = useState<PowerCampaignDto[]>([])
  const [campaignId, setCampaignId] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState<string | null>(null)
  const [lead, setLead] = useState<PowerSessionStateDto['next']>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [log, setLog] = useState<PowerSessionStateDto['attempts']>([])
  const [campaignMeta, setCampaignMeta] = useState<{ name: string; callerId: string; maxAttempts: number } | null>(null)
  const [disposition, setDisposition] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const refreshSession = useCallback(async (sid: string) => {
    const data = await fetchPowerSession(sid, true)
    setLead(data.next)
    setSessionStatus(data.session?.status ?? null)
    if (data.session?.campaign) {
      const cfg = (data.session.campaign.configJson || {}) as { maxAttempts?: number }
      setCampaignMeta({
        name: data.session.campaign.name,
        callerId: data.session.campaign.callerIdE164,
        maxAttempts: cfg.maxAttempts ?? 3,
      })
    }
    if (data.attempts) setLog(data.attempts)
  }, [])

  useEffect(() => {
    void fetchPowerCampaigns()
      .then((rows) => {
        setCampaigns(rows)
        if (!campaignId && rows[0]) setCampaignId(rows[0].id)
      })
      .catch(() => toast.error('Could not load campaigns'))
  }, [campaignId])

  useEffect(() => {
    if (!sessionId) return
    void refreshSession(sessionId).catch((e) => toast.error(e instanceof Error ? e.message : 'Session error'))
  }, [sessionId, refreshSession])

  const onCall = !!activeCall && activeCall.status !== 'ended' && activeCall.status !== 'failed'

  const startSession = async () => {
    if (!campaignId) return
    setLoading(true)
    try {
      const session = await startPowerSession(campaignId)
      await patchPowerCampaign(campaignId, { status: 'active' })
      setSessionId(session.id)
      setSessionStatus(session.status)
      await refreshSession(session.id)
      toast.success('Session started')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start session')
    } finally {
      setLoading(false)
    }
  }

  const dial = async () => {
    if (!sessionId || !lead) return
    setLoading(true)
    try {
      const attempt = await powerSessionAction(sessionId, 'create_attempt', {
        contactId: lead.contact.id,
        attemptNumber: lead.attemptNumber,
      }) as { id: string }
      setAttemptId(attempt.id)
      const name = contactLabel(lead.contact)
      const ok = startCall({
        name,
        number: lead.contact.phone,
        callerId: lead.campaign.callerIdE164,
        source: 'power_dialer',
        powerDialerAttemptId: attempt.id,
        idempotencyKey: `pd-${attempt.id}`,
      })
      if (!ok) setAttemptId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not dial')
    } finally {
      setLoading(false)
    }
  }

  const saveAndNext = async () => {
    if (!sessionId || !disposition || !attemptId) return
    setLoading(true)
    try {
      if (onCall) endCall()
      await savePowerAttemptOutcome(attemptId, { disposition, notes: notes.trim() || undefined })
      setDisposition(null)
      setNotes('')
      setAttemptId(null)
      await refreshSession(sessionId)
      toast.success('Outcome saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save outcome')
    } finally {
      setLoading(false)
    }
  }

  const skip = async () => {
    if (!sessionId || !lead) return
    setLoading(true)
    try {
      const attempt = await powerSessionAction(sessionId, 'create_attempt', {
        contactId: lead.contact.id,
        attemptNumber: lead.attemptNumber,
      }) as { id: string }
      await savePowerAttemptOutcome(attempt.id, { disposition: 'Skipped', notes: 'Skipped in session' })
      setDisposition(null)
      setNotes('')
      await refreshSession(sessionId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Skip failed')
    } finally {
      setLoading(false)
    }
  }

  const togglePause = async () => {
    if (!sessionId) return
    try {
      if (sessionStatus === 'paused') {
        await powerSessionAction(sessionId, 'resume')
        setSessionStatus('active')
      } else {
        await powerSessionAction(sessionId, 'pause')
        setSessionStatus('paused')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update session')
    }
  }

  const endSession = async () => {
    if (!sessionId) return
    try {
      await powerSessionAction(sessionId, 'end')
      setSessionId(null)
      setLead(null)
      setSessionStatus(null)
      toast.success('Session ended')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not end session')
    }
  }

  const remainingHint = useMemo(() => {
    if (!campaignMeta || !log) return ''
    const done = log.filter((a) => a.status === 'completed').length
    return `${done} completed in this session`
  }, [campaignMeta, log])

  const contact = lead?.contact
  const paused = sessionStatus === 'paused'

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        {!sessionId ? (
          <Panel title="Start a power dialing session" description="Pick a campaign, then start dialing eligible contacts from its list.">
            <div className="flex max-w-md flex-col gap-4">
              <SimpleSelect
                label="Campaign"
                value={campaignId}
                onChange={setCampaignId}
                options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Button onClick={() => void startSession()} disabled={!campaignId || loading}>
                <Play />
                Start session
              </Button>
            </div>
          </Panel>
        ) : (
          <Panel
            title={campaignMeta?.name ?? 'Power dialer session'}
            description={
              campaignMeta
                ? `Calling from ${formatPhone(campaignMeta.callerId)} · max ${campaignMeta.maxAttempts} attempts · ${remainingHint}`
                : undefined
            }
            actions={
              <div className="flex gap-2">
                {sessionStatus === 'active' || sessionStatus === 'paused' ? (
                  <Button variant="outline" size="sm" onClick={() => void togglePause()}>
                    {paused ? <Play /> : <Pause />}
                    {paused ? 'Resume' : 'Pause'}
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => void endSession()}>
                  End session
                </Button>
              </div>
            }
          >
            {contact && lead ? (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xl font-semibold">{contactLabel(contact)}</span>
                    <span className="font-mono text-sm text-muted-foreground">{formatPhone(contact.phone)}</span>
                    {contact.company && <span className="text-xs text-muted-foreground">{contact.company}</span>}
                    <span className="text-xs text-muted-foreground">
                      Attempt {lead.attemptNumber} of {campaignMeta?.maxAttempts ?? 3}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={onCall || loading || paused} onClick={() => void skip()}>
                      <SkipForward />
                      Skip
                    </Button>
                    <Button
                      size="sm"
                      className="bg-success text-success-foreground hover:bg-success/90"
                      disabled={onCall || loading || paused}
                      onClick={() => void dial()}
                    >
                      <Phone />
                      Dial
                    </Button>
                  </div>
                </div>

                {(onCall || attemptId) && (
                  <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                    {onCall ? 'On call — set disposition when the call ends.' : 'Call finished — choose a disposition.'}
                  </p>
                )}

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-medium">Disposition</legend>
                  <div className="flex flex-wrap gap-2">
                    {DISPOSITIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={disposition === d}
                        onClick={() => setDisposition(d)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-sm transition-colors',
                          disposition === d ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className="flex flex-col gap-2">
                  <label htmlFor="pd-notes" className="text-sm font-medium">Notes</label>
                  <Textarea id="pd-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
                </div>
                <Button className="self-end" disabled={!disposition || !attemptId || loading} onClick={() => void saveAndNext()}>
                  Save & next
                </Button>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No more eligible contacts in this campaign.</p>
            )}
          </Panel>
        )}
      </div>

      <Panel title="Session log" bodyClassName="p-0">
        <ul className="divide-y">
          {!log?.length && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Dispositions appear here.</li>}
          {log?.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
              <span className="min-w-0 truncate">{d.contactName}</span>
              <StatusBadge tone={d.disposition === 'Booked' ? 'success' : d.disposition === 'Do not call' ? 'danger' : 'neutral'}>
                {d.disposition || d.status}
              </StatusBadge>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

function Campaigns() {
  const [rows, setRows] = useState<PowerCampaignDto[]>([])
  const [lists, setLists] = useState<PowerListDto[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [listId, setListId] = useState('')
  const [callerId, setCallerId] = useState('')
  const { owned } = useNumbers()

  const reload = useCallback(() => {
    void fetchPowerCampaigns().then(setRows).catch(() => undefined)
    void fetchPowerLists().then(setLists).catch(() => undefined)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const active = owned.find((n) => n.status === 'active')
    if (active && !callerId) setCallerId(active.number)
  }, [owned, callerId])

  const create = async () => {
    try {
      await createPowerCampaign({
        name,
        listId,
        callerIdE164: callerId,
        configJson: { maxAttempts: 3, retryDelayMinutes: 60 },
      })
      setOpen(false)
      setName('')
      reload()
      toast.success('Campaign created')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    }
  }

  return (
    <>
      <Panel
        title="Campaigns"
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus />
            New campaign
          </Button>
        }
        bodyClassName="p-0"
      >
        <ul className="divide-y">
          {rows.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No campaigns yet.</li>}
          {rows.map((c) => {
            const st = CAMPAIGN_STATUS[c.status] ?? CAMPAIGN_STATUS.draft
            return (
              <li key={c.id} className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-center">
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.listName}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Progress value={c.completedPct} className="h-1.5 flex-1" aria-label={`${c.completedPct}% complete`} />
                  <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{c.completedPct}%</span>
                </span>
                <span className="text-xs text-muted-foreground">{c.attempts} attempts · created {formatWhen(c.created)}</span>
                <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} />
            <SimpleSelect
              label="Calling list"
              value={listId}
              onChange={setListId}
              options={lists.map((l) => ({ value: l.id, label: l.name }))}
            />
            <SimpleSelect
              label="Caller ID"
              value={callerId}
              onChange={setCallerId}
              options={owned.filter((n) => n.status === 'active').map((n) => ({ value: n.number, label: n.nickname || n.number }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!name || !listId || !callerId} onClick={() => void create()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Lists() {
  const [rows, setRows] = useState<PowerListDto[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [listId, setListId] = useState('')
  const [csv, setCsv] = useState('')
  const [newName, setNewName] = useState('')

  const reload = () => void fetchPowerLists().then(setRows).catch(() => undefined)

  useEffect(() => {
    reload()
  }, [])

  const parseCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean)
    const rows: { name?: string; phone: string; company?: string }[] = []
    for (const line of lines) {
      const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ''))
      if (parts.length < 1) continue
      const phone = parts.find((p) => p.replace(/\D/g, '').length >= 10) || parts[0]
      const name = parts[0] !== phone ? parts[0] : parts[1]
      const company = parts.length > 2 ? parts[2] : undefined
      rows.push({ phone, name, company })
    }
    return rows
  }

  const runImport = async () => {
    if (!listId) return
    try {
      const result = await importPowerListRows(listId, parseCsv(csv))
      toast.success(`Imported ${result.imported}`, { description: result.skipped ? `${result.skipped} skipped` : undefined })
      setImportOpen(false)
      setCsv('')
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    }
  }

  const createList = async () => {
    if (!newName.trim()) return
    try {
      await createPowerList(newName.trim())
      setNewName('')
      reload()
      toast.success('List created')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create list')
    }
  }

  return (
    <>
      <Panel
        title="Call lists"
        description="Ineligible entries (opted out, blocked, invalid) are excluded automatically."
        actions={
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload />
            Import CSV
          </Button>
        }
        bodyClassName="p-0"
      >
        <div className="flex flex-wrap items-end gap-2 border-b px-5 py-3">
          <Input className="max-w-xs" placeholder="New list name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button size="sm" variant="secondary" onClick={() => void createList()}>Create list</Button>
        </div>
        <ul className="divide-y">
          {rows.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <span className="flex flex-col">
                <span className="text-sm font-medium">{l.name}</span>
                <span className="text-xs text-muted-foreground">{l.source} · updated {formatWhen(l.updated)}</span>
              </span>
              <span className="flex gap-2 text-xs">
                <StatusBadge tone="success">{l.eligible} eligible</StatusBadge>
                <StatusBadge tone="muted">{l.ineligible} excluded</StatusBadge>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import CSV</DialogTitle>
          </DialogHeader>
          <SimpleSelect
            label="Target list"
            value={listId}
            onChange={setListId}
            options={rows.map((l) => ({ value: l.id, label: l.name }))}
          />
          <Textarea rows={8} placeholder="name,phone,company" value={csv} onChange={(e) => setCsv(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button disabled={!listId || !csv.trim()} onClick={() => void runImport()}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
