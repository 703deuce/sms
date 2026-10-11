'use client'

import { SlidersHorizontal } from 'lucide-react'
import {
  AR_CALENDAR_HOUR_PRESETS,
  AR_CALENDAR_SLOT_DENSITY_PX,
  type ArCalendarDisplayHoursPreset,
  type ArCalendarDisplayPrefs,
  type ArCalendarSlotDensity,
  saveArCalendarDisplayPrefs,
} from '@/lib/appointment-reminders/calendar/ar-calendar-display-prefs'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/newui-transplant/components/ui/dropdown-menu'

export function ArCalendarDisplayMenu({
  prefs,
  onChange,
}: {
  prefs: ArCalendarDisplayPrefs
  onChange: (next: ArCalendarDisplayPrefs) => void
}) {
  const setPreset = (hoursPreset: ArCalendarDisplayHoursPreset) => {
    const next = { ...prefs, hoursPreset }
    saveArCalendarDisplayPrefs(next)
    onChange(next)
  }
  const setDensity = (slotDensity: ArCalendarSlotDensity) => {
    const next = { ...prefs, slotDensity }
    saveArCalendarDisplayPrefs(next)
    onChange(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
            <SlidersHorizontal className="size-3.5" aria-hidden />
            Display
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Visible hours</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={prefs.hoursPreset} onValueChange={(v) => setPreset(v as ArCalendarDisplayHoursPreset)}>
          {(Object.keys(AR_CALENDAR_HOUR_PRESETS) as ArCalendarDisplayHoursPreset[]).map((key) => (
            <DropdownMenuRadioItem key={key} value={key}>
              {AR_CALENDAR_HOUR_PRESETS[key].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Time slot size</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={prefs.slotDensity} onValueChange={(v) => setDensity(v as ArCalendarSlotDensity)}>
          <DropdownMenuRadioItem value="compact">
            Compact ({AR_CALENDAR_SLOT_DENSITY_PX.compact}px)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="comfortable">
            Comfortable ({AR_CALENDAR_SLOT_DENSITY_PX.comfortable}px)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="spacious">
            Spacious ({AR_CALENDAR_SLOT_DENSITY_PX.spacious}px)
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
