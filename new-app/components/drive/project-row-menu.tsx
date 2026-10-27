'use client'

import { useRouter } from 'next/navigation'
import { Copy, FolderInput, Link2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'

export function ProjectRowMenu({
  projectId,
  title,
  onTrash,
}: {
  projectId: string
  title: string
  onTrash?: () => void
}) {
  const router = useRouter()

  const copyLink = () => {
    const url = `${window.location.origin}/app/clips/${projectId}`
    void navigator.clipboard.writeText(url)
    toast.success('Project link copied')
  }

  const moveToFolder = async (folderId: string | null) => {
    await clipsFetch('/api/clips/projects/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: 'move', projectIds: [projectId], folderId }),
    })
    router.refresh()
    toast.success('Moved')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions for ${title}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => router.push(`/app/clips/${projectId}`)}>Open</DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast.message('Rename opens in project settings')}>
          <Pencil className="mr-2 size-4" />
          Rename project
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void moveToFolder(null)}>
          <FolderInput className="mr-2 size-4" />
          Move to…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink}>
          <Link2 className="mr-2 size-4" />
          Copy project link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => {
            void clipsFetch('/api/clips/projects/bulk', {
              method: 'POST',
              body: JSON.stringify({ action: 'trash', projectIds: [projectId] }),
            }).then(() => {
              onTrash?.()
              router.refresh()
              toast.success('Moved to trash')
            })
          }}
        >
          <Trash2 className="mr-2 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
