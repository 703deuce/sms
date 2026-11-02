'use client'

import { cn } from '@/lib/utils'

export type SegmentedItem = { id: string; label: string; disabled?: boolean }

export function Segmented({
  items,
  value,
  onChange,
  className,
  size = 'default',
  'aria-label': ariaLabel,
}: {
  items: SegmentedItem[]
  value: string
  onChange: (id: string) => void
  className?: string
  size?: 'default' | 'sm'
  'aria-label'?: string
}) {
  const sm = size === 'sm'
  return (
    <div
      className={cn(
        'inline-flex rounded-md bg-secondary p-0.5',
        sm ? 'h-7' : 'h-8',
        className,
      )}
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
              'rounded-[5px] px-2.5 transition-colors disabled:opacity-40',
              sm ? 'h-6 text-[11px]' : 'h-7 text-[13px]',
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
