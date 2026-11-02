'use client'

import Link from 'next/link'
import {
  Clapperboard,
  Download,
  GraduationCap,
  House,
  Images,
  LayoutTemplate,
  Palette,
  Plus,
  Radio,
  Scissors,
  Settings,
  Sparkles,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { CreateMenuItem, SidebarNavIcon } from '@/lib/sidebar-nav'

const ICONS: Record<SidebarNavIcon, LucideIcon> = {
  home: House,
  clips: Scissors,
  streamer: Radio,
  editor: Clapperboard,
  record: Video,
  aiVideo: Sparkles,
  media: Images,
  brand: Palette,
  templates: LayoutTemplate,
  exports: Download,
  learn: GraduationCap,
  settings: Settings,
}

export function SidebarCreateMenu({ items }: { items: CreateMenuItem[] }) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  className="h-9 w-full justify-start gap-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
                  data-testid="sidebar-create-menu"
                >
                  <Plus className="size-4" />
                  <span className="group-data-[collapsible=icon]:hidden">Create</span>
                </Button>
              }
            />
          }
        />
        <TooltipContent side="right" className="group-data-[collapsible=icon]:block hidden">
          Create
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-56">
        {items.map((item) => {
          const Icon = ICONS[item.icon]
          return (
            <DropdownMenuItem
              key={item.id}
              data-testid={`create-item-${item.id}`}
              render={<Link href={item.href} />}
            >
              <Icon className="size-4" />
              {item.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
