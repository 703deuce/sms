'use client'

import { ChevronDown } from 'lucide-react'
import { useClipsWorkspace } from '@/components/providers/clips-workspace-provider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function DriveWorkspaceSwitcher() {
  const { workspaceName } = useClipsWorkspace()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="mb-3 h-8 w-full justify-between gap-2 rounded-lg px-2 text-[13px]"
            data-testid="drive-workspace-switcher"
          >
            <span className="flex items-center gap-2 truncate">
              <span className="flex size-5 shrink-0 items-center justify-center rounded bg-card text-[10px] font-semibold">
                {workspaceName.slice(0, 1).toUpperCase()}
              </span>
              {workspaceName}
            </span>
            <ChevronDown className="size-4 shrink-0 opacity-60" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-[216px]">
        <DropdownMenuItem disabled>{workspaceName}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Create workspace (soon)</DropdownMenuItem>
        <DropdownMenuItem disabled>Drive settings</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
