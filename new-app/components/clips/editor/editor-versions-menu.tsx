'use client'

import { ChevronDown, History, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type EditVersionRow = {
  id: string
  name: string
  kind: string
  createdAt: string
}

function relativeTime(iso: string): string {
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.round(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return new Date(iso).toLocaleDateString()
}

export function EditorVersionsMenu({
  enabled,
  versions,
  onSaveVersion,
  onRestoreVersion,
  onDeleteVersion,
  onRestoreOriginal,
}: {
  enabled: boolean
  versions: EditVersionRow[]
  onSaveVersion: () => void
  onRestoreVersion: (id: string) => void
  onDeleteVersion: (id: string) => void
  onRestoreOriginal: () => void
}) {
  if (!enabled) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" size="sm" variant="outline" className="gap-1" data-testid="versions-menu">
            Versions
            <ChevronDown className="size-3.5 opacity-70" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <History className="size-4" aria-hidden />
          Edit versions
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={onSaveVersion}>Save version…</DropdownMenuItem>
        <DropdownMenuSeparator />
        {versions.length === 0 ? (
          <DropdownMenuItem disabled>No saved versions yet</DropdownMenuItem>
        ) : (
          versions.map((v) => (
            <DropdownMenuItem
              key={v.id}
              className="flex flex-col items-start gap-1 py-2"
              onClick={(e) => e.preventDefault()}
            >
              <span className="text-sm font-medium">{v.name}</span>
              <span className="text-[10px] text-muted-foreground">{relativeTime(v.createdAt)}</span>
              <span className="mt-1 flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  onClick={() => onRestoreVersion(v.id)}
                >
                  Restore
                </Button>
                {v.kind !== 'original' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive"
                    onClick={() => onDeleteVersion(v.id)}
                  >
                    <Trash2 className="mr-1 size-3" aria-hidden />
                    Delete
                  </Button>
                ) : null}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onRestoreOriginal}>Restore original</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function EditorLayoutMenu({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" size="sm" variant="outline" className="gap-1" data-testid="layout-menu">
            Layout
            <ChevronDown className="size-3.5 opacity-70" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="max-w-sm p-3">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
