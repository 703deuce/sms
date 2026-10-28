'use client'

import { Label } from '@/components/ui/label'
import {
  clipLengthChoiceLabels,
  clipLengthChoices,
  type ClipLengthChoice,
} from '@/lib/clips/clip-length'
import { cn } from '@/lib/utils'

export function ClipLengthChoice({
  value,
  onChange,
  className,
}: {
  value: ClipLengthChoice
  onChange: (choice: ClipLengthChoice) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label>Clip length</Label>
      <p className="text-xs text-muted-foreground">
        Auto lets the AI pick length per moment (up to 90s). Other options set a maximum length per clip.
      </p>
      <div className="flex flex-wrap gap-2">
        {clipLengthChoices.map((choice) => (
          <button
            key={String(choice)}
            type="button"
            onClick={() => onChange(choice)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium',
              value === choice ? 'border-primary bg-accent' : 'border-border',
            )}
          >
            {clipLengthChoiceLabels[choice]}
          </button>
        ))}
      </div>
    </div>
  )
}
