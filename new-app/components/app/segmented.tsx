'use client'

import { cn } from '@/lib/utils'

export type SegmentedItem = { id: string; label: string; disabled?: boolean }

export function Segmented({
  items,
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  items: SegmentedItem[]
  value: string
  onChange: (id: string) => void
  className?: string
  'aria-label'?: string
}) {
  return (
    <div
      className={cn('inline-flex h-8 rounded-md bg-secondary p-0.5', className)}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const selected = value === item.id
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={item.disabled}
            className={cn(
              'h-7 rounded-[5px] px-2.5 text-[13px] transition-colors disabled:opacity-40',
              selected ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
