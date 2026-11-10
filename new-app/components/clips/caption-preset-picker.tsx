'use client'

import { CAPTION_PRESETS } from '@/lib/clips/settings'
import { cn } from '@/lib/utils'
import { captionStyleRole } from '../../lib/clips/editor/caption-style-catalog'

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
              'rounded-xl border px-3 py-3 text-left transition-colors surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:bg-muted/40',
            )}
          >
            <p className="text-sm font-medium">
              {p.label}
              {captionStyleRole(p.id) ? (
                <span className="ml-1 font-normal text-muted-foreground">
                  · {captionStyleRole(p.id)!.roleLabel}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">{p.description}</p>
          </button>
        )
      })}
    </div>
  )
}
