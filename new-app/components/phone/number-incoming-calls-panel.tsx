'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/app/page-primitives'
import {
  fetchCallForwarding,
  saveAnsweringPolicy,
  type ForwardingConfigDto,
} from '@/lib/phone-forwarding-api'
import { AfterHoursForwardPanel } from '@/components/phone/after-hours-forward-panel'
import { NoAnswerFallbackPanel } from '@/components/phone/no-answer-fallback-panel'
import { formatPhone } from '@/lib/format'

const MODES = [
  { value: 'browser', label: 'Browser phone' },
  { value: 'forward', label: 'Forward to phone or ring group' },
  { value: 'auto_attendant', label: 'Keypad auto attendant' },
  { value: 'conversational_ivr', label: 'Conversational IVR first' },
  {
    value: 'staff_then_ivr',
    label: 'Ring team first, then Conversational IVR',
  },
  { value: 'greeting_then_forward', label: 'Greeting then forward' },
  { value: 'voicemail', label: 'Voicemail' },
]

function isPhoneFoundation(settingsJson: unknown): boolean {
  if (!settingsJson || typeof settingsJson !== 'object') return false
  const ingress = (settingsJson as { ingressModel?: string }).ingressModel
  return ingress === 'phone_foundation' || (settingsJson as { phoneFoundation?: boolean }).phoneFoundation === true
}

