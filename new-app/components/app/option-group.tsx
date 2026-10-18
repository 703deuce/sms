'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

export function OptionGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  columns = 2,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; description?: string; disabled?: boolean }[]
  columns?: 1 | 2 | 3
}) {
  const name = useId()
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className={cn('grid grid-cols-1 gap-2', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'flex cursor-pointer gap-3 rounded-lg surface p-3 transition-colors hover:bg-muted/50',
              'has-[:checked]:border-primary has-[:checked]:bg-accent/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
              o.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="mt-0.5 size-4 accent-[var(--primary)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{o.label}</span>
              {o.description && <span className="text-xs leading-relaxed text-muted-foreground">{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function SettingRow({ title, description, control }: { title: string; description?: React.ReactNode; control: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        {description && <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}
