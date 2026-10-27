'use client'

import Link from 'next/link'
import { Clapperboard, Plus, Scissors, Video } from 'lucide-react'
import { PrimaryButton } from '@/components/app/primary-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRecordingEnabled } from '@/lib/recording/use-recording-enabled'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'

export function SidebarCreateMenu({ recordingNavEnabled = false }: { recordingNavEnabled?: boolean }) {
  const recordingEnabledClient = useRecordingEnabled()
  const recordingEnabled = recordingNavEnabled || recordingEnabledClient
  const t2vEnabled = isT2vFeatureEnabled()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <PrimaryButton
            type="button"
            className="h-9 w-full justify-start gap-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
            data-testid="sidebar-create-menu"
          >
            <Plus className="size-4" />
            <span className="group-data-[collapsible=icon]:hidden">Create</span>
          </PrimaryButton>
        }
      />
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem render={<Link href="/app/clips/new" />}>
          <Clapperboard className="size-4" />
          New clip project
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/app/editor" />}>
          <Scissors className="size-4" />
          Open editor
        </DropdownMenuItem>
        {recordingEnabled ? (
          <DropdownMenuItem render={<Link href="/app/rooms/new" />}>
            <Video className="size-4" />
            Record in Rooms
          </DropdownMenuItem>
        ) : null}
        {t2vEnabled ? (
          <DropdownMenuItem render={<Link href="/app/clips/video/new" />}>
            <Video className="size-4" />
            Create AI video
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
