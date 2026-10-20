'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Panel } from '@/components/app/page-primitives'
import { BusinessHoursEditor } from '@/components/routing/business-hours-editor'
import { HolidayForwardPanel } from '@/components/phone/holiday-forward-panel'
import { fetchCallForwarding } from '@/lib/phone-forwarding-api'

export function PhoneBusinessHoursWorkspace() {
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [numbers, setNumbers] = useState<
    Array<{ id: string; e164: string; friendlyName: string | null }>
  >([])
  const [destinations, setDestinations] = useState<
    Array<{ id: string; name: string; phoneE164: string; displayNumber?: string }>
  >([])

  useEffect(() => {
    void fetchCallForwarding().then((cfg) => {
      setNumbers(cfg.numbers)
      setDestinations(cfg.destinations)
      if (cfg.numbers[0]?.id) setPhoneNumberId(cfg.numbers[0].id)
    })
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {numbers.length > 1 && (
        <div className="max-w-md">
          <Label htmlFor="bh-number">Business number</Label>
          <Select value={phoneNumberId} onValueChange={setPhoneNumberId}>
            <SelectTrigger id="bh-number" className="mt-2">
              <SelectValue placeholder="Select number" />
            </SelectTrigger>
            <SelectContent>
              {numbers.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.friendlyName ? `${n.friendlyName} · ` : ''}
                  {n.e164}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <BusinessHoursEditor />
      {phoneNumberId && (
        <Panel title="Holiday call routing" description="Override normal hours on specific dates.">
          <HolidayForwardPanel
            phoneNumberId={phoneNumberId}
            workspaceNumbers={numbers}
            savedDestinations={destinations}
          />
        </Panel>
      )}
    </div>
  )
}
