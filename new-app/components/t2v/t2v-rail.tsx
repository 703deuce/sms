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

export function T2vRail({
  active,
  onSelect,
  variant = 'vertical',
}: {
  active: T2vRailTab
  onSelect: (t: T2vRailTab) => void
  variant?: 'vertical' | 'horizontal'
}) {
  const horizontal = variant === 'horizontal'
  return (
    <nav
      className={cn(
        'flex shrink-0 bg-muted/10 py-1',
        horizontal ? 'min-h-14 w-full flex-row justify-around gap-0 px-1' : 'w-16 flex-col border-r border-border',
      )}
      aria-label="Studio"
    >
      {ITEMS.map((item) => {
        const on = active === item.id
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            className={cn(
              'relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
              horizontal ? 'h-14 min-w-[4.5rem] flex-1' : 'h-14 w-full',
              on ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60',
            )}
            onClick={() => onSelect(item.id)}
          >
            {on && !horizontal ? <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-primary" /> : null}
            {on && horizontal ? <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" /> : null}
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
