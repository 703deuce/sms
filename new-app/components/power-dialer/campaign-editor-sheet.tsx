'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SimpleSelect } from '@/components/app/filters'
import { useNumbers } from '@/components/providers/numbers-provider'
import { COMMON_IANA_TIMEZONES } from '@/lib/phone/common-timezones'
import {
  createPowerCampaign,
  fetchPowerCampaignDetail,
  fetchPowerLists,
  savePowerCampaignDetail,
  type PowerListDto,
} from '@/lib/phone-api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId: string | null
  onSaved: () => void
}

export function CampaignEditorSheet({ open, onOpenChange, campaignId, onSaved }: Props) {
  const { owned } = useNumbers()
  const [lists, setLists] = useState<PowerListDto[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [listId, setListId] = useState('')
  const [callerId, setCallerId] = useState('')
  const [timezone, setTimezone] = useState('America/Chicago')
  const [dialingMode, setDialingMode] = useState('power')
  const [ringTimeoutSeconds, setRingTimeoutSeconds] = useState(30)
  const [retryIntervalMinutes, setRetryIntervalMinutes] = useState(60)
  const [dailyAttemptCap, setDailyAttemptCap] = useState(50)
  const [totalAttemptCap, setTotalAttemptCap] = useState(3)
  const [postCallIntervalSeconds, setPostCallIntervalSeconds] = useState(5)
  const [requireDisposition, setRequireDisposition] = useState(true)
  const [callingHoursStart, setCallingHoursStart] = useState('09:00')
  const [callingHoursEnd, setCallingHoursEnd] = useState('17:00')
  const [leadSource, setLeadSource] = useState('')
  const [duplicateBehavior, setDuplicateBehavior] = useState('add_to_list')
  const [memberUserIds, setMemberUserIds] = useState<string[]>([])
  const [dispositionSetId, setDispositionSetId] = useState('')
  const [scriptId, setScriptId] = useState('')
  const [voicemailDropId, setVoicemailDropId] = useState('')
  const [workspaceMembers, setWorkspaceMembers] = useState<{ userId: string; name: string }[]>([])
  const [dispositionSets, setDispositionSets] = useState<{ id: string; name: string }[]>([])
  const [scripts, setScripts] = useState<{ id: string; name: string }[]>([])
  const [vmDrops, setVmDrops] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [allowedDays, setAllowedDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [retryScheduleMinutes, setRetryScheduleMinutes] = useState('')
  const [dialOrder, setDialOrder] = useState('fifo')
  const [jurisdictionPreset, setJurisdictionPreset] = useState('none')
  const [leadOwnerRouting, setLeadOwnerRouting] = useState('off')
  const [callbackExemptFromRetryDelay, setCallbackExemptFromRetryDelay] = useState(false)
  const [allowedAreaCodes, setAllowedAreaCodes] = useState('')
  const [blockedAreaCodes, setBlockedAreaCodes] = useState('')
  const [scheduleBreaks, setScheduleBreaks] = useState('')
  const [teamQueueMode, setTeamQueueMode] = useState('shared')
  const [callbackRoutingMode, setCallbackRoutingMode] = useState('same_rep')
  const [callbackRoutingE164, setCallbackRoutingE164] = useState('')
  const [callerIdRotationMode, setCallerIdRotationMode] = useState('sticky')
  const [numberPoolDailyCap, setNumberPoolDailyCap] = useState(200)
  const [callerIdPoolNumberIds, setCallerIdPoolNumberIds] = useState<string[]>([])
  const [liveAnswerDispositionSetId, setLiveAnswerDispositionSetId] = useState('')
  const [noAnswerDispositionSetId, setNoAnswerDispositionSetId] = useState('')
  const [requireExplicitConsent, setRequireExplicitConsent] = useState(false)
  const [recordingEnabled, setRecordingEnabled] = useState(true)
  const [parallelLines, setParallelLines] = useState(3)
  const [abandonRateTargetPct, setAbandonRateTargetPct] = useState(3)
  const [pacingAggression, setPacingAggression] = useState(1)
  const [amdFilterMachines, setAmdFilterMachines] = useState(true)
  const [dialModeOptions, setDialModeOptions] = useState<{ value: string; label: string; disabled?: boolean; hint?: string }[]>([
    { value: 'power', label: 'Power (progressive)' },
    { value: 'preview', label: 'Preview (manual)' },
  ])

  useEffect(() => {
    if (!open) return
    void fetchPowerLists().then(setLists).catch(() => undefined)
    void fetch('/api/phone/power-dialer/workspace-members').then((r) => r.json()).then((j) => setWorkspaceMembers(j.data || [])).catch(() => undefined)
    void fetch('/api/phone/power-dialer/dispositions').then((r) => r.json()).then((j) => setDispositionSets((j.data || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })))).catch(() => undefined)
    void fetch('/api/phone/power-dialer/scripts').then((r) => r.json()).then((j) => setScripts(j.data || [])).catch(() => undefined)
    void fetch('/api/phone/power-dialer/voicemail-drops').then((r) => r.json()).then((j) => setVmDrops(j.data || [])).catch(() => undefined)
    void fetch('/api/phone/power-dialer/dial-modes')
      .then((r) => r.json())
      .then((j) => {
        const modes = (j.data?.modes || []) as { id: string; label: string; selectable: boolean; userMessage?: string }[]
        if (modes.length) {
          setDialModeOptions(
            modes.map((m) => ({
              value: m.id,
              label: m.label,
              disabled: !m.selectable,
              hint: m.selectable ? undefined : m.userMessage,
            })),
          )
        }
      })
      .catch(() => undefined)
    const active = owned.find((n) => n.status === 'active')
    if (active && !callerId) setCallerId(active.number)
  }, [open, owned, callerId])

  useEffect(() => {
    if (!open || !campaignId) return
    void fetchPowerCampaignDetail(campaignId)
      .then((d) => {
        setName(d.name)
        setDescription(d.description || '')
        setListId(d.listId)
        setCallerId(d.callerIdE164)
        setTimezone(d.timezone)
        setDialingMode(d.rules.dialingMode)
        setRingTimeoutSeconds(d.rules.ringTimeoutSeconds)
        setRetryIntervalMinutes(d.rules.retryIntervalMinutes)
        setDailyAttemptCap(d.rules.dailyAttemptCap)
        setTotalAttemptCap(d.rules.totalAttemptCap)
        setPostCallIntervalSeconds(d.rules.postCallIntervalSeconds)
        setRequireDisposition(d.rules.requireDispositionBeforeNext)
        setCallingHoursStart(d.rules.callingHoursStart)
        setCallingHoursEnd(d.rules.callingHoursEnd)
        setLeadSource(d.extended.leadSource || '')
        setDuplicateBehavior(d.extended.duplicateBehavior || 'add_to_list')
        setMemberUserIds(d.extended.memberUserIds || [])
        setDispositionSetId(d.extended.dispositionSetId || '')
        setScriptId(d.extended.scriptId || '')
        setVoicemailDropId(d.extended.voicemailDropId || '')
        const full = d as typeof d & {
          rules: { allowedDays?: number[]; retryIntervalMinutes?: number; dailyAttemptCap?: number; totalAttemptCap?: number; postCallIntervalSeconds?: number };
          configJson?: Record<string, unknown>;
          extended: { leadOwnerRouting?: string };
        }
        setAllowedDays(full.rules.allowedDays?.length ? full.rules.allowedDays : [1, 2, 3, 4, 5])
        const cj = full.configJson || {}
        setRetryScheduleMinutes(Array.isArray(cj.retryScheduleMinutes) ? (cj.retryScheduleMinutes as number[]).join(',') : '')
        setDialOrder(String(cj.dialOrder || 'fifo'))
        setJurisdictionPreset(String(cj.jurisdictionPreset || 'none'))
        setLeadOwnerRouting(String(cj.leadOwnerRouting || full.extended.leadOwnerRouting || 'off'))
        setCallbackExemptFromRetryDelay(Boolean(cj.callbackExemptFromRetryDelay))
        setAllowedAreaCodes(Array.isArray(cj.allowedAreaCodes) ? (cj.allowedAreaCodes as string[]).join(',') : '')
        setBlockedAreaCodes(Array.isArray(cj.blockedAreaCodes) ? (cj.blockedAreaCodes as string[]).join(',') : '')
        setTeamQueueMode(String(cj.teamQueueMode || 'shared'))
        setCallbackRoutingMode(String(cj.callbackRoutingMode || 'same_rep'))
        setCallbackRoutingE164(String(cj.callbackRoutingE164 || ''))
        setCallerIdRotationMode(String(cj.callerIdRotationMode || 'sticky'))
        setNumberPoolDailyCap(typeof cj.numberPoolDailyCap === 'number' ? cj.numberPoolDailyCap : 200)
        setCallerIdPoolNumberIds(Array.isArray(cj.callerIdPoolNumberIds) ? (cj.callerIdPoolNumberIds as string[]) : [])
        setLiveAnswerDispositionSetId(String(cj.liveAnswerDispositionSetId || ''))
        setNoAnswerDispositionSetId(String(cj.noAnswerDispositionSetId || ''))
        setRequireExplicitConsent(Boolean(cj.requireExplicitConsent))
        setRecordingEnabled(cj.recordingEnabled !== false)
        const dm = (cj.dialMode || {}) as Record<string, unknown>
        if (typeof dm.parallelLines === 'number') setParallelLines(dm.parallelLines)
        if (typeof dm.abandonRateTargetPct === 'number') setAbandonRateTargetPct(dm.abandonRateTargetPct)
        if (typeof dm.pacingAggression === 'number') setPacingAggression(dm.pacingAggression)
        if (typeof dm.amdFilterMachines === 'boolean') setAmdFilterMachines(dm.amdFilterMachines)
        if (Array.isArray(cj.scheduleBreaks)) {
          setScheduleBreaks(
            (cj.scheduleBreaks as { startHm: string; endHm: string }[])
              .map((b) => `${b.startHm}-${b.endHm}`)
              .join(','),
          )
        }
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load campaign'))
  }, [open, campaignId])

  const save = async () => {
    const errors: Record<string, string> = {}
    if (!name.trim()) errors.name = 'Campaign name is required'
    if (!listId) errors.listId = 'Choose a calling list or create one first'
    if (!callerId) errors.callerId = 'Outbound caller ID is required'
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      toast.error('Fix the highlighted fields')
      return
    }
    setSaving(true)
    try {
      const parseBreaks = () =>
        scheduleBreaks
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((pair) => {
            const [startHm, endHm] = pair.split('-')
            return startHm && endHm ? { startHm, endHm } : null
          })
          .filter(Boolean) as { startHm: string; endHm: string }[]
      const configJson = {
        leadSource,
        duplicateBehavior,
        dialingMode,
        ringTimeoutSeconds,
        retryIntervalMinutes,
        dailyAttemptCap,
        totalAttemptCap,
        postCallIntervalSeconds,
        requireDispositionBeforeNext: requireDisposition,
        callingHoursStart,
        callingHoursEnd,
        allowedDays,
        memberUserIds,
        scriptId: scriptId || null,
        voicemailDropId: voicemailDropId || null,
        dispositionSetId: dispositionSetId || null,
        retryScheduleMinutes: retryScheduleMinutes
          ? retryScheduleMinutes.split(',').map((n) => Number(n.trim())).filter((n) => !Number.isNaN(n))
          : undefined,
        dialOrder,
        jurisdictionPreset,
        leadOwnerRouting,
        callbackExemptFromRetryDelay,
        teamQueueMode,
        allowedAreaCodes: allowedAreaCodes ? allowedAreaCodes.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        blockedAreaCodes: blockedAreaCodes ? blockedAreaCodes.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        scheduleBreaks: parseBreaks().length ? parseBreaks() : undefined,
        callbackRoutingMode,
        callbackRoutingE164: callbackRoutingE164 || undefined,
        callerIdRotationMode,
        numberPoolDailyCap,
        callerIdPoolNumberIds: callerIdPoolNumberIds.length ? callerIdPoolNumberIds : undefined,
        liveAnswerDispositionSetId: liveAnswerDispositionSetId || null,
        noAnswerDispositionSetId: noAnswerDispositionSetId || null,
        requireExplicitConsent,
        recordingEnabled,
        dialMode: {
          parallelLines,
          abandonRateTargetPct,
          pacingAggression,
          amdFilterMachines,
          ringTimeoutSeconds,
        },
      }
      if (campaignId) {
        await savePowerCampaignDetail(campaignId, {
          name,
          description,
          listId,
          callerIdE164: callerId,
          timezone,
          configJson,
        })
      } else {
        await createPowerCampaign({
          name,
          description,
          listId,
          callerIdE164: callerId,
          timezone,
          configJson,
        })
      }
      toast.success('Campaign saved')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-lg overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{campaignId ? 'Edit campaign' : 'New campaign'}</SheetTitle>
        </SheetHeader>
        <Tabs defaultValue="general" className="mt-4 gap-4">
          <div className="-mx-1 overflow-x-auto pb-1">
            <TabsList className="inline-flex h-auto w-max flex-nowrap">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="dialing">Dialing rules</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="caller">Caller ID</TabsTrigger>
            <TabsTrigger value="handling">Call handling</TabsTrigger>
            <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
          </TabsList>
          </div>
          <TabsContent value="general" className="flex flex-col gap-3">
            <div>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" aria-label="Campaign name" />
              {fieldErrors.name && <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p>}
            </div>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} />
            <SimpleSelect label="Timezone" value={timezone} onChange={setTimezone} options={COMMON_IANA_TIMEZONES.map((z) => ({ value: z.value, label: z.label }))} />
          </TabsContent>
          <TabsContent value="contacts" className="flex flex-col gap-3">
            {lists.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No calling lists yet.{' '}
                <Link href="/app/power-dialer/lists" className="text-primary hover:underline">Create or import a list</Link>
                {' '}before saving this campaign.
              </p>
            ) : (
              <div>
                <SimpleSelect label="Calling list" value={listId} onChange={setListId} options={lists.map((l) => ({ value: l.id, label: l.name }))} />
                {fieldErrors.listId && <p className="mt-1 text-xs text-destructive">{fieldErrors.listId}</p>}
              </div>
            )}
            <Input value={leadSource} onChange={(e) => setLeadSource(e.target.value)} placeholder="Lead source label" />
            <SimpleSelect
              label="Duplicate behavior (imports)"
              value={duplicateBehavior}
              onChange={setDuplicateBehavior}
              options={[
                { value: 'skip', label: 'Skip duplicates' },
                { value: 'update', label: 'Update existing contact' },
                { value: 'add_to_list', label: 'Add existing to list' },
              ]}
            />
          </TabsContent>
          <TabsContent value="dialing" className="flex flex-col gap-3">
            <SimpleSelect
              label="Dial mode"
              value={dialingMode}
              onChange={setDialingMode}
              options={dialModeOptions.map((o) => ({
                value: o.value,
                label: o.disabled ? `${o.label} (locked)` : o.label,
              }))}
            />
            {dialModeOptions.find((o) => o.value === dialingMode && o.disabled)?.hint && (
              <p className="text-xs text-muted-foreground" role="status">
                {dialModeOptions.find((o) => o.value === dialingMode)?.hint}
              </p>
            )}
            {(dialingMode === 'parallel' || dialingMode === 'parallel_amd' || dialingMode === 'predictive') && (
              <>
                <label className="text-sm">Lines per agent (2–5)
                  <Input type="number" min={2} max={5} value={parallelLines} onChange={(e) => setParallelLines(Number(e.target.value))} />
                </label>
                <label className="text-sm">Abandon-rate target (%)
                  <Input type="number" min={0.5} max={10} step={0.1} value={abandonRateTargetPct} onChange={(e) => setAbandonRateTargetPct(Number(e.target.value))} />
                </label>
                <label className="text-sm">Pacing aggression
                  <Input type="number" min={0.25} max={3} step={0.25} value={pacingAggression} onChange={(e) => setPacingAggression(Number(e.target.value))} />
                </label>
                {dialingMode === 'parallel_amd' && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={amdFilterMachines} onChange={(e) => setAmdFilterMachines(e.target.checked)} />
                    Filter machines (AMD) before bridging
                  </label>
                )}
                <p className="text-xs text-muted-foreground">
                  Parallel and predictive modes require administrator enablement. Safety caps and kill switch cannot be disabled from this screen.
                </p>
              </>
            )}
            <label className="text-sm">Ring timeout (seconds)
              <Input type="number" min={10} max={120} value={ringTimeoutSeconds} onChange={(e) => setRingTimeoutSeconds(Number(e.target.value))} />
            </label>
            <label className="text-sm">Retry interval (minutes)
              <Input type="number" min={0} value={retryIntervalMinutes} onChange={(e) => setRetryIntervalMinutes(Number(e.target.value))} />
            </label>
            <label className="text-sm">Multi-step retry (minutes, comma-separated)
              <Input value={retryScheduleMinutes} onChange={(e) => setRetryScheduleMinutes(e.target.value)} placeholder="60,120,240" />
            </label>
            <SimpleSelect
              label="Dial order"
              value={dialOrder}
              onChange={setDialOrder}
              options={[
                { value: 'fifo', label: 'FIFO (oldest first)' },
                { value: 'lifo', label: 'LIFO (newest first)' },
                { value: 'priority', label: 'Priority field' },
              ]}
            />
            <SimpleSelect
              label="Lead owner routing"
              value={leadOwnerRouting}
              onChange={setLeadOwnerRouting}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'assigned_only', label: 'Assigned rep only' },
                { value: 'allow_cross_rep', label: 'Allow cross-rep' },
              ]}
            />
            <SimpleSelect
              label="Team queue mode"
              value={teamQueueMode}
              onChange={setTeamQueueMode}
              options={[
                { value: 'shared', label: 'Shared queue' },
                { value: 'round_robin', label: 'Round robin' },
                { value: 'pull', label: 'Pull / preview' },
                { value: 'dynamic', label: 'Dynamic assignment' },
              ]}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={callbackExemptFromRetryDelay} onChange={(e) => setCallbackExemptFromRetryDelay(e.target.checked)} />
              Callbacks exempt from retry cooldown (still respect DNC/hours)
            </label>
            <label className="text-sm">Allowed area codes (comma)
              <Input value={allowedAreaCodes} onChange={(e) => setAllowedAreaCodes(e.target.value)} placeholder="312,773" />
            </label>
            <label className="text-sm">Blocked area codes (comma)
              <Input value={blockedAreaCodes} onChange={(e) => setBlockedAreaCodes(e.target.value)} />
            </label>
            <label className="text-sm">Daily attempt cap
              <Input type="number" min={1} value={dailyAttemptCap} onChange={(e) => setDailyAttemptCap(Number(e.target.value))} />
            </label>
            <label className="text-sm">Total attempt cap
              <Input type="number" min={1} value={totalAttemptCap} onChange={(e) => setTotalAttemptCap(Number(e.target.value))} />
            </label>
            <label className="text-sm">Post-call interval (seconds)
              <Input type="number" min={0} value={postCallIntervalSeconds} onChange={(e) => setPostCallIntervalSeconds(Number(e.target.value))} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={requireDisposition} onChange={(e) => setRequireDisposition(e.target.checked)} />
              Require disposition before next call
            </label>
          </TabsContent>
          <TabsContent value="schedule" className="flex flex-col gap-3">
            <fieldset className="text-sm">
              <legend className="mb-1 font-medium">Allowed days</legend>
              {[
                { v: 0, l: 'Sun' },
                { v: 1, l: 'Mon' },
                { v: 2, l: 'Tue' },
                { v: 3, l: 'Wed' },
                { v: 4, l: 'Thu' },
                { v: 5, l: 'Fri' },
                { v: 6, l: 'Sat' },
              ].map((d) => (
                <label key={d.v} className="mr-3 inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={allowedDays.includes(d.v)}
                    onChange={(e) => {
                      setAllowedDays((prev) =>
                        e.target.checked ? [...prev, d.v].sort() : prev.filter((x) => x !== d.v),
                      )
                    }}
                  />
                  {d.l}
                </label>
              ))}
            </fieldset>
            <label className="text-sm">Calling hours start
              <Input value={callingHoursStart} onChange={(e) => setCallingHoursStart(e.target.value)} placeholder="09:00" />
            </label>
            <label className="text-sm">Calling hours end
              <Input value={callingHoursEnd} onChange={(e) => setCallingHoursEnd(e.target.value)} placeholder="17:00" />
            </label>
            <label className="text-sm">Break windows (e.g. 12:00-13:00)
              <Input value={scheduleBreaks} onChange={(e) => setScheduleBreaks(e.target.value)} placeholder="12:00-13:00" />
            </label>
            <SimpleSelect
              label="Jurisdiction preset"
              value={jurisdictionPreset}
              onChange={setJurisdictionPreset}
              options={[
                { value: 'none', label: 'Campaign hours only' },
                { value: 'us_ftc_consumer', label: 'US FTC consumer (8am–9pm local)' },
                { value: 'custom', label: 'Custom legal window' },
              ]}
            />
            <p className="text-xs text-muted-foreground">Contact local timezone is used when set on the contact; otherwise campaign timezone applies.</p>
          </TabsContent>
          <TabsContent value="caller" className="flex flex-col gap-3">
            <div>
              <SimpleSelect
                label="Default outbound caller ID"
                value={callerId}
                onChange={setCallerId}
                options={owned.filter((n) => n.status === 'active').map((n) => ({ value: n.number, label: n.nickname || n.number }))}
              />
              {fieldErrors.callerId && <p className="mt-1 text-xs text-destructive">{fieldErrors.callerId}</p>}
            </div>
            <SimpleSelect
              label="Caller ID rotation"
              value={callerIdRotationMode}
              onChange={setCallerIdRotationMode}
              options={[
                { value: 'sticky', label: 'Sticky (default number)' },
                { value: 'rotate', label: 'Rotate owned pool' },
                { value: 'local_presence', label: 'Local presence (match area code when possible)' },
              ]}
            />
            <label className="text-sm">Per-number daily dial cap (pool)
              <Input type="number" min={1} max={10000} value={numberPoolDailyCap} onChange={(e) => setNumberPoolDailyCap(Number(e.target.value))} />
            </label>
            <fieldset className="text-sm">
              <legend className="mb-1 font-medium">Number pool (owned lines)</legend>
              <p className="mb-2 text-xs text-muted-foreground">Assign only numbers you own. Rotation is for legitimate outreach — not rapid label evasion.</p>
              <ul className="max-h-40 space-y-1 overflow-auto rounded border p-2">
                {owned.filter((n) => n.status === 'active').map((n) => (
                  <li key={n.id}>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={callerIdPoolNumberIds.includes(n.id)}
                        onChange={(e) => {
                          setCallerIdPoolNumberIds((prev) =>
                            e.target.checked ? [...prev, n.id] : prev.filter((id) => id !== n.id),
                          )
                        }}
                      />
                      {n.nickname || n.number}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <Link href="/app/numbers" className="text-xs text-primary hover:underline">Purchase or assign numbers</Link>
          </TabsContent>
          <TabsContent value="handling" className="flex flex-col gap-3">
            <SimpleSelect label="Script" value={scriptId} onChange={setScriptId} options={[{ value: '', label: 'None' }, ...scripts.map((s) => ({ value: s.id, label: s.name }))]} />
            <SimpleSelect label="Voicemail drop" value={voicemailDropId} onChange={setVoicemailDropId} options={[{ value: '', label: 'None' }, ...vmDrops.map((s) => ({ value: s.id, label: s.name }))]} />
            <p className="text-xs text-muted-foreground">Voicemail drops require admin compliance opt-in under Settings → Voicemail drops.</p>
          </TabsContent>
          <TabsContent value="outcomes" className="flex flex-col gap-3">
            <SimpleSelect
              label="Disposition set (fallback)"
              value={dispositionSetId}
              onChange={setDispositionSetId}
              options={[{ value: '', label: 'Workspace default' }, ...dispositionSets.map((s) => ({ value: s.id, label: s.name }))]}
            />
            <SimpleSelect
              label="Live-answer disposition set"
              value={liveAnswerDispositionSetId}
              onChange={setLiveAnswerDispositionSetId}
              options={[{ value: '', label: 'Same as fallback' }, ...dispositionSets.map((s) => ({ value: s.id, label: s.name }))]}
            />
            <SimpleSelect
              label="No-answer disposition set"
              value={noAnswerDispositionSetId}
              onChange={setNoAnswerDispositionSetId}
              options={[{ value: '', label: 'Same as fallback' }, ...dispositionSets.map((s) => ({ value: s.id, label: s.name }))]}
            />
            <SimpleSelect
              label="Callback routing (P20)"
              value={callbackRoutingMode}
              onChange={setCallbackRoutingMode}
              options={[
                { value: 'same_rep', label: 'Same rep who dialed' },
                { value: 'best_eligible', label: 'Best eligible rep in campaign' },
                { value: 'group', label: 'Campaign member group' },
                { value: 'external', label: 'External number' },
                { value: 'ai_receptionist', label: 'AI receptionist queue' },
              ]}
            />
            {callbackRoutingMode === 'external' && (
              <Input value={callbackRoutingE164} onChange={(e) => setCallbackRoutingE164(e.target.value)} placeholder="External E.164 for callbacks" aria-label="External callback number" />
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={requireExplicitConsent} onChange={(e) => setRequireExplicitConsent(e.target.checked)} />
              Require recorded contact consent before dial (M56)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={recordingEnabled} onChange={(e) => setRecordingEnabled(e.target.checked)} />
              Enable call recording for this campaign (P23)
            </label>
          </TabsContent>
          <TabsContent value="members" className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">Only assigned reps (or owners/admins) can start dialing sessions on this campaign.</p>
            <ul className="max-h-48 overflow-auto rounded border p-2 text-sm">
              {workspaceMembers.map((m) => (
                <li key={m.userId} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={memberUserIds.includes(m.userId)}
                    onChange={(e) => {
                      setMemberUserIds((prev) =>
                        e.target.checked ? [...prev, m.userId] : prev.filter((id) => id !== m.userId),
                      )
                    }}
                  />
                  {m.name}
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving} onClick={() => void save()}>Save campaign</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
