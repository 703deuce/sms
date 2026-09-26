'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SaveBar({ label = 'Save changes' }: { label?: string }) {
  const [saved, setSaved] = useState(false)
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
        onClick={() => {
          setSaved(true)
          setTimeout(() => setSaved(false), 2000)
        }}
      >
        {label}
      </Button>
    </div>
  )
}
