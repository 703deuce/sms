'use client'

import { CAPTION_PRESETS } from '@/lib/clips/settings'
import { cn } from '@/lib/utils'

export function CaptionPresetPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {CAPTION_PRESETS.map((p) => {
        const active = value === p.id
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={cn(
              'rounded-xl border px-3 py-3 text-left transition-colors surface',
              active ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:bg-muted/40',
            )}
          >
            <p className="text-sm font-medium">{p.label}</p>
            <p className="text-xs text-muted-foreground">{p.description}</p>
          </button>
        )
      })}
    </div>
  )
}
