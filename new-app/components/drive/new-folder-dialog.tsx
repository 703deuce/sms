'use client'

import { useState } from 'react'
import { FolderPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { clipsFetch } from '@/lib/clips-api'
import { useClipsDriveOptional } from '@/components/drive/clips-drive-context'

export function NewFolderDialog({ variant = 'sidebar' }: { variant?: 'sidebar' | 'toolbar' }) {
  const router = useRouter()
  const drive = useClipsDriveOptional()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Enter a folder name')
      return
    }
    setBusy(true)
    drive?.setSyncing(true)
    try {
      await clipsFetch('/api/clips/folders', { method: 'POST', body: JSON.stringify({ name: trimmed }) })
      setName('')
      setOpen(false)
      router.refresh()
      window.dispatchEvent(new CustomEvent('clips-folders-changed'))
      toast.success('Folder created')
    } catch {
      toast.error('Could not create folder')
    } finally {
      setBusy(false)
      drive?.setSyncing(false)
    }
  }

  const trigger =
    variant === 'sidebar' ? (
      <Button type="button" variant="ghost" size="icon-sm" className="size-5" title="New folder">
        <FolderPlus className="size-3.5" />
      </Button>
    ) : (
      <Button type="button" variant="outline" size="sm" className="h-8">
        <FolderPlus className="mr-2 size-4" />
        New folder
      </Button>
    )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="folder-name">Folder name</Label>
          <Input
            id="folder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Client work"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
            }}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            Create folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
