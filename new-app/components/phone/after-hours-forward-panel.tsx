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
import {
  ForwardingDestinationSelector,
  type ForwardingDestinationSelectorValue,
} from '@/components/phone/forwarding-destination-selector'
import { saveAnsweringPolicy } from '@/lib/phone-forwarding-api'

type ScheduleJson = {
  afterHoursMode?: string
  afterHoursDestinationRef?: {
    kind?: string
    e164PhoneNumber?: string
    phoneNumberId?: string
  }
  afterHoursDestinationE164?: string
}

function readRef(schedule: ScheduleJson | null): ForwardingDestinationSelectorValue {
  const ref = schedule?.afterHoursDestinationRef
  if (ref?.kind === 'workspace_number' && ref.phoneNumberId) {
    return { mode: 'workspace_number', label: '', workspacePhoneNumberId: ref.phoneNumberId }
  }
  const e164 = ref?.e164PhoneNumber || schedule?.afterHoursDestinationE164 || ''
  return { mode: 'external_phone', label: '', phoneE164: e164 }
}

export function AfterHoursForwardPanel({
  phoneNumberId,
  workspaceNumbers,
  onSaved,
}: {
  phoneNumberId: string
  workspaceNumbers: Array<{ id: string; e164: string; friendlyName: string | null }>
  onSaved: () => void
}) {
  const [mode, setMode] = useState('voicemail')
  const [dest, setDest] = useState<ForwardingDestinationSelectorValue>({
    mode: 'external_phone',
    label: '',
    phoneE164: '',
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch(`/api/phone/numbers/${encodeURIComponent(phoneNumberId)}/answering-policy`)
      .then((r) => r.json())
      .then((json) => {
        const schedule = (json.data?.policy?.scheduleJson || null) as ScheduleJson | null
        setMode(schedule?.afterHoursMode || 'voicemail')
        setDest(readRef(schedule))
      })
      .finally(() => setLoading(false))
  }, [phoneNumberId])

  const save = () => {
    const scheduleJson: ScheduleJson = { afterHoursMode: mode }
    if (mode === 'forward') {
      if (dest.mode === 'workspace_number') {
        scheduleJson.afterHoursDestinationRef = {
          kind: 'workspace_number',
          phoneNumberId: dest.workspacePhoneNumberId,
        }
      } else {
        scheduleJson.afterHoursDestinationRef = {
          kind: 'external_phone',
          e164PhoneNumber: dest.phoneE164,
        }
        scheduleJson.afterHoursDestinationE164 = dest.phoneE164
      }
    }
    void saveAnsweringPolicy(phoneNumberId, { scheduleJson })
      .then(() => {
        toast.success('After-hours routing saved')
        onSaved()
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not save'))
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="ah-mode">Closed hours behavior</Label>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger id="ah-mode" className="mt-1 max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="voicemail">Voicemail</SelectItem>
            <SelectItem value="forward">Forward to destination</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === 'forward' && (
        <ForwardingDestinationSelector
          workspaceNumbers={workspaceNumbers}
          value={dest}
          onChange={setDest}
        />
      )}
      <Button type="button" size="sm" className="self-start" onClick={save}>
        Save after-hours routing
      </Button>
    </div>
  )
}
