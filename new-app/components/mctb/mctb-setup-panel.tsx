'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/app/page-primitives'
import { SimpleSelect } from '@/components/app/filters'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { formatPhone } from '@/lib/format'

type Settings = {
  numbers: { id: string; e164: string; label: string; mctb: { enabled: boolean } }[]
  recovery: { enabled: boolean; active: boolean; delaySeconds: number }
  consentMode: string
}

export function MctbSetupPanel() {
  const [data, setData] = useState<Settings | null>(null)
  const [lineId, setLineId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void fetch('/api/phone/mctb')
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error)
        setData(j.data)
        if (j.data.numbers[0]) setLineId(j.data.numbers[0].id)
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load MCTB settings'))
  }, [])

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/phone/mctb', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error)
      setData(j.data)
      toast.success('Saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!data) return <p className="text-sm text-muted-foreground">Loading setup…</p>

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Panel title="Recovery">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="mctb-active">Send recovery texts</Label>
          <Switch
            id="mctb-active"
            checked={data.recovery.active}
            disabled={saving}
            onCheckedChange={(on) => void save({ recovery: { active: on } })}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Consent mode: {data.consentMode.replace(/_/g, ' ')}</p>
      </Panel>
      <Panel title="Business line">
        <SimpleSelect
          label="Number"
          value={lineId}
          onChange={setLineId}
          options={data.numbers.map((n) => ({ value: n.id, label: `${n.label} (${formatPhone(n.e164)})` }))}
        />
        {lineId && (
          <Button
            type="button"
            className="mt-3"
            variant="outline"
            disabled={saving}
            onClick={() => {
              const row = data.numbers.find((n) => n.id === lineId)
              if (!row) return
              void save({
                numberId: lineId,
                mctb: { enabled: !row.mctb.enabled },
              })
            }}
          >
            {data.numbers.find((n) => n.id === lineId)?.mctb.enabled ? 'Disable MCTB on line' : 'Enable MCTB on line'}
          </Button>
        )}
      </Panel>
      <p className="text-xs text-muted-foreground">
        Forwarding, press-1 audio, templates, and exclusions use the same runtime as legacy MCTB — configure per line in Numbers
        when switching products.
      </p>
    </div>
  )
}
