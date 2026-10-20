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
import { saveAnsweringPolicy, type ForwardingDestinationDto } from '@/lib/phone-forwarding-api'

type ScheduleJson = {
  noAnswerFallback?: {
    type?: string
    destinationId?: string
    destinationE164?: string
    destinationRefKind?: string
    destinationRefE164?: string
    destinationRefPhoneNumberId?: string
  }
}

function readDest(schedule: ScheduleJson | null): ForwardingDestinationSelectorValue {
  const fb = schedule?.noAnswerFallback
  if (!fb || fb.type !== 'forward_phone') {
    return { mode: 'external_phone', label: '', phoneE164: '' }
  }
  if (fb.destinationRefKind === 'workspace_number' && fb.destinationRefPhoneNumberId) {
    return {
      mode: 'workspace_number',
      label: '',
      workspacePhoneNumberId: fb.destinationRefPhoneNumberId,
    }
  }
  return {
    mode: 'external_phone',
    label: '',
    phoneE164: fb.destinationRefE164 || fb.destinationE164 || '',
  }
}

export function NoAnswerFallbackPanel({
  phoneNumberId,
  workspaceNumbers,
  savedDestinations,
  onSaved,
}: {
  phoneNumberId: string
  workspaceNumbers: Array<{ id: string; e164: string; friendlyName: string | null }>
  savedDestinations: ForwardingDestinationDto[]
  onSaved: () => void
}) {
  const [mode, setMode] = useState<'voicemail' | 'forward_phone'>('voicemail')
  const [savedDestId, setSavedDestId] = useState('')
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
        const fb = schedule?.noAnswerFallback
        if (fb?.type === 'forward_phone') {
          setMode('forward_phone')
          if (fb.destinationId) setSavedDestId(fb.destinationId)
          else setDest(readDest(schedule))
        } else {
          setMode('voicemail')
        }
      })
      .finally(() => setLoading(false))
  }, [phoneNumberId])

  const save = () => {
    void fetch(`/api/phone/numbers/${encodeURIComponent(phoneNumberId)}/answering-policy`)
      .then((r) => r.json())
      .then((json) => {
        const prev = (json.data?.policy?.scheduleJson || {}) as Record<string, unknown>
        const scheduleJson: ScheduleJson = { ...prev }
        if (mode === 'forward_phone') {
          if (savedDestId) {
            scheduleJson.noAnswerFallback = { type: 'forward_phone', destinationId: savedDestId }
          } else if (dest.mode === 'workspace_number') {
            scheduleJson.noAnswerFallback = {
              type: 'forward_phone',
              destinationRefKind: 'workspace_number',
              destinationRefPhoneNumberId: dest.workspacePhoneNumberId,
            }
          } else {
            scheduleJson.noAnswerFallback = {
              type: 'forward_phone',
              destinationRefKind: 'external_phone',
              destinationRefE164: dest.phoneE164,
              destinationE164: dest.phoneE164,
            }
          }
        } else {
          scheduleJson.noAnswerFallback = { type: 'voicemail' }
        }
        return saveAnsweringPolicy(phoneNumberId, { scheduleJson })
      })
      .then(() => {
        toast.success('No-answer fallback saved')
        onSaved()
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not save'))
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="na-fallback">If nobody answers</Label>
        <Select value={mode} onValueChange={(v) => setMode(v as 'voicemail' | 'forward_phone')}>
          <SelectTrigger id="na-fallback" className="mt-1 max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="voicemail">Send to voicemail</SelectItem>
            <SelectItem value="forward_phone">Forward to another number</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === 'forward_phone' && (
        <>
          <div>
            <Label>Saved destination (optional)</Label>
            <Select
              value={savedDestId}
              onValueChange={(id) => {
                setSavedDestId(id)
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Or configure below" />
              </SelectTrigger>
              <SelectContent>
                {savedDestinations.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} · {d.displayNumber || d.phoneE164}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!savedDestId && (
            <ForwardingDestinationSelector
              workspaceNumbers={workspaceNumbers}
              value={dest}
              onChange={setDest}
            />
          )}
        </>
      )}
      <Button type="button" size="sm" className="self-start" onClick={save}>
        Save no-answer fallback
      </Button>
    </div>
  )
}
