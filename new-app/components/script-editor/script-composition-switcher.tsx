'use client'

import { useRouter } from 'next/navigation'
import { ChevronDown, Film, Scissors } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type CompositionListItem = {
  id: string
  kind: 'FULL' | 'CLIP'
  clipId: string | null
  title: string
}

export function ScriptCompositionSwitcher({
  projectId,
  compositions,
  activeCompositionId,
  activeTitle,
  isClip,
}: {
  projectId: string
  compositions: CompositionListItem[]
  activeCompositionId: string
  activeTitle: string
  isClip: boolean
}) {
  const router = useRouter()

  const hrefFor = (c: CompositionListItem) => {
    if (c.kind === 'CLIP' && c.clipId) {
      return `/app/clips/${projectId}/script?clipId=${encodeURIComponent(c.clipId)}`
    }
    return `/app/clips/${projectId}/script`
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 max-w-[min(100%,280px)] gap-1 px-2 font-medium"
            data-testid="script-composition-switcher"
          />
        }
      >
        {isClip ? <Scissors className="size-3.5 shrink-0 text-muted-foreground" /> : <Film className="size-3.5 shrink-0 text-muted-foreground" />}
        <span className="truncate">{activeTitle}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Compositions</DropdownMenuLabel>
        {compositions.map((c) => {
          const active = c.id === activeCompositionId
          return (
            <DropdownMenuItem
              key={c.id}
              className={cn(active && 'bg-accent')}
              onClick={() => router.push(hrefFor(c))}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {c.kind === 'CLIP' ? <Scissors className="size-3.5 shrink-0" /> : <Film className="size-3.5 shrink-0" />}
                <span className="truncate">{c.title}</span>
              </span>
              {active ? <span className="text-[10px] text-muted-foreground">Current</span> : null}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(`/app/clips/${projectId}`)}>Back to project</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
