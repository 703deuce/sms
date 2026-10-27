'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function MoveToFolderDialog({
  open,
  onOpenChange,
  folders,
  onSelect,
  title = 'Move to folder',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: { id: string; name: string }[]
  onSelect: (folderId: string | null) => void | Promise<void>
  title?: string
}) {
  const pick = (folderId: string | null) => {
    void Promise.resolve(onSelect(folderId)).then(() => onOpenChange(false))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1 py-2">
          <button
            type="button"
            className="flex h-9 w-full items-center rounded-lg px-3 text-left text-[13px] hover:bg-accent"
            onClick={() => pick(null)}
          >
            Library (no folder)
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              className="flex h-9 w-full items-center truncate rounded-lg px-3 text-left text-[13px] hover:bg-accent"
              onClick={() => pick(f.id)}
            >
              {f.name}
            </button>
          ))}
          {folders.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Create a folder from the sidebar first.</p>
          )}
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  )
}
