'use client'

import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ScriptMarkerHeading({
  markerId,
  label,
  onRename,
  onRemove,
  onGoTo,
}: {
  markerId: string
  label: string
  onRename: (label: string) => void
  onRemove: () => void
  onGoTo: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)

  if (editing) {
    return (
      <div className="mb-1 mt-4 flex items-center gap-2" data-marker-id={markerId}>
        <Input
          className="h-8 text-sm font-semibold"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false)
            const next = draft.trim() || 'Marker'
            onRename(next)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              setEditing(false)
              onRename(draft.trim() || 'Marker')
            }
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      </div>
    )
  }

  return (
    <div
      className="group/marker mb-1 mt-4 flex items-center justify-between gap-2 text-sm font-semibold text-foreground"
      data-marker-id={markerId}
    >
      <button type="button" className="text-left hover:text-primary" onClick={() => setEditing(true)}>
        {label}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover/marker:opacity-100"
              aria-label="Marker actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(true)}>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={onGoTo}>Go to</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={onRemove}>Remove marker</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
