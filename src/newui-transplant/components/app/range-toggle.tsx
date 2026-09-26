'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export function RangeToggle({ options = ['7 days', '30 days', '90 days'] }: { options?: string[] }) {
  const [value, setValue] = useState(options[0])
  return (
    <div role="group" aria-label="Date range" className="inline-flex rounded-lg border bg-card p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => setValue(o)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            value === o ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
