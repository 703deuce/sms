'use client'

import { cn } from '@/lib/utils'
import { editorToolbarTextBtn } from '@/lib/clips/editor/editor-chrome-tokens'

export const EDITOR_MODE_SWITCHER_ITEMS = [
  { id: 'clip', label: 'Clip editor' },
  { id: 'producer', label: 'AI Producer' },
  { id: 'story', label: 'Story blocks' },
  { id: 'templates', label: 'Templates' },
  { id: 'generate', label: 'Change this shot' },
] as const

export type EditorModeSwitcherMode = (typeof EDITOR_MODE_SWITCHER_ITEMS)[number]['id']

export function EditorModeSwitcher({
  current,
  producerOpen = false,
  disabled = false,
  onSelect,
  className,
}: {
  current: EditorModeSwitcherMode
  producerOpen?: boolean
  disabled?: boolean
  onSelect: (mode: EditorModeSwitcherMode) => void
  className?: string
}) {
  return (
    <nav
      aria-label="Editor modes"
      data-testid="editor-mode-switcher"
      className={cn('flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-lg border border-border/70 bg-card/70 p-0.5', className)}
    >
      {EDITOR_MODE_SWITCHER_ITEMS.map((item) => {
        const active = item.id === 'producer' ? producerOpen || current === 'producer' : !producerOpen && current === item.id
        return (
          <button
            key={item.id}
            type="button"
            data-testid={'editor-mode-' + item.id}
            aria-current={active ? 'page' : undefined}
            disabled={disabled}
            className={cn(editorToolbarTextBtn, 'h-7 px-2 text-[11px]', active && 'bg-accent text-foreground ring-1 ring-border')}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
