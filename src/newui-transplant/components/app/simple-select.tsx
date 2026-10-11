'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/newui-transplant/components/ui/select'
import { cn } from '@/lib/utils'

export function SimpleSelect({
  options,
  value,
  defaultValue,
  onChange,
  label,
  className,
  id,
}: {
  options: { value: string; label: string }[]
  value?: string
  defaultValue?: string
  onChange?: (v: string) => void
  label: string
  className?: string
  id?: string
}) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value)
  const current = value ?? inner
  return (
    <Select
      value={current}
      onValueChange={(v) => {
        if (v == null) return
        setInner(v as string)
        onChange?.(v as string)
      }}
    >
      <SelectTrigger id={id} aria-label={label} className={cn('h-9 w-full bg-card', className)}>
        <SelectValue placeholder={label}>
          {options.find((o) => o.value === current)?.label ?? current}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="z-[200]">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
