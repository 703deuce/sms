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

  useEffect(() => {
    if (!open) return
    void fetchPowerLists().then(setLists).catch(() => undefined)
    void fetch('/api/phone/power-dialer/workspace-members').then((r) => r.json()).then((j) => setWorkspaceMembers(j.data || [])).catch(() => undefined)
    void fetch('/api/phone/power-dialer/dispositions').then((r) => r.json()).then((j) => setDispositionSets((j.data || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })))).catch(() => undefined)
    void fetch('/api/phone/power-dialer/scripts').then((r) => r.json()).then((j) => setScripts(j.data || [])).catch(() => undefined)
    void fetch('/api/phone/power-dialer/voicemail-drops').then((r) => r.json()).then((j) => setVmDrops(j.data || [])).catch(() => undefined)
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
            <SimpleSelect label="Mode" value={dialingMode} onChange={setDialingMode} options={[{ value: 'power', label: 'Power (auto)' }, { value: 'preview', label: 'Preview (manual)' }]} />
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
                label="Outbound caller ID"
                value={callerId}
                onChange={setCallerId}
                options={owned.filter((n) => n.status === 'active').map((n) => ({ value: n.number, label: n.nickname || n.number }))}
              />
              {fieldErrors.callerId && <p className="mt-1 text-xs text-destructive">{fieldErrors.callerId}</p>}
            </div>
            <p className="text-xs text-muted-foreground">Numbers come from the global Numbers inventory. Number pools are not configured in this workspace.</p>
          </TabsContent>
          <TabsContent value="handling" className="flex flex-col gap-3">
            <SimpleSelect label="Script" value={scriptId} onChange={setScriptId} options={[{ value: '', label: 'None' }, ...scripts.map((s) => ({ value: s.id, label: s.name }))]} />
            <SimpleSelect label="Voicemail drop" value={voicemailDropId} onChange={setVoicemailDropId} options={[{ value: '', label: 'None' }, ...vmDrops.map((s) => ({ value: s.id, label: s.name }))]} />
            <p className="text-xs text-muted-foreground">Voicemail drops require admin compliance opt-in under Settings → Voicemail drops.</p>
          </TabsContent>
          <TabsContent value="outcomes" className="flex flex-col gap-3">
            <SimpleSelect
              label="Disposition set"
              value={dispositionSetId}
              onChange={setDispositionSetId}
              options={[{ value: '', label: 'Workspace default' }, ...dispositionSets.map((s) => ({ value: s.id, label: s.name }))]}
            />
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
