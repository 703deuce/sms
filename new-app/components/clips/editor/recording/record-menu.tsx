'use client'

import { ChevronDown, Mic, Monitor, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ClipRecorderMode } from '@/components/clips/editor/recording/use-clip-recorder'

export function ClipRecordMenu({
  disabled,
  disabledReason,
  onPick,
}: {
  disabled?: boolean
  disabledReason?: string
  onPick: (mode: ClipRecorderMode) => void
}) {
  const btn = (
    <Button
      type="button"
      size="sm"
      className="h-8 gap-1 bg-lane-record text-white hover:bg-lane-record/90"
      disabled={disabled}
      data-testid="record-menu"
    >
      <span className="size-2 rounded-full bg-white" aria-hidden />
      Record
      <ChevronDown className="size-4 opacity-80" />
    </Button>
  )

  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger render={btn} />
        <TooltipContent>{disabledReason ?? 'Recording unavailable'}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={btn} />
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onPick('voiceover')} data-testid="record-voiceover">
          <Mic className="mr-2 size-4" />
          Voiceover
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick('camera')} data-testid="record-camera">
          <Video className="mr-2 size-4" />
          Camera
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick('screen')} data-testid="record-screen">
          <Monitor className="mr-2 size-4" />
          Screen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
