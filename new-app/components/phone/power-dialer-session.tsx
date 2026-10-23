'use client'

import Link from 'next/link'
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
  fetchContactCampaignHistory,
  fetchDialerPrep,
  fetchPowerCampaignDetail,
  fetchPowerCampaigns,
  fetchPowerSession,
  fetchPowerSessionSummary,
  fetchTransferTargets,
  patchPowerCampaign,
  savePowerCampaignDetail,
  powerSessionAction,
  savePowerAttemptOutcome,
  startPowerSession,
  transferPowerDialerAttempt,
  triggerVoicemailDrop,
  type PowerSessionSummaryDto,
  type PowerCampaignDto,
  type PowerSessionStateDto,
} from '@/lib/phone-api'
import { formatPhone, formatDuration, formatWhen } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DialerContactInlineEdit } from '@/components/phone/dialer-contact-inline-edit'
import { DialerAppointmentDialog } from '@/components/phone/dialer-appointment-dialog'

const DISPOSITIONS = ['Booked', 'Interested', 'Callback', 'No answer', 'Voicemail', 'Not interested', 'Wrong number', 'Do not call'] as const

function contactLabel(c: { firstName: string | null; lastName: string | null; phone: string }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
  return name || formatPhone(c.phone)
}

export function PowerDialerSessionWorkspace({
  initialCampaignId,
  initialFocusContactId,
}: { initialCampaignId?: string; initialFocusContactId?: string } = {}) {
  const {
    startCall,
    endCall,
    activeCall,
    webrtcStatus,
    toggleMute,
    toggleHold,
  } = useWorkspace()
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
  const [contactHistory, setContactHistory] = useState<{
    attempts: { disposition: string | null; notes: string | null; createdAt: string }[];
    callbacks: { scheduledAt: string; status: string; notes: string | null }[];
  } | null>(null)
  const [scriptText, setScriptText] = useState<string | null>(null)
  const [dispositionOptions, setDispositionOptions] = useState<string[]>([...DISPOSITIONS])
  const [voicemailDropReady, setVoicemailDropReady] = useState(false)
  const [appointmentOpen, setAppointmentOpen] = useState(false)
  const [contactCard, setContactCard] = useState<{
    refresherNotes?: string | null
    href: string
    email?: string | null
    title?: string | null
    localTimeNote?: string | null
    deal?: { title: string; stage: string } | null
  } | null>(null)
  const [transferTargets, setTransferTargets] = useState<{ id: string; name: string; number: string }[]>([])
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferMode, setTransferMode] = useState<'cold' | 'warm' | 'three_way'>('cold')
  const [warmTransferPhase, setWarmTransferPhase] = useState<string | null>(null)
  const [callRating, setCallRating] = useState<number | null>(null)
  const [ratingsRequired, setRatingsRequired] = useState(false)
  const [sessionPresets, setSessionPresets] = useState<{ id: string; name: string; config: Record<string, unknown> }[]>([])
  const [presetName, setPresetName] = useState('')
  const autoDialLock = useRef(false)
  const [setupDetail, setSetupDetail] = useState<Awaited<ReturnType<typeof fetchPowerCampaignDetail>> | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupCallerId, setSetupCallerId] = useState('')
  const [setupDialingMode, setSetupDialingMode] = useState<'power' | 'preview'>('power')
  const [setupPhoneFields, setSetupPhoneFields] = useState('phone')
  const [metaLibraries, setMetaLibraries] = useState<{
    scripts: { id: string; name: string }[]
    dispositionSets: { id: string; name: string }[]
    vmDrops: { id: string; name: string }[]
  }>({ scripts: [], dispositionSets: [], vmDrops: [] })

  const sessionStatus = runtime?.session?.status ?? null
  const lead = runtime?.next ?? null
  const rules = runtime?.rules
  const progression = runtime?.progression
  const powerMode = rules?.dialingMode === 'power'
  const previewMode = rules?.dialingMode === 'preview'
  const upcoming = runtime?.upcomingQueue ?? []
  const queueContext = runtime?.queueContext
  const [addContactId, setAddContactId] = useState('')
  const [addQueueMessage, setAddQueueMessage] = useState<string | null>(null)

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
    void Promise.all([
      fetch('/api/phone/power-dialer/scripts').then((r) => r.json()),
      fetch('/api/phone/power-dialer/dispositions').then((r) => r.json()),
      fetch('/api/phone/power-dialer/voicemail-drops').then((r) => r.json()),
    ])
      .then(([scripts, sets, drops]) => {
        setMetaLibraries({
          scripts: scripts.data || [],
          dispositionSets: (sets.data || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })),
          vmDrops: drops.data || [],
        })
      })
      .catch(() => undefined)
  }, [campaignId, initialCampaignId])

  useEffect(() => {
    if (!campaignId || sessionId) {
      setSetupDetail(null)
      return
    }
    setSetupLoading(true)
    void fetchPowerCampaignDetail(campaignId)
      .then((d) => {
        setSetupDetail(d)
        setSetupCallerId(d.callerIdE164)
        setSetupDialingMode(d.rules.dialingMode === 'preview' ? 'preview' : 'power')
        setSetupPhoneFields((d.rules.phoneFieldPriority || ['phone']).join(', '))
      })
      .catch(() => toast.error('Could not load campaign setup'))
      .finally(() => setSetupLoading(false))
  }, [campaignId, sessionId])

  const leadContactId = runtime?.next?.contact.id

  useEffect(() => {
    if (!campaignId || !leadContactId) {
      setContactHistory(null)
      return
    }
    void fetchContactCampaignHistory(campaignId, leadContactId)
      .then(setContactHistory)
      .catch(() => undefined)
  }, [campaignId, leadContactId])

  useEffect(() => {
    if (!campaignId || !leadContactId) {
      setScriptText(null)
      setVoicemailDropReady(false)
      return
    }
    void fetchDialerPrep(campaignId, leadContactId)
      .then((prep) => {
        if (prep.dispositionLabels.length) setDispositionOptions(prep.dispositionLabels)
        setScriptText(prep.scriptRendered)
        setVoicemailDropReady(Boolean(prep.voicemailDropId))
        setContactCard((prep as { contactCard?: typeof contactCard }).contactCard ?? null)
      })
      .catch(() => undefined)
  }, [campaignId, leadContactId])

  useEffect(() => {
    void fetchTransferTargets().then(setTransferTargets).catch(() => undefined)
    void fetch('/api/phone/power-dialer/settings')
      .then((r) => r.json())
      .then((j) => setRatingsRequired(Boolean(j.data?.callRatingsEnabled)))
      .catch(() => undefined)
    void fetch('/api/phone/power-dialer/session-presets')
      .then((r) => r.json())
      .then((j) => setSessionPresets(j.data || []))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!sessionId) return
    void powerSessionAction(sessionId, 'reconcile').catch(() => undefined)
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
        }) as { id: string; dialedPhoneE164?: string | null }
        setAttemptId(attempt.id)
        const contact = lead.contact
        const dialNumber =
          attempt.dialedPhoneE164 ||
          (runtime?.next as { dialE164?: string } | undefined)?.dialE164 ||
          contact.phone
        const ok = startCall({
          name: contactLabel(contact),
          number: dialNumber,
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
    [sessionId, lead, startCall, runtime],
  )

  useEffect(() => {
    if (!sessionId) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'd' && !e.metaKey && !e.ctrlKey && lead && !onCall && !loading) {
        e.preventDefault()
        void dialLead(lead.contact.id, lead.attemptNumber, `pd-hotkey-${Date.now()}`)
      }
      if (e.key === 'h' && onCall) {
        e.preventDefault()
        toggleHold()
      }
      if (e.key === 'm' && onCall) {
        e.preventDefault()
        toggleMute()
      }
      if (e.key === 'Escape' && onCall) {
        e.preventDefault()
        endCall()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sessionId, lead, onCall, loading, dialLead, toggleHold, toggleMute, endCall])

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
    if (!campaignId || !setupDetail) return
    if (!setupCallerId) {
      toast.error('Choose an outbound caller ID')
      return
    }
    if (setupEligible === 0) {
      toast.error('No eligible contacts — adjust campaign rules or list before starting')
      return
    }
    setLoading(true)
    try {
      const phoneFieldPriority = setupPhoneFields
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      await savePowerCampaignDetail(campaignId, {
        callerIdE164: setupCallerId,
        configJson: {
          dialingMode: setupDialingMode,
          phoneFieldPriority: phoneFieldPriority.length ? phoneFieldPriority : ['phone'],
        },
      })
      const session = await startPowerSession(campaignId, initialFocusContactId)
      await patchPowerCampaign(campaignId, { status: 'active' })
      setSessionId(session.id)
      if (setupDialingMode === 'preview') {
        await powerSessionAction(session.id, 'preview_held', { held: true })
      }
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
        callRating: ratingsRequired ? callRating : callRating ?? undefined,
      })
      setCallRating(null)
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
    const cfg = (c.configJson || {}) as { maxAttempts?: number; timezone?: string }
    return {
      name: c.name,
      callerId: c.callerIdE164,
      maxAttempts: rules?.totalAttemptCap ?? cfg.maxAttempts ?? 3,
      listName: c.list?.name,
      timezone: cfg.timezone ?? null,
    }
  }, [runtime, rules])

  const micBlocked = webrtcStatus !== 'ready'

  const setupEligible = setupDetail?.eligibility?.counts?.eligible ?? 0
  const activeNumbers = owned.filter((n) => n.status === 'active')

  const warnings: string[] = []
  if (micBlocked) warnings.push('Browser calling is not ready — check microphone permissions.')
  if (activeNumbers.length === 0) warnings.push('No active outbound number in Numbers — assign one before dialing.')
  if (!sessionId && setupDetail && setupEligible === 0) {
    warnings.push('No eligible contacts in this campaign right now — check calling hours, caps, and list membership.')
  }
  if (!sessionId && setupDetail?.status === 'paused') warnings.push('This campaign is paused — resume it or choose another.')
  if (sessionId && eligibleTotal === 0) warnings.push('No eligible contacts in this campaign right now.')

  const labelFor = (id: string | null | undefined, list: { id: string; name: string }[], fallback: string) =>
    (id && list.find((x) => x.id === id)?.name) || fallback

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
            <div className="flex max-w-lg flex-col gap-4">
              <SimpleSelect
                label="Campaign"
                value={campaignId}
                onChange={setCampaignId}
                options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
              />
              <SimpleSelect
                label="Session preset"
                value=""
                onChange={(id) => {
                  const p = sessionPresets.find((x) => x.id === id)
                  if (!p?.config) return
                  if (typeof p.config.campaignId === 'string') setCampaignId(p.config.campaignId)
                  if (p.config.dialingMode === 'preview' || p.config.dialingMode === 'power') {
                    setSetupDialingMode(p.config.dialingMode)
                  }
                  if (Array.isArray(p.config.phoneFieldPriority)) {
                    setSetupPhoneFields(p.config.phoneFieldPriority.join(', '))
                  }
                  toast.success(`Loaded preset “${p.name}”`)
                }}
                options={
                  sessionPresets.length
                    ? sessionPresets.map((p) => ({ value: p.id, label: p.name }))
                    : [{ value: '', label: 'No presets yet — save one below' }]
                }
              />
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-1 flex-col gap-1 text-sm">
                  <span className="font-medium">Save preset</span>
                  <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="My preview setup" />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!presetName.trim() || !campaignId}
                  onClick={() => {
                    void fetch('/api/phone/power-dialer/session-presets', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: presetName.trim(),
                        scope: 'user',
                        config: {
                          campaignId,
                          dialingMode: setupDialingMode,
                          phoneFieldPriority: setupPhoneFields.split(',').map((s) => s.trim()).filter(Boolean),
                        },
                      }),
                    })
                      .then((r) => r.json())
                      .then((j) => {
                        if (j.error) throw new Error(j.error)
                        toast.success('Preset saved')
                        setPresetName('')
                        setSessionPresets((prev) => [...prev, { id: j.data.id, name: presetName, config: j.data.configJson }])
                      })
                      .catch((e) => toast.error(e instanceof Error ? e.message : 'Save failed'))
                  }}
                >
                  Save
                </Button>
              </div>
              {setupLoading && <p className="text-xs text-muted-foreground">Loading campaign setup…</p>}
              {setupDetail && (
                <>
                  <SimpleSelect
                    label="Outbound caller ID"
                    value={setupCallerId}
                    onChange={setSetupCallerId}
                    options={activeNumbers.map((n) => ({
                      value: n.number,
                      label: `${n.nickname || 'Number'} (${formatPhone(n.number)})`,
                    }))}
                  />
                  <SimpleSelect
                    label="Dialing mode"
                    value={setupDialingMode}
                    onChange={(v) => setSetupDialingMode(v as 'power' | 'preview')}
                    options={[
                      { value: 'power', label: 'Power (auto-advance)' },
                      { value: 'preview', label: 'Preview (manual dial)' },
                    ]}
                  />
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium">Contact phone fields (priority, comma-separated)</span>
                    <Input
                      value={setupPhoneFields}
                      onChange={(e) => setSetupPhoneFields(e.target.value)}
                      aria-label="Phone field priority"
                    />
                  </label>
                  <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Script</dt>
                      <dd>{labelFor(setupDetail.extended.scriptId, metaLibraries.scripts, 'None')}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Disposition set</dt>
                      <dd>{labelFor(setupDetail.extended.dispositionSetId, metaLibraries.dispositionSets, 'Workspace default')}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Voicemail drop</dt>
                      <dd>{labelFor(setupDetail.extended.voicemailDropId, metaLibraries.vmDrops, 'None')}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Recording</dt>
                      <dd>{setupDetail.extended.recordingEnabled === false ? 'Off for campaign' : 'On (workspace default)'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Call screening</dt>
                      <dd>{setupDetail.extended.screeningMode || 'Workspace default'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Eligible contacts</dt>
                      <dd className="font-medium tabular-nums">
                        {setupEligible}
                        {setupDetail.eligibility.truncated ? ' (estimate — large list)' : ''}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Calling window</dt>
                      <dd>
                        {setupDetail.rules.callingHoursStart}–{setupDetail.rules.callingHoursEnd} ({setupDetail.timezone})
                      </dd>
                    </div>
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    Change script, dispositions, or voicemail drop under{' '}
                    <a href="/app/power-dialer/campaigns" className="text-primary hover:underline">Campaigns</a>.
                  </p>
                </>
              )}
              <Button
                onClick={() => void startSession()}
                disabled={!campaignId || !setupDetail || loading || micBlocked || setupEligible === 0}
              >
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

            {queueContext && (
              <div className="mb-4 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <p>
                  Active list: <span className="font-medium text-foreground">{queueContext.activeListName}</span>
                  {queueContext.waterfallReason === 'primary_exhausted' && (
                    <span> — primary list has no eligible contacts; using standby list</span>
                  )}
                  {queueContext.teamQueueMode && queueContext.teamQueueMode !== 'shared' && (
                    <span> · Team queue: {queueContext.teamQueueMode.replace('_', ' ')}</span>
                  )}
                </p>
              </div>
            )}

            {sessionId && (
              <div className="mb-4 flex flex-wrap items-end gap-2">
                <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs">
                  <span className="font-medium text-foreground">Add contact to live queue</span>
                  <Input
                    placeholder="Contact ID"
                    value={addContactId}
                    onChange={(e) => setAddContactId(e.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!addContactId.trim()) return
                    void fetch(`/api/phone/power-dialer/sessions/${sessionId}/contact-actions`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'add_to_queue', contactId: addContactId.trim() }),
                    })
                      .then(async (r) => {
                        const j = await r.json()
                        const msg =
                          j.data?.message ||
                          j.error ||
                          (j.data?.eligible ? 'Added' : 'Added but not eligible yet')
                        setAddQueueMessage(msg)
                        if (j.data?.ok) void refreshSession(sessionId)
                      })
                      .catch(() => setAddQueueMessage('Could not add contact'))
                  }}
                >
                  Add to queue
                </Button>
                {addQueueMessage && <span className="text-xs text-muted-foreground">{addQueueMessage}</span>}
              </div>
            )}

            {lead ? (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xl font-semibold">{contactLabel(lead.contact)}</span>
                    <span className="font-mono text-sm text-muted-foreground">{formatPhone(lead.contact.phone)}</span>
                    {lead.contact.company && <span className="text-xs text-muted-foreground">{lead.contact.company}</span>}
                    {contactCard && (
                      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {contactCard.title && <p>{contactCard.title}</p>}
                        {contactCard.email && <p>{contactCard.email}</p>}
                        {contactCard.refresherNotes && <p>Refresher: {contactCard.refresherNotes}</p>}
                        {contactCard.localTimeNote && <p>{contactCard.localTimeNote}</p>}
                        {contactCard.deal && (
                          <p>Deal: {contactCard.deal.title} · {contactCard.deal.stage}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Link href={contactCard.href} className="text-primary underline-offset-2 hover:underline">
                            Open contact record
                          </Link>
                          <button
                            type="button"
                            className="text-primary underline-offset-2 hover:underline"
                            onClick={() => setAppointmentOpen(true)}
                          >
                            Schedule appointment
                          </button>
                        </div>
                        <DialerContactInlineEdit
                          contactId={lead.contact.id}
                          title={contactCard.title ?? null}
                          email={contactCard.email ?? null}
                          customFields={
                            lead.contact.customFields && typeof lead.contact.customFields === 'object'
                              ? (lead.contact.customFields as Record<string, unknown>)
                              : null
                          }
                          onSaved={() => {
                            if (campaignId && lead.contact.id) {
                              void fetchDialerPrep(campaignId, lead.contact.id).then((prep) => {
                                setContactCard((prep as { contactCard?: typeof contactCard }).contactCard ?? null)
                              })
                            }
                          }}
                        />
                      </div>
                    )}
                    <DialerAppointmentDialog
                      open={appointmentOpen}
                      onOpenChange={setAppointmentOpen}
                      contactId={lead.contact.id}
                      contactName={contactLabel(lead.contact)}
                      defaultTimezone={lead.contact.timezone || campaignMeta?.timezone || undefined}
                    />
                    {lead.contact.customFields && typeof lead.contact.customFields === 'object' && (
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {Object.entries(lead.contact.customFields as Record<string, unknown>).slice(0, 6).map(([k, v]) => (
                          <li key={k}><span className="font-medium text-foreground">{k}:</span> {String(v)}</li>
                        ))}
                      </ul>
                    )}
                    {contactHistory && (
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground" aria-label="Campaign history">
                        {contactHistory.attempts.slice(0, 6).map((a, i) => (
                          <li key={i}>
                            Attempt: {a.disposition || '—'} · {formatWhen(a.createdAt)}
                            {a.notes ? ` — ${a.notes}` : ''}
                          </li>
                        ))}
                        {contactHistory.callbacks.slice(0, 3).map((c, i) => (
                          <li key={`cb-${i}`}>
                            Callback {c.status}: {formatWhen(c.scheduledAt)}
                            {c.notes ? ` — ${c.notes}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                    {scriptText && (
                      <p className="mt-3 rounded-md border bg-muted/40 p-2 text-xs whitespace-pre-wrap">{scriptText}</p>
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
                    {(!powerMode || previewMode) && (
                      <Button
                        size="sm"
                        className="bg-success text-success-foreground hover:bg-success/90"
                        disabled={onCall || loading || paused || progression?.phase === 'awaiting_disposition'}
                        onClick={() => {
                          if (previewMode && sessionId) {
                            void powerSessionAction(sessionId, 'preview_held', { held: false })
                          }
                          void dialLead(lead.contact.id, lead.attemptNumber, `pd-manual-${lead.contact.id}-${Date.now()}`)
                        }}
                      >
                        <Phone />
                        {previewMode ? 'Preview dial' : 'Call'}
                      </Button>
                    )}
                    {onCall && (
                      <>
                        <Button size="sm" variant="outline" type="button" onClick={() => toggleMute()}>
                          {activeCall?.muted ? 'Unmute' : 'Mute'}
                        </Button>
                        <Button size="sm" variant="outline" type="button" onClick={() => toggleHold()}>
                          {activeCall?.onHold ? 'Resume' : 'Hold'}
                        </Button>
                      </>
                    )}
                    {onCall && attemptId && voicemailDropReady && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => {
                          void triggerVoicemailDrop(attemptId)
                            .then(() => {
                              toast.success('Voicemail drop playing — disposition when playback completes')
                            })
                            .catch((e) => toast.error(e instanceof Error ? e.message : 'Voicemail drop failed'))
                        }}
                      >
                        Voicemail drop
                      </Button>
                    )}
                    {onCall && attemptId && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => {
                          void fetch(`/api/phone/power-dialer/attempts/${attemptId}/live-voicemail`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                          })
                            .then(async (r) => {
                              const j = await r.json()
                              if (!r.ok) throw new Error(j.error || 'Failed')
                              toast.success(j.data?.message || 'Live voicemail — speak after the beep')
                            })
                            .catch((e) => toast.error(e instanceof Error ? e.message : 'Live voicemail failed'))
                        }}
                      >
                        Live voicemail
                      </Button>
                    )}
                    {onCall && attemptId && transferTargets.length > 0 && (
                      <>
                        <SimpleSelect
                          label="Transfer type"
                          value={transferMode}
                          onChange={(v) => setTransferMode(v as 'cold' | 'warm' | 'three_way')}
                          options={[
                            { value: 'cold', label: 'Cold transfer' },
                            { value: 'warm', label: 'Warm transfer' },
                            { value: 'three_way', label: '3-way conference' },
                          ]}
                          className="min-w-[140px]"
                        />
                        <SimpleSelect
                          label="Transfer target"
                          value={transferTargetId || transferTargets[0]?.id || ''}
                          onChange={setTransferTargetId}
                          options={transferTargets.map((t) => ({ value: t.id, label: t.name }))}
                          className="min-w-[140px]"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!transferTargetId || loading || !attemptId}
                          onClick={() => {
                            const target = transferTargets.find((t) => t.id === transferTargetId)
                            if (!target || !attemptId) return
                            void transferPowerDialerAttempt(attemptId, {
                              to: target.number,
                              mode: transferMode,
                              action: 'start',
                            })
                              .then((data: { phase?: string }) => {
                                setWarmTransferPhase(data?.phase || null)
                                toast.success(
                                  transferMode === 'cold'
                                    ? `Transferred to ${target.name}`
                                    : `Transfer ${data?.phase || 'started'} — ${target.name}`,
                                )
                              })
                              .catch((e) => toast.error(e instanceof Error ? e.message : 'Transfer failed'))
                          }}
                        >
                          {transferMode === 'cold' ? 'Transfer' : 'Start transfer'}
                        </Button>
                        {warmTransferPhase === 'announcing' || warmTransferPhase === 'consulting' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={loading || !attemptId}
                              onClick={() => {
                                void transferPowerDialerAttempt(attemptId, { to: '', action: 'complete' })
                                  .then(() => {
                                    setWarmTransferPhase('completed')
                                    toast.success('Warm transfer completed')
                                  })
                                  .catch((e) => toast.error(e instanceof Error ? e.message : 'Complete failed'))
                              }}
                            >
                              Complete warm transfer
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={loading || !attemptId}
                              onClick={() => {
                                void transferPowerDialerAttempt(attemptId, { to: '', action: 'cancel' })
                                  .then(() => {
                                    setWarmTransferPhase(null)
                                    toast.success('Transfer cancelled')
                                  })
                                  .catch((e) => toast.error(e instanceof Error ? e.message : 'Cancel failed'))
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : null}
                      </>
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
                    {dispositionOptions.map((d) => (
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
                {ratingsRequired && (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="text-sm font-medium">Call rating</legend>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={callRating === n}
                          className={cn(
                            'rounded-md border px-3 py-1 text-sm',
                            callRating === n ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                          )}
                          onClick={() => setCallRating(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
                <Button
                  className="self-end"
                  disabled={!disposition || !attemptId || loading || (ratingsRequired && !callRating)}
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

      {sessionId && upcoming.length > 0 && (
        <Panel title="Upcoming in queue" className="lg:col-span-3">
          <ul className="divide-y text-sm">
            {upcoming.map((u) => (
              <li key={u.contactId} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate">
                  {[u.firstName, u.lastName].filter(Boolean).join(' ') || formatPhone(u.phone)}
                  {u.company ? ` · ${u.company}` : ''}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() =>
                    void powerSessionAction(sessionId, 'skip_contact', { contactId: u.contactId }).then(() =>
                      refreshSession(sessionId),
                    )
                  }
                >
                  Skip
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

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
