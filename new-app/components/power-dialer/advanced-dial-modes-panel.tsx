'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'

type ModeRow = {
  id: string
  label: string
  enabled: boolean
  userMessage: string | null
  blockReason: string | null
}

export function AdvancedDialModesPanel() {
  const [modes, setModes] = useState<ModeRow[]>([])
  const [entitlements, setEntitlements] = useState<{
    parallelEnabled?: boolean
    predictiveEnabled?: boolean
    premiumAmdEnabled?: boolean
    maxParallelLines?: number
  } | null>(null)
  const [killSwitch, setKillSwitch] = useState(false)
  const [maxLines, setMaxLines] = useState(3)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const reload = () => {
    setLoading(true)
    void fetch('/api/phone/power-dialer/advanced-dial-modes')
      .then((r) => r.json())
      .then((j) => {
        setModes(j.data?.modes || [])
        setEntitlements(j.data?.entitlements || {})
        setKillSwitch(Boolean(j.data?.killSwitch))
        if (typeof j.data?.entitlements?.maxParallelLines === 'number') {
          setMaxLines(j.data.entitlements.maxParallelLines)
        }
      })
      .catch(() => toast.error('Could not load advanced dial settings'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true)
    try {
      const r = await fetch('/api/phone/power-dialer/advanced-dial-modes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok || j.error) throw new Error(j.error || 'Update failed')
      toast.success('Advanced dial settings updated')
      reload()
      window.dispatchEvent(new Event('advanced-dial-modes-updated'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div data-testid="pd-advanced-dial-modes">
        <p className="text-sm text-muted-foreground">Loading advanced dialing…</p>
      </div>
    )
  }

  return (
    <div data-testid="pd-advanced-dial-modes">
    <Panel
      title="Advanced dialing modes"
      description="Workspace administrators can enable parallel, machine-filtered parallel, and predictive modes. Campaign editors read these gates — they cannot bypass the platform kill switch."
    >
      {killSwitch && (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          Power-dialer kill switch is active for this workspace. Advanced modes stay disabled until operations clears the switch.
        </p>
      )}
      <ul className="mb-4 space-y-3 text-sm">
        {modes.map((m) => (
          <li key={m.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3">
            <div>
              <p className="font-medium">{m.label}</p>
              {m.userMessage && <p className="mt-1 text-xs text-muted-foreground">{m.userMessage}</p>}
            </div>
            <div className="text-right">
              <StatusBadge tone={m.enabled ? 'success' : 'warning'}>{m.enabled ? 'Available' : 'Locked'}</StatusBadge>
              {!m.enabled && m.blockReason && <p className="mt-1 max-w-[200px] text-xs text-muted-foreground">{m.blockReason}</p>}
            </div>
          </li>
        ))}
      </ul>
      <div className="grid max-w-md gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(entitlements?.parallelEnabled)}
            disabled={killSwitch || saving}
            onChange={(e) => void patch({ parallelEnabled: e.target.checked, complianceAcknowledged: true })}
          />
          Enable parallel dialing (2–5 lines per agent)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(entitlements?.predictiveEnabled)}
            disabled={killSwitch || saving || !entitlements?.parallelEnabled}
            onChange={(e) => void patch({ predictiveEnabled: e.target.checked, complianceAcknowledged: true })}
          />
          Enable predictive pacing (requires parallel)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(entitlements?.premiumAmdEnabled)}
            disabled={killSwitch || saving}
            onChange={(e) => void patch({ premiumAmdEnabled: e.target.checked })}
          />
          Premium answering-machine detection
        </label>
        <p className="text-xs text-muted-foreground">
          Premium AMD powers parallel machine filtering and human vs voicemail classification. Apple iOS Call
          Screening detection is a separate Telnyx dial-origination capability (Phase 2).
        </p>
        <label className="text-sm">
          Max parallel lines
          <Input
            className="mt-1"
            type="number"
            min={2}
            max={10}
            value={maxLines}
            onChange={(e) => setMaxLines(Number(e.target.value))}
          />
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={saving || killSwitch}
          onClick={() => void patch({ maxParallelLines: maxLines, complianceAcknowledged: true })}
        >
          Save line cap
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        After changing entitlements, refresh an open campaign editor to see updated dial-mode locks.{' '}
        <Link href="/app/power-dialer/settings?tab=dialing" className="text-primary hover:underline">Dialing settings</Link>
      </p>
    </Panel>
    </div>
  )
}
