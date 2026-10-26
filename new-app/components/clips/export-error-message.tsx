'use client'

import { useState } from 'react'
import { formatExportError } from '@/lib/clips/export-error'
import { Button } from '@/components/ui/button'

export function ExportErrorMessage({ error }: { error: string | null }) {
  const { message, details } = formatExportError(error)
  const [open, setOpen] = useState(false)
  if (!error) return null
  return (
    <div className="mt-1 space-y-1">
      <p className="text-xs text-destructive">{message}</p>
      {details ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide details' : 'Details'}
          </Button>
          {open ? (
            <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-muted/80 p-2 text-[10px] leading-snug text-foreground/80 whitespace-pre-wrap">
              {details}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