export function NumberIncomingCallsPanel({ phoneNumberId }: { phoneNumberId: string }) {
  const [mode, setMode] = useState('browser')
  const [config, setConfig] = useState<ForwardingConfigDto | null>(null)
  const [primaryDestinationId, setPrimaryDestinationId] = useState('')
  const [forwardingGroupId, setForwardingGroupId] = useState('')
  const [menuId, setMenuId] = useState('')
  const [paused, setPaused] = useState(false)
  const [ingressFoundation, setIngressFoundation] = useState(false)
  const [mctbEnabled, setMctbEnabled] = useState(false)
  const [mctbSaving, setMctbSaving] = useState(false)
  const [menus, setMenus] = useState<Array<{ id: string; name: string }>>([])
  const [scheduleJson, setScheduleJson] = useState<Record<string, unknown>>({})
  const [staffGroupId, setStaffGroupId] = useState('')
  const [staffRingSec, setStaffRingSec] = useState('20')
  const [loading, setLoading] = useState(true)

  const reloadForwarding = useCallback(() => {
    return fetchCallForwarding(phoneNumberId).then(setConfig).catch(() => {
      toast.error('Could not load forwarding settings')
    })
  }, [phoneNumberId])

  useEffect(() => {
    setLoading(true)
    void Promise.all([
      fetch(`/api/phone/numbers/${encodeURIComponent(phoneNumberId)}/answering-policy`).then((r) =>
        r.json(),
      ),
      reloadForwarding(),
      fetch('/api/phone/auto-attendant').then((r) => r.json()),
      fetch('/api/phone/mctb').then((r) => r.json()),
    ])
      .then(([policyRes, , menuRes, mctbRes]) => {
        const p = policyRes.data?.policy
        const number = policyRes.data?.number
        if (p?.answeringMode) setMode(p.answeringMode)
        if (p?.primaryDestinationId) setPrimaryDestinationId(p.primaryDestinationId)
        if (p?.forwardingGroupId) setForwardingGroupId(p.forwardingGroupId)
        if (p?.autoAttendantMenuId) setMenuId(p.autoAttendantMenuId)
        if (typeof p?.paused === 'boolean') setPaused(p.paused)
        const sched = (p?.scheduleJson || {}) as Record<string, unknown>
        setScheduleJson(sched)
        const integrated = (sched.integratedRouting || sched) as Record<string, unknown>
        const staff = integrated.staffThenIvr as
          | { forwardingGroupId?: string; ringTimeoutSec?: number }
          | undefined
        if (staff?.forwardingGroupId) setStaffGroupId(staff.forwardingGroupId)
        if (staff?.ringTimeoutSec) setStaffRingSec(String(staff.ringTimeoutSec))
        setIngressFoundation(isPhoneFoundation(number?.settingsJson))
        const line = mctbRes.data?.numbers?.find((n: { id: string }) => n.id === phoneNumberId)
        if (line?.mctb) setMctbEnabled(Boolean(line.mctb.enabled))
        setMenus((menuRes.data || []).map((m: { id: string; name: string }) => m))
      })
      .catch(() => toast.error('Could not load incoming call settings'))
      .finally(() => setLoading(false))
  }, [phoneNumberId, reloadForwarding])

  const save = () => {
    const integratedRouting = {
      answeringMode: mode,
      staffThenIvr:
        mode === 'staff_then_ivr'
          ? {
              forwardingGroupId: staffGroupId,
              ringTimeoutSec: Math.max(5, Number(staffRingSec) || 20),
            }
          : undefined,
    }
    const nextSchedule = { ...scheduleJson, integratedRouting }

    void saveAnsweringPolicy(phoneNumberId, {
      answeringMode: mode,
      primaryDestinationId:
        mode === 'forward' && !forwardingGroupId ? primaryDestinationId || null : null,
      forwardingGroupId:
        mode === 'forward' && forwardingGroupId
          ? forwardingGroupId
          : mode === 'staff_then_ivr'
            ? staffGroupId || null
            : null,
      autoAttendantMenuId: mode === 'auto_attendant' ? menuId || null : null,
      paused,
      scheduleJson: nextSchedule,
    })
      .then(() => {
        toast.success('Incoming call behavior saved')
        void reloadForwarding()
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
  }

  const saveMctb = (enabled: boolean) => {
    setMctbSaving(true)
    void fetch('/api/phone/mctb', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numberId: phoneNumberId, line: { enabled } }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) throw new Error(json.error || 'Save failed')
        setMctbEnabled(enabled)
        toast.success(enabled ? 'MCTB enabled for this number' : 'MCTB disabled for this number')
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setMctbSaving(false))
  }

  if (loading) return null

  const destinations = config?.destinations ?? []
  const groups = config?.groups ?? []
  const workspaceNumbers = config?.numbers ?? []

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Incoming calls"
        description={
          ingressFoundation
            ? 'This number uses one Telnyx Call Control ingress. Change answering mode, IVR, and MCTB without repointing the carrier.'
            : 'How this number answers on Telnyx Call Control.'
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              checked={!paused}
              onCheckedChange={(v) => setPaused(!v)}
              aria-label="Pause incoming call handling"
            />
            <span className="text-sm text-muted-foreground">
              {paused ? 'Answering paused' : 'Answering active'}
            </span>
          </div>
          <div>
            <Label htmlFor="ans-mode">Answering mode</Label>
            <Select value={mode} onValueChange={setMode}>
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
                <Label>Ring group (optional)</Label>
                <Select
                  value={forwardingGroupId || '_none'}
                  onValueChange={(v) => setForwardingGroupId(v === '_none' ? '' : v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Single destination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Single destination</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} · {g.strategy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!forwardingGroupId && (
                <div>
                  <Label>Forward destination</Label>
                  <Select value={primaryDestinationId} onValueChange={setPrimaryDestinationId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {destinations.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                          {d.displayNumber || d.phoneE164
                            ? ` · ${d.displayNumber || d.phoneE164}`
                            : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
          {mode === 'auto_attendant' && (
            <div>
              <Label>Phone menu</Label>
              <Select value={menuId} onValueChange={setMenuId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose menu" />
                </SelectTrigger>
                <SelectContent>
                  {menus.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      No menus — create one under Phone → Auto attendant
                    </SelectItem>
                  ) : (
                    menus.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          {mode === 'conversational_ivr' && (
            <p className="text-sm text-muted-foreground">
              Link a published AI agent to this number under{' '}
              <Link href="/app/receptionist" className="text-primary underline">
                AI Receptionist
              </Link>
              . Staff-first and ring-timeout fallback are configured below.
            </p>
          )}
          {mode === 'staff_then_ivr' && (
            <>
              <div>
                <Label>Ring group</Label>
                <Select value={staffGroupId || '_none'} onValueChange={(v) => setStaffGroupId(v === '_none' ? '' : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose ring group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none" disabled>Choose ring group</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} · {g.strategy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="staff-ring-sec">Ring time before IVR (seconds)</Label>
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
              <p className="text-sm text-muted-foreground">
                If nobody answers, the call hands off to Conversational IVR on this number. Publish an
                agent under{' '}
                <Link href="/app/receptionist" className="text-primary underline">
                  AI Receptionist
                </Link>
                .
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={save}>Save incoming behavior</Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/app/phone/forwarding">Advanced forwarding</Link>
            </Button>
          </div>
        </div>
      </Panel>

      <NoAnswerFallbackPanel
        phoneNumberId={phoneNumberId}
        workspaceNumbers={workspaceNumbers}
        savedDestinations={destinations}
        onSaved={() => void reloadForwarding()}
      />

      <AfterHoursForwardPanel
        phoneNumberId={phoneNumberId}
        workspaceNumbers={workspaceNumbers}
        onSaved={() => void reloadForwarding()}
      />

      <Panel
        title="Missed Call Text Back"
        description="Optional recovery texts after a qualifying missed call. Independent of how the call is answered."
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              Enable for{' '}
              {formatPhone(config?.numbers.find((n) => n.id === phoneNumberId)?.e164 || 'this line')}
            </p>
            <p className="text-xs text-muted-foreground">
              Uses the platform sender. Does not change Telnyx connection settings.
            </p>
          </div>
          <Switch
            checked={mctbEnabled}
            disabled={mctbSaving}
            onCheckedChange={(v) => saveMctb(v)}
            aria-label="Enable Missed Call Text Back for this number"
          />
        </div>
        <Button type="button" variant="link" className="mt-2 h-auto p-0" asChild>
          <Link href="/app/mctb/recovery">Recovery message, consent, and cooldowns</Link>
        </Button>
      </Panel>
    </div>
  )
}
