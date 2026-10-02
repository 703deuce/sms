'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/newui-transplant/components/ui/button'

export function SaveBar({
  label = 'Save changes',
  onSave,
}: {
  label?: string
  onSave?: () => Promise<void> | void
}) {
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <div className="flex items-center gap-3">
      <span aria-live="polite" className="text-xs text-muted-foreground">
        {saved ? (
          <span className="inline-flex items-center gap-1 text-success">
            <Check className="size-3.5" aria-hidden="true" /> Saved
          </span>
        ) : null}
      </span>
      <Button
        type="button"
        aria-label={label}
        disabled={busy}
        onClick={async () => {
          if (!onSave) return
          setBusy(true)
          try {
            await onSave()
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
          } catch {
            // Caller surfaces field-level errors (e.g. consent editor).
          } finally {
            setBusy(false)
          }
        }}
      >
        {label}
      </Button>
    </div>
  )
}
