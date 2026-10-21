'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Panel } from '@/components/app/page-primitives'

const MODES = [
  { value: 'browser', label: 'Browser phone' },
  { value: 'forward', label: 'Forward to phone' },
  { value: 'auto_attendant', label: 'Keypad auto attendant' },
  { value: 'conversational_ivr', label: 'Conversational IVR' },
  { value: 'staff_then_ivr', label: 'Ring team first, then Conversational IVR' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'greeting_then_forward', label: 'Greeting then forward' },
]

const AFTER_HOURS = [
  { value: 'forward', label: 'Forward' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'auto_attendant', label: 'Auto attendant' },
  { value: 'conversational_ivr', label: 'Conversational IVR' },
]

const NO_ANSWER = [
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'conversational_ivr', label: 'Conversational IVR' },
]

export function NumberIncomingCallsPanel({ phoneNumberId }: { phoneNumberId: string }) {
  const [mode, setMode] = useState('browser')
  const [destinations, setDestinations] = useState<
    Array<{ id: string; name: string; displayNumber?: string; phoneE164?: string }>
  >([])
  const [groups, setGroups] = useState<Array<{ id: string; name: string; strategy?: string }>>([])
  const [menus, setMenus] = useState<Array<{ id: string; name: string }>>([])
  const [primaryDestinationId, setPrimaryDestinationId] = useState('')
  const [forwardingGroupId, setForwardingGroupId] = useState('')
  const [staffGroupId, setStaffGroupId] = useState('')
  const [staffRingSec, setStaffRingSec] = useState('20')
  const [menuId, setMenuId] = useState('')
  const [afterHoursMode, setAfterHoursMode] = useState('voicemail')
  const [noAnswerFallback, setNoAnswerFallback] = useState('voicemail')
  const [scheduleJson, setScheduleJson] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void Promise.all([
      fetch(`/api/phone/numbers/${encodeURIComponent(phoneNumberId)}/answering-policy`).then((r) => r.json()),
      fetch('/api/phone/forwarding').then((r) => r.json()),
      fetch('/api/phone/auto-attendant').then((r) => r.json()),
    ])
      .then(([policyRes, fwdRes, menuRes]) => {
        const p = policyRes.data?.policy
        if (p?.answeringMode) setMode(p.answeringMode)
        if (p?.primaryDestinationId) setPrimaryDestinationId(p.primaryDestinationId)
        if (p?.forwardingGroupId) setForwardingGroupId(p.forwardingGroupId)
        if (p?.autoAttendantMenuId) setMenuId(p.autoAttendantMenuId)
        const sched = (p?.scheduleJson || {}) as Record<string, unknown>
        setScheduleJson(sched)
        const integrated = (sched.integratedRouting || sched) as Record<string, unknown>
        if (integrated.afterHoursMode) setAfterHoursMode(String(integrated.afterHoursMode))
        if (integrated.noAnswerFallbackType) setNoAnswerFallback(String(integrated.noAnswerFallbackType))
        const staff = integrated.staffThenIvr as { forwardingGroupId?: string; ringTimeoutSec?: number } | undefined
        if (staff?.forwardingGroupId) setStaffGroupId(staff.forwardingGroupId)
        if (staff?.ringTimeoutSec) setStaffRingSec(String(staff.ringTimeoutSec))
        setDestinations((fwdRes.data?.destinations || []).map((d: { id: string; name: string }) => d))
        setGroups((fwdRes.data?.groups || []).map((g: { id: string; name: string; strategy?: string }) => g))
        setMenus((menuRes.data || []).map((m: { id: string; name: string }) => m))
      })
      .catch(() => toast.error('Could not load incoming call settings'))
      .finally(() => setLoading(false))
  }, [phoneNumberId])

  const save = () => {
    const integratedRouting = {
      answeringMode: mode,
      afterHoursMode,
      noAnswerFallbackType: noAnswerFallback,
      staffThenIvr:
        mode === 'staff_then_ivr'
          ? {
              forwardingGroupId: staffGroupId,
              ringTimeoutSec: Math.max(5, Number(staffRingSec) || 20),
            }
          : undefined,
    }
    const nextSchedule = { ...scheduleJson, integratedRouting, afterHoursMode }

    void fetch(`/api/phone/numbers/${encodeURIComponent(phoneNumberId)}/answering-policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answeringMode: mode,
        primaryDestinationId: mode === 'forward' ? primaryDestinationId || null : null,
        forwardingGroupId:
          mode === 'forward' && forwardingGroupId ? forwardingGroupId : mode === 'staff_then_ivr' ? staffGroupId || null : null,
        autoAttendantMenuId: mode === 'auto_attendant' ? menuId || null : null,
        scheduleJson: nextSchedule,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error('Save failed')
        toast.success('Incoming call behavior saved')
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
  }

  if (loading) return null

  return (
    <Panel
      title="Incoming calls"
      description="Telnyx Call Control answering for this number — including Conversational IVR and team-first overflow on the same business line."
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="ans-mode">Answering mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v ?? 'browser')}>
            <SelectTrigger id="ans-mode" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {mode === 'forward' && (
          <>
            <div>
              <Label>Forward destination</Label>
              <Select value={primaryDestinationId} onValueChange={(v) => setPrimaryDestinationId(v ?? '')}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose destination" />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                      {(d.displayNumber || d.phoneE164) ? ` · ${d.displayNumber || d.phoneE164}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Or ring group (optional)</Label>
              <Select value={forwardingGroupId} onValueChange={(v) => setForwardingGroupId(v ?? '')}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Single destination or group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}{g.strategy ? ` · ${g.strategy}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        {mode === 'staff_then_ivr' && (
          <>
            <div>
              <Label>Team ring group</Label>
              <Select value={staffGroupId} onValueChange={(v) => setStaffGroupId(v ?? '')}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose saved ring group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}{g.strategy ? ` · ${g.strategy}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Uses the group&apos;s simultaneous or sequential strategy and Press-1 rules from Phone forwarding.
              </p>
            </div>
            <div>
              <Label htmlFor="staff-ring-sec">Ring timeout (seconds)</Label>
              <Input
                id="staff-ring-sec"
                type="number"
                min={5}
                max={120}
                className="mt-1 max-w-[8rem]"
                value={staffRingSec}
                onChange={(e) => setStaffRingSec(e.target.value)}
              />
            </div>
          </>
        )}
        {mode === 'auto_attendant' && (
          <div>
            <Label>Phone menu</Label>
            <Select value={menuId} onValueChange={(v) => setMenuId(v ?? '')}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose menu" />
              </SelectTrigger>
              <SelectContent>
                {menus.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="after-hours">After hours</Label>
          <Select value={afterHoursMode} onValueChange={(v) => setAfterHoursMode(v ?? 'voicemail')}>
            <SelectTrigger id="after-hours" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AFTER_HOURS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="no-answer-fb">No-answer fallback (forwarding)</Label>
          <Select value={noAnswerFallback} onValueChange={(v) => setNoAnswerFallback(v ?? 'voicemail')}>
            <SelectTrigger id="no-answer-fb" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NO_ANSWER.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {mode === 'conversational_ivr' && (
          <p className="text-xs text-muted-foreground">
            Assign and publish a Conversational IVR agent on this number under Call Routing. Calls enter via Call Control and connect to LiveKit over SIP.
          </p>
        )}
        <Button type="button" size="sm" onClick={save}>Save incoming behavior</Button>
      </div>
    </Panel>
  )
}
