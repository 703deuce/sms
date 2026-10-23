'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Folder = { id: string; name: string; parentId: string | null }

type Props = {
  selectedFolderId: string
  onSelectFolder: (folderId: string) => void
  onFoldersChange?: () => void
}

export function ContactsFolderTree({ selectedFolderId, onSelectFolder, onFoldersChange }: Props) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [newName, setNewName] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')

  const reload = useCallback(() => {
    void fetch('/api/crm/native/folders')
      .then((r) => r.json())
      .then((j) => setFolders(j.data || []))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const createFolder = async () => {
    if (!newName.trim()) return
    try {
      await fetch('/api/crm/native/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      setNewName('')
      reload()
      onFoldersChange?.()
      toast.success('Folder created')
    } catch {
      toast.error('Could not create folder')
    }
  }

  const saveRename = async (id: string) => {
    try {
      await fetch('/api/crm/native/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: renameName.trim() }),
      })
      setRenameId(null)
      reload()
      onFoldersChange?.()
    } catch {
      toast.error('Rename failed')
    }
  }

  return (
    <nav aria-label="Contact folders" className="flex flex-col gap-2 text-sm">
      <button
        type="button"
        className={cn(
          'rounded-md px-2 py-1.5 text-left hover:bg-muted',
          !selectedFolderId && 'bg-muted font-medium',
        )}
        onClick={() => onSelectFolder('')}
      >
        All contacts
      </button>
      <ul className="space-y-0.5">
        {folders.map((f) => (
          <li key={f.id}>
            {renameId === f.id ? (
              <div className="flex gap-1">
                <Input
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  aria-label="Folder name"
                  className="h-8"
                />
                <Button type="button" size="sm" onClick={() => void saveRename(f.id)}>Save</Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={cn(
                    'flex-1 rounded-md px-2 py-1.5 text-left hover:bg-muted',
                    selectedFolderId === f.id && 'bg-muted font-medium',
                  )}
                  onClick={() => onSelectFolder(f.id)}
                >
                  {f.name}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setRenameId(f.id)
                    setRenameName(f.name)
                  }}
                >
                  Rename
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-1 pt-2 border-t">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New folder"
          aria-label="New folder name"
          className="h-8"
        />
        <Button type="button" size="sm" onClick={() => void createFolder()}>Add</Button>
      </div>
    </nav>
  )
}
