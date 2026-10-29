'use client'

import { Component, type ReactNode, useState } from 'react'
import { ChevronDown, History, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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

class VersionsMenuErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[clipper:versions] menu_error', error)
  }

  render() {
    if (this.state.failed) {
      return (
        <Button type="button" size="sm" variant="outline" disabled data-testid="versions-menu-failed">
          Versions unavailable
        </Button>
      )
    }
    return this.props.children
  }
}

function EditorVersionsMenuInner({
  enabled,
  versions,
  onSaveVersion,
  onRestoreVersion,
  onDeleteVersion,
  onRestoreOriginal,
}: {
  enabled: boolean
  versions: EditVersionRow[]
  onSaveVersion: (name: string) => void
  onRestoreVersion: (id: string) => void
  onDeleteVersion: (id: string) => void
  onRestoreOriginal: () => void
}) {
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('My version')
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
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2">
            <History className="size-4" aria-hidden />
            Edit versions
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault()
            setSaveOpen((v) => !v)
          }}
          data-testid="versions-save-item"
        >
          Save version…
        </DropdownMenuItem>
        {saveOpen ? (
          <div className="flex flex-col gap-2 px-2 py-2" data-testid="versions-save-form">
            <Input
              aria-label="Version name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const name = saveName.trim()
                  if (!name) return
                  onSaveVersion(name)
                  setSaveOpen(false)
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              disabled={!saveName.trim()}
              onClick={() => {
                const name = saveName.trim()
                if (!name) return
                onSaveVersion(name)
                setSaveOpen(false)
              }}
            >
              Save
            </Button>
          </div>
        ) : null}
        <DropdownMenuSeparator />
        {versions.length === 0 ? (
          <DropdownMenuItem disabled data-testid="versions-empty-item">
            No saved versions yet
          </DropdownMenuItem>
        ) : (
          versions.map((v) => (
            <DropdownMenuItem
              key={v.id}
              className="flex flex-col items-start gap-1 py-2"
              onClick={(e) => e.preventDefault()}
              data-testid={`versions-row-${v.id}`}
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
        <DropdownMenuItem onClick={onRestoreOriginal} data-testid="versions-restore-original">
          Restore original
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function EditorVersionsMenu(props: {
  enabled: boolean
  versions: EditVersionRow[]
  onSaveVersion: (name: string) => void
  onRestoreVersion: (id: string) => void
  onDeleteVersion: (id: string) => void
  onRestoreOriginal: () => void
}) {
  return (
    <VersionsMenuErrorBoundary>
      <EditorVersionsMenuInner {...props} />
    </VersionsMenuErrorBoundary>
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
