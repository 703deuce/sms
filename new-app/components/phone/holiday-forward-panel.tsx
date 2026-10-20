'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

type HolidayRow = {
  date: string
  mode: 'forward' | 'voicemail'
  savedDestId: string
  dest: ForwardingDestinationSelectorValue
  label: string
}

function rowToJson(row: HolidayRow) {
  const base = { date: row.date, mode: row.mode, label: row.label || undefined }
  if (row.mode !== 'forward') return base
  if (row.savedDestId) return { ...base, destinationId: row.savedDestId }
  if (row.dest.mode === 'workspace_number') {
    return {
      ...base,
      destinationRef: {
        kind: 'workspace_number',
        phoneNumberId: row.dest.workspacePhoneNumberId,
      },
    }
  }
  return {
    ...base,
    destinationRef: { kind: 'external_phone', e164PhoneNumber: row.dest.phoneE164 },
  }
}

export function HolidayForwardPanel({
  phoneNumberId,
  workspaceNumbers,
  savedDestinations,
}: {
  phoneNumberId: string
  workspaceNumbers: Array<{ id: string; e164: string; friendlyName: string | null }>
  savedDestinations: ForwardingDestinationDto[]
}) {
  const [rows, setRows] = useState<HolidayRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch(`/api/phone/numbers/${encodeURIComponent(phoneNumberId)}/answering-policy`)
      .then((r) => r.json())
      .then((json) => {
        const raw = json.data?.policy?.holidayExceptionsJson
        if (!Array.isArray(raw)) return
        setRows(
          raw.map((h: Record<string, unknown>) => {
            const ref = h.destinationRef as Record<string, unknown> | undefined
            let dest: ForwardingDestinationSelectorValue = {
              mode: 'external_phone',
              label: '',
              phoneE164: '',
            }
            if (ref?.kind === 'workspace_number' && ref.phoneNumberId) {
              dest = {
                mode: 'workspace_number',
                label: '',
                workspacePhoneNumberId: String(ref.phoneNumberId),
              }
            } else if (ref?.kind === 'external_phone' && ref.e164PhoneNumber) {
              dest = {
                mode: 'external_phone',
                label: '',
                phoneE164: String(ref.e164PhoneNumber),
              }
            }
            return {
              date: String(h.date || '').slice(0, 10),
              mode: (h.mode === 'voicemail' ? 'voicemail' : 'forward') as 'forward' | 'voicemail',
              savedDestId: typeof h.destinationId === 'string' ? h.destinationId : '',
              dest,
              label: typeof h.label === 'string' ? h.label : '',
            }
          }),
        )
      })
      .finally(() => setLoading(false))
  }, [phoneNumberId])

  const save = () => {
    const holidayExceptionsJson = rows
      .filter((r) => r.date)
      .map(rowToJson)
    void saveAnsweringPolicy(phoneNumberId, { holidayExceptionsJson })
      .then(() => toast.success('Holiday routing saved'))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not save'))
  }

  const addRow = () => {
    setRows((r) => [
      ...r,
      {
        date: '',
        mode: 'forward',
        savedDestId: '',
        dest: { mode: 'external_phone', label: '', phoneE164: '' },
        label: '',
      },
    ])
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        On these dates, normal business hours are overridden for this business number.
      </p>
      {rows.map((row, i) => (
        <div key={i} className="rounded-lg border p-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <div>
              <Label htmlFor={`hol-date-${i}`}>Date</Label>
              <Input
                id={`hol-date-${i}`}
                type="date"
                className="mt-1 w-40"
                value={row.date}
                onChange={(e) =>
                  setRows((rs) => rs.map((r, j) => (j === i ? { ...r, date: e.target.value } : r)))
                }
              />
            </div>
            <div>
              <Label>Behavior</Label>
              <Select
                value={row.mode}
                onValueChange={(v) =>
                  setRows((rs) =>
                    rs.map((r, j) => (j === i ? { ...r, mode: v as 'forward' | 'voicemail' } : r)),
                  )
                }
              >
                <SelectTrigger className="mt-1 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forward">Forward calls</SelectItem>
                  <SelectItem value="voicemail">Voicemail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="self-end"
              aria-label="Remove holiday"
              onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          {row.mode === 'forward' && (
            <>
              <div>
                <Label>Saved destination (optional)</Label>
                <Select
                  value={row.savedDestId}
                  onValueChange={(id) =>
                    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, savedDestId: id } : r)))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Or enter number below" />
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
              {!row.savedDestId && (
                <ForwardingDestinationSelector
                  workspaceNumbers={workspaceNumbers}
                  value={row.dest}
                  onChange={(dest) =>
                    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, dest } : r)))
                  }
                />
              )}
            </>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" />
          Add holiday
        </Button>
        <Button type="button" size="sm" onClick={save}>Save holidays</Button>
      </div>
    </div>
  )
}
