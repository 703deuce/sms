'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SpeakerRenamePopover({
  anchor,
  initialName,
  onSave,
  onClose,
}: {
  anchor: DOMRect
  initialName: string
  onSave: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initialName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  return (
    <div
      className="fixed z-50 w-56 rounded-lg border border-border bg-popover p-3 shadow-lg"
      style={{ left: anchor.left, top: anchor.bottom + 6 }}
      data-testid="speaker-rename-popover"
    >
      <p className="mb-2 text-xs font-medium text-muted-foreground">Rename speaker</p>
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'Enter') {
            const trimmed = name.trim()
            if (trimmed) onSave(trimmed)
            onClose()
          }
        }}
        className="h-8 text-sm"
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!name.trim()}
          onClick={() => {
            onSave(name.trim())
            onClose()
          }}
        >
          Save
        </Button>
      </div>
    </div>
  )
}
