'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export type ImportMode = 'replace' | 'append' | 'new'

export function ImportDialog({
  open,
  filename,
  onClose,
  onConfirm,
}: {
  open: boolean
  filename: string
  onClose: () => void
  onConfirm: (mode: ImportMode) => void
}) {
  const [mode, setMode] = useState<ImportMode>('replace')
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="max-w-md rounded-lg border bg-card p-4 shadow-lg">
        <h3 className="font-semibold">Import {filename}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Replace saves a <strong>PRE_IMPORT</strong> snapshot first. Append adds to the end. New creates another script in this project.
        </p>
        <div className="mt-3 space-y-2 text-sm">
          {(
            [
              ['replace', 'Replace script', 'Snapshot then overwrite'],
              ['append', 'Append', 'Add imported scenes after current content'],
              ['new', 'New script', 'Import into a new script tab'],
            ] as const
          ).map(([m, title, hint]) => (
            <label key={m} className="flex cursor-pointer gap-2 rounded border p-2">
              <input type="radio" name="import-mode" checked={mode === m} onChange={() => setMode(m)} />
              <span>
                <strong>{title}</strong>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => onConfirm(mode)}>Import</Button>
        </div>
      </div>
    </div>
  )
}
