'use client'

import {
  MessageSquare,
  Mic,
  Type,
  Film,
  Palette,
  LayoutTemplate,
  ImageIcon,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type T2vRailTab = 'story' | 'visuals' | 'audio' | 'text' | 'styles' | 'brand' | 'chat'

const ITEMS: { id: T2vRailTab; label: string; icon: typeof Film }[] = [
  { id: 'story', label: 'Story', icon: Film },
  { id: 'visuals', label: 'Visuals', icon: ImageIcon },
  { id: 'audio', label: 'Audio', icon: Mic },
  { id: 'text', label: 'Text', icon: FileText },
  { id: 'styles', label: 'Styles', icon: Type },
  { id: 'brand', label: 'Brand', icon: Palette },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
]

export function T2vRail({ active, onSelect }: { active: T2vRailTab; onSelect: (t: T2vRailTab) => void }) {
  return (
    <nav className="flex w-16 shrink-0 flex-col border-r border-border bg-muted/10 py-1" aria-label="Studio">
      {ITEMS.map((item) => {
        const on = active === item.id
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            className={cn(
              'relative flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
              on ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60',
            )}
            onClick={() => onSelect(item.id)}
          >
            {on ? <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-primary" /> : null}
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
