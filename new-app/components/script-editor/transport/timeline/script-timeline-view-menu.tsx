'use client'

import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ScriptTimelineViewMenu({
  showRulerMarkers,
  showRulerComments,
  onChange,
}: {
  showRulerMarkers: boolean
  showRulerComments: boolean
  onChange: (patch: { showRulerMarkers?: boolean; showRulerComments?: boolean }) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" title="Timeline view">
            <Eye className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs">Show in time ruler</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={showRulerMarkers}
          onCheckedChange={(v) => onChange({ showRulerMarkers: v === true })}
        >
          Markers
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showRulerComments}
          onCheckedChange={(v) => onChange({ showRulerComments: v === true })}
        >
          Comments
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
