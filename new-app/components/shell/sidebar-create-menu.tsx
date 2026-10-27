'use client'

import Link from 'next/link'
import { Clapperboard, Plus, Scissors, Sparkles } from 'lucide-react'
import { PrimaryButton } from '@/components/app/primary-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'
import { isScriptEditorEnabled } from '@/lib/features/script-editor'

export function SidebarCreateMenu() {
  const t2vEnabled = isT2vFeatureEnabled()
  const scriptEditorEnabled = isScriptEditorEnabled()

  const onPick = (product: 'clips' | 'editor' | 'ai-video') => {
    console.info('[nav:create]', { product })
  }

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
        <DropdownMenuItem
          render={<Link href="/app/clips/new" onClick={() => onPick('clips')} />}
        >
          <Clapperboard className="size-4" />
          Clips
        </DropdownMenuItem>
        {scriptEditorEnabled ? (
          <DropdownMenuItem render={<Link href="/app/editor" onClick={() => onPick('editor')} />}>
            <Scissors className="size-4" />
            Editor
          </DropdownMenuItem>
        ) : null}
        {t2vEnabled ? (
          <DropdownMenuItem
            render={<Link href="/app/clips/video/new" onClick={() => onPick('ai-video')} />}
          >
            <Sparkles className="size-4" />
            AI Video
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
