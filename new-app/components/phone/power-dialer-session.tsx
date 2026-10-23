'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Pause, Phone, Play, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from '@/components/app/page-primitives'
import { SimpleSelect } from '@/components/app/filters'
import { StatusBadge } from '@/components/app/status'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { useNumbers } from '@/components/providers/numbers-provider'
import {
  fetchPowerCampaigns,
  fetchPowerSession,
  fetchPowerSessionSummary,
  patchPowerCampaign,
  powerSessionAction,
  savePowerAttemptOutcome,
  startPowerSession,
  type PowerSessionSummaryDto,
  type PowerCampaignDto,
  type PowerSessionStateDto,
} from '@/lib/phone-api'
import { formatPhone, formatDuration, formatWhen } from '@/lib/format'
import { cn } from '@/lib/utils'

const DISPOSITIONS = ['Booked', 'Interested', 'Callback', 'No answer', 'Voicemail', 'Not interested', 'Wrong number', 'Do not call'] as const

function contactLabel(c: { firstName: string | null; lastName: string | null; phone: string }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
  return name || formatPhone(c.phone)
}

export function PowerDialerSessionWorkspace({ initialCampaignId }: { initialCampaignId?: string } = {}) {
  const { startCall, endCall, activeCall, webrtcStatus } = useWorkspace()
  const { owned } = useNumbers()
  const [campaigns, setCampaigns] = useState<PowerCampaignDto[]>([])
  const [campaignId, setCampaignId] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [runtime, setRuntime] = useState<PowerSessionStateDto | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [disposition, setDisposition] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [callbackAt, setCallbackAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [sessionSummary, setSessionSummary] = useState<PowerSessionSummaryDto | null>(null)
  const autoDialLock = useRef(false)

  const sessionStatus = runtime?.session?.status ?? null
  const lead = runtime?.next ?? null
  const rules = runtime?.rules
  const progression = runtime?.progression
  const powerMode = rules?.dialingMode === 'power'

  const refreshSession = useCallback(async (sid: string) => {
    const data = await fetchPowerSession(sid, true)
    setRuntime(data)
    if (data.ringTimeoutHangup) {
      endCall()
    }
    if (data.currentAttempt?.id && (data.progression?.phase === 'awaiting_disposition' || data.currentAttempt.status === 'answered')) {
      setAttemptId(data.currentAttempt.id)
    }
    return data
  }, [endCall])

  useEffect(() => {
    void fetchPowerCampaigns()
      .then((rows) => {
        setCampaigns(rows)
        if (initialCampaignId && rows.some((r) => r.id === initialCampaignId)) {
          setCampaignId(initialCampaignId)
        } else if (!campaignId && rows[0]) setCampaignId(rows[0].id)
      })
      .catch(() => toast.error('Could not load campaigns'))
  }, [campaignId, initialCampaignId])

  useEffect(() => {
    if (!sessionId) return
    void refreshSession(sessionId).catch((e) => toast.error(e instanceof Error ? e.message : 'Session error'))
    const t = window.setInterval(() => {
      void refreshSession(sessionId).catch(() => undefined)
    }, 1000)
    return () => window.clearInterval(t)
  }, [sessionId, refreshSession])

  const onCall = !!activeCall && activeCall.status !== 'ended' && activeCall.status !== 'failed'
  const paused = sessionStatus === 'paused'

  const eligibleTotal = runtime?.eligibilityCounts?.eligible ?? 0

  const dialLead = useCallback(
    async (contactId: string, attemptNumber: number, idempotencyKey: string) => {
      if (!sessionId || !lead) return
      setLoading(true)
      try {
        const attempt = await powerSessionAction(sessionId, 'create_attempt', {
          contactId,
          attemptNumber,
          idempotencyKey,
        }) as { id: string }
        setAttemptId(attempt.id)
        const contact = lead.contact
        const ok = startCall({
          name: contactLabel(contact),
          number: contact.phone,
          callerId: lead.campaign.callerIdE164,
          source: 'power_dialer',
          powerDialerAttemptId: attempt.id,
          idempotencyKey: `pd-call-${attempt.id}`,
        })
        if (!ok) {
          setAttemptId(null)
          autoDialLock.current = false
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not dial')
        autoDialLock.current = false
      } finally {
        setLoading(false)
      }
    },
    [sessionId, lead, startCall],
  )

  useEffect(() => {
    if (!sessionId || !lead || !powerMode || paused || onCall || attemptId) return
    if (!progression?.autoDialReady) return
    if (progression.phase === 'awaiting_disposition') return
    if (autoDialLock.current) return
    autoDialLock.current = true
    const key = `pd-auto-${sessionId}-${lead.contact.id}-${lead.attemptNumber}`
    void dialLead(lead.contact.id, lead.attemptNumber, key).finally(() => {
      window.setTimeout(() => {
        autoDialLock.current = false
      }, 2000)
    })
  }, [sessionId, lead, powerMode, paused, onCall, attemptId, progression, dialLead])

  const startSession = async () => {
    if (!campaignId) return
    setLoading(true)
    try {
      const session = await startPowerSession(campaignId)
      await patchPowerCampaign(campaignId, { status: 'active' })
      setSessionId(session.id)
      await refreshSession(session.id)
      toast.success('Session started')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start session')
    } finally {
      setLoading(false)
    }
  }

  const saveAndNext = async () => {
    if (!sessionId || !disposition || !attemptId) return
    setLoading(true)
    try {
      if (onCall) endCall()
      await savePowerAttemptOutcome(attemptId, {
        disposition,
        notes: notes.trim() || undefined,
        callbackAt: disposition === 'Callback' && callbackAt ? new Date(callbackAt).toISOString() : null,
      })
      setDisposition(null)
      setNotes('')
      setCallbackAt('')
      setAttemptId(null)
      autoDialLock.current = false
      await refreshSession(sessionId)
      toast.success('Outcome saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save outcome')
    } finally {
      setLoading(false)
    }
  }

  const skipCountdown = async () => {
    if (!sessionId) return
    try {
      await powerSessionAction(sessionId, 'skip_countdown')
      await refreshSession(sessionId)
    } catch {
      toast.error('Could not skip wait')
    }
  }

  const togglePause = async () => {
    if (!sessionId) return
    try {
      if (sessionStatus === 'paused') {
        await powerSessionAction(sessionId, 'resume')
      } else {
        await powerSessionAction(sessionId, 'pause')
      }
      await refreshSession(sessionId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update session')
    }
  }

  const endSession = async () => {
    if (!sessionId) return
    const endedId = sessionId
    try {
      if (onCall) endCall()
      await powerSessionAction(endedId, 'end')
      const summary = await fetchPowerSessionSummary(endedId)
      setSessionSummary(summary)
      setSummaryOpen(true)
      setSessionId(null)
      setRuntime(null)
      setAttemptId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not end session')
    }
  }

  const campaignMeta = useMemo(() => {
    const c = runtime?.session?.campaign
    if (!c) return null
    const cfg = (c.configJson || {}) as { maxAttempts?: number }
    return {
      name: c.name,
      callerId: c.callerIdE164,
      maxAttempts: rules?.totalAttemptCap ?? cfg.maxAttempts ?? 3,
      listName: c.list?.name,
    }
  }, [runtime, rules])

  const micBlocked = webrtcStatus !== 'ready'

  const warnings: string[] = []
  if (micBlocked) warnings.push('Browser calling is not ready — check microphone permissions.')
  if (owned.filter((n) => n.status === 'active').length === 0) warnings.push('No active outbound number assigned.')
  if (sessionId && eligibleTotal === 0) warnings.push('No eligible contacts in this campaign right now.')

  const log = runtime?.attempts ?? []
  const countdown = progression?.countdownSeconds ?? 0

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        {!sessionId ? (
          <Panel title="Session setup" description="Choose a campaign, confirm eligibility, then start dialing.">
            {warnings.length > 0 && (
              <ul className="mb-4 flex flex-col gap-1 text-sm text-warning-foreground">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <div className="flex max-w-md flex-col gap-4">
              <SimpleSelect
                label="Campaign"
                value={campaignId}
                onChange={setCampaignId}
                options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
              />
              <p className="text-xs text-muted-foreground">
                Mode: {campaigns.find((c) => c.id === campaignId)?.dialingMode ?? 'power'} · Eligible contacts load after session start.
              </p>
              <Button onClick={() => void startSession()} disabled={!campaignId || loading || micBlocked}>
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
                ? `${formatPhone(campaignMeta.callerId)} · ${campaignMeta.listName ?? 'List'} · ${eligibleTotal} eligible · ${powerMode ? 'Power' : 'Preview'} mode`
                : undefined
            }
            actions={
              <div className="flex gap-2">
                {(sessionStatus === 'active' || sessionStatus === 'paused') && (
                  <Button variant="outline" size="sm" onClick={() => void togglePause()}>
                    {paused ? <Play /> : <Pause />}
                    {paused ? 'Resume' : 'Pause'}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => void endSession()}>
                  End session
                </Button>
              </div>
            }
          >
            {countdown > 0 && powerMode && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span>Next call in {countdown}s</span>
                <Button variant="ghost" size="sm" onClick={() => void skipCountdown()}>
                  <SkipForward />
                  Skip wait
                </Button>
              </div>
            )}

            {lead ? (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xl font-semibold">{contactLabel(lead.contact)}</span>
                    <span className="font-mono text-sm text-muted-foreground">{formatPhone(lead.contact.phone)}</span>
                    {lead.contact.company && <span className="text-xs text-muted-foreground">{lead.contact.company}</span>}
                    {lead.contact.customFields && typeof lead.contact.customFields === 'object' && (
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {Object.entries(lead.contact.customFields as Record<string, unknown>).slice(0, 6).map(([k, v]) => (
                          <li key={k}><span className="font-medium text-foreground">{k}:</span> {String(v)}</li>
                        ))}
                      </ul>
                    )}
                    {runtime?.attempts && lead.contact.id && (
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground" aria-label="Previous attempts this session">
                        {runtime.attempts
                          .filter((a) => a.contactPhone === lead.contact.phone)
                          .slice(0, 4)
                          .map((a) => (
                            <li key={a.id}>
                              Prior: {a.disposition || a.status} · {formatWhen(a.createdAt)}
                              {a.notes ? ` — ${a.notes}` : ''}
                            </li>
                          ))}
                      </ul>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Attempt {lead.attemptNumber} of {campaignMeta?.maxAttempts ?? 3}
                    </span>
                    {onCall && activeCall?.startedAt && (
                      <span className="text-xs text-muted-foreground">
                        On call · {formatDuration(Math.floor((Date.now() - activeCall.startedAt) / 1000))}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!powerMode && (
                      <Button
                        size="sm"
                        className="bg-success text-success-foreground hover:bg-success/90"
                        disabled={onCall || loading || paused || progression?.phase === 'awaiting_disposition'}
                        onClick={() =>
                          void dialLead(lead.contact.id, lead.attemptNumber, `pd-manual-${lead.contact.id}-${Date.now()}`)
                        }
                      >
                        <Phone />
                        Call
                      </Button>
                    )}
                  </div>
                </div>

                {(onCall || attemptId || progression?.phase === 'awaiting_disposition') && (
                  <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                    {onCall
                      ? 'On call — set disposition when the call ends.'
                      : progression?.phase === 'awaiting_disposition' || attemptId
                        ? 'Choose a disposition to continue.'
                        : powerMode
                          ? 'Auto-dialing when eligible…'
                          : 'Ready for next call.'}
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
                {disposition === 'Callback' && (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Callback time</span>
                    <Input type="datetime-local" value={callbackAt} onChange={(e) => setCallbackAt(e.target.value)} />
                  </label>
                )}
                <div className="flex flex-col gap-2">
                  <label htmlFor="pd-notes" className="text-sm font-medium">Notes</label>
                  <Textarea id="pd-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
                </div>
                <Button
                  className="self-end"
                  disabled={!disposition || !attemptId || loading}
                  onClick={() => void saveAndNext()}
                >
                  Save &amp; next
                </Button>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <p className="font-medium text-foreground">No more eligible contacts</p>
                {runtime?.emptyReasons && (
                  <ul className="mt-3 space-y-1 text-left text-xs">
                    {runtime.emptyReasons.map((r) => (
                      <li key={r.bucket}>{r.bucket}: {r.count}</li>
                    ))}
                  </ul>
                )}
                {runtime?.nextEligibleAt && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Next contact may become eligible around {formatWhen(runtime.nextEligibleAt)}.
                  </p>
                )}
              </div>
            )}
          </Panel>
        )}
      </div>

      <Panel title="Session log" bodyClassName="p-0">
        <ul className="divide-y">
          {!log.length && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Dispositions appear here.</li>}
          {log.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
              <span className="min-w-0 truncate">{d.contactName}</span>
              <StatusBadge tone={d.disposition === 'Booked' ? 'success' : d.disposition === 'Do not call' ? 'danger' : 'neutral'}>
                {d.disposition || d.status}
              </StatusBadge>
            </li>
          ))}
        </ul>
      </Panel>

      {summaryOpen && sessionSummary && (
        <Panel title="Session summary" className="lg:col-span-3">
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div><dt className="text-muted-foreground">Attempts</dt><dd className="font-medium tabular-nums">{sessionSummary.totalAttempts}</dd></div>
            <div><dt className="text-muted-foreground">Unique contacts</dt><dd className="font-medium tabular-nums">{sessionSummary.uniqueContacts}</dd></div>
            <div><dt className="text-muted-foreground">Human conversations</dt><dd className="font-medium tabular-nums">{sessionSummary.humanConversations}</dd></div>
            <div><dt className="text-muted-foreground">Talk time</dt><dd className="font-medium tabular-nums">{formatDuration(sessionSummary.talkSec)}</dd></div>
            <div><dt className="text-muted-foreground">Session duration</dt><dd className="font-medium tabular-nums">{formatDuration(sessionSummary.sessionDurationSec)}</dd></div>
            <div><dt className="text-muted-foreground">Follow-ups</dt><dd className="font-medium tabular-nums">{sessionSummary.followUps}</dd></div>
            <div><dt className="text-muted-foreground">Remaining eligible</dt><dd className="font-medium tabular-nums">{sessionSummary.remainingEligible}</dd></div>
            <div><dt className="text-muted-foreground">Errors</dt><dd className="font-medium tabular-nums">{sessionSummary.errors}</dd></div>
          </dl>
          {Object.keys(sessionSummary.classifications).length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Answer classifications:{' '}
              {Object.entries(sessionSummary.classifications).map(([k, v]) => `${k} (${v})`).join(', ')}
            </p>
          )}
          {Object.keys(sessionSummary.dispositions).length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Dispositions: {Object.entries(sessionSummary.dispositions).map(([k, v]) => `${k} (${v})`).join(', ')}
            </p>
          )}
          <Button className="mt-3" variant="outline" onClick={() => setSummaryOpen(false)}>Close</Button>
        </Panel>
      )}
    </div>
  )
}
