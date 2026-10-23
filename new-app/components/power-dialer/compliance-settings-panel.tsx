'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/app/page-primitives'

export function PowerDialerComplianceSettingsPanel() {
  const [dnc, setDnc] = useState<{ phone: string; reason: string | null }[]>([])
  const [ackAt, setAckAt] = useState<string | null>(null)
  const [phone, setPhone] = useState('')

  const load = useCallback(() => {
    void fetch('/api/phone/power-dialer/compliance')
      .then((r) => r.json())
      .then((j) => {
        setDnc(j.data?.internalDnc || [])
        setAckAt(j.data?.settings?.complianceAcknowledgedAt || null)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const acknowledge = async () => {
    const res = await fetch('/api/phone/power-dialer/compliance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acknowledge_compliance' }),
    })
    if (!res.ok) {
      toast.error('Could not save acknowledgement')
      return
    }
    toast.success('Compliance acknowledgement recorded')
    load()
  }

  const addDnc = async () => {
    const res = await fetch('/api/phone/power-dialer/compliance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_dnc', phone }),
    })
    if (!res.ok) {
      toast.error('Could not add number')
      return
    }
    setPhone('')
    load()
    toast.success('Added to internal DNC')
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Admin acknowledgement" description="Required before the first power-dialer session can start.">
        <p className="mb-3 text-sm text-muted-foreground">
          {ackAt
            ? `Acknowledged ${new Date(ackAt).toLocaleString()}`
            : 'Not acknowledged yet — an admin must confirm responsibility for lawful calling practices.'}
        </p>
        {!ackAt && (
          <Button type="button" size="sm" onClick={() => void acknowledge()}>
            I acknowledge calling compliance responsibilities
          </Button>
        )}
      </Panel>
      <Panel title="Internal do-not-call list">
        <div className="mb-3 flex max-w-md gap-2">
          <Input placeholder="+1…" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Phone to block" />
          <Button type="button" size="sm" onClick={() => void addDnc()}>Add</Button>
        </div>
        <ul className="text-sm">
          {dnc.map((r) => (
            <li key={r.phone} className="border-b py-2 font-mono text-xs">
              {r.phone}
              {r.reason && <span className="ml-2 text-muted-foreground">{r.reason}</span>}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="External DNC screening">
        <p className="text-sm text-muted-foreground">
          No external registry integration is connected. Transovo does not display third-party DNC scores without a supported provider.
        </p>
      </Panel>
    </div>
  )
}
