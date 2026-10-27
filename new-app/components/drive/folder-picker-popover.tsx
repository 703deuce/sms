'use client'

import { useState } from 'react'
import { FolderInput } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function FolderPickerPopover({
  folders,
  onSelect,
  triggerLabel = 'Move to…',
  align = 'end' as const,
}: {
  folders: { id: string; name: string }[]
  onSelect: (folderId: string | null) => void | Promise<void>
  triggerLabel?: string
  align?: 'start' | 'center' | 'end'
}) {
  const [open, setOpen] = useState(false)

  const pick = (folderId: string | null) => {
    void Promise.resolve(onSelect(folderId)).then(() => setOpen(false))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button type="button" variant="ghost" size="sm" className="h-8 justify-start px-2 text-[13px] font-normal">
            <FolderInput className="mr-2 size-4" />
            {triggerLabel}
          </Button>
        }
      />
      <PopoverContent align={align} className="w-56 p-1">
        <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Move to folder</p>
        <button
          type="button"
          className="flex h-8 w-full items-center rounded-md px-2 text-[13px] hover:bg-accent"
          onClick={() => pick(null)}
        >
          Library (no folder)
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            type="button"
            className="flex h-8 w-full items-center truncate rounded-md px-2 text-[13px] hover:bg-accent"
            onClick={() => pick(f.id)}
          >
            {f.name}
          </button>
        ))}
        {folders.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">No folders yet. Create one from the sidebar.</p>
        )}
      </PopoverContent>
    </Popover>
  )
}
