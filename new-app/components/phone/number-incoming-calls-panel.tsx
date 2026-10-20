'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
  { value: 'auto_attendant', label: 'Auto attendant' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'greeting_then_forward', label: 'Greeting then forward' },
]

export function NumberIncomingCallsPanel({ phoneNumberId }: { phoneNumberId: string }) {
  const [mode, setMode] = useState('browser')
  const [destinations, setDestinations] = useState<
    Array<{ id: string; name: string; displayNumber?: string; phoneE164?: string }>
  >([])
  const [menus, setMenus] = useState<Array<{ id: string; name: string }>>([])
  const [primaryDestinationId, setPrimaryDestinationId] = useState('')
  const [menuId, setMenuId] = useState('')
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
        if (p?.autoAttendantMenuId) setMenuId(p.autoAttendantMenuId)
        setDestinations((fwdRes.data?.destinations || []).map((d: { id: string; name: string }) => d))
        setMenus((menuRes.data || []).map((m: { id: string; name: string }) => m))
      })
      .catch(() => toast.error('Could not load incoming call settings'))
      .finally(() => setLoading(false))
  }, [phoneNumberId])

  const save = () => {
    void fetch(`/api/phone/numbers/${encodeURIComponent(phoneNumberId)}/answering-policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answeringMode: mode,
        primaryDestinationId: mode === 'forward' ? primaryDestinationId || null : null,
        autoAttendantMenuId: mode === 'auto_attendant' ? menuId || null : null,
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
    <Panel title="Incoming calls" description="How this number answers on Telnyx Call Control.">
      <div className="flex flex-col gap-4">
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
                    {(d.displayNumber || d.phoneE164) ? ` · ${d.displayNumber || d.phoneE164}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {mode === 'auto_attendant' && (
          <div>
            <Label>Phone menu</Label>
            <Select value={menuId} onValueChange={setMenuId}>
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
        <p className="text-xs text-muted-foreground">
          AI Receptionist and MCTB use separate carrier ingress. Switch products from Numbers assignments when required.
        </p>
        <Button type="button" size="sm" onClick={save}>Save incoming behavior</Button>
      </div>
    </Panel>
  )
}
