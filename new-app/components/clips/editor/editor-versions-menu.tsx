'use client'

import { Component, type ReactNode, useEffect, useRef, useState } from 'react'
import { ChevronDown, History, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

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

function defaultVersionName(): string {
  const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `Version ${stamp}`
}

function SaveVersionDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (name: string) => void
}) {
  const [saveName, setSaveName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setSaveName('')
    const t = window.setTimeout(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.select()
    }, 0)
    return () => window.clearTimeout(t)
  }, [open])

  const submit = () => {
    const name = saveName.trim() || defaultVersionName()
    onSave(name)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="versions-save-dialog">
        <DialogHeader>
          <DialogTitle>Save version</DialogTitle>
          <DialogDescription>Name this snapshot of your current edits.</DialogDescription>
        </DialogHeader>
        <Input
          ref={inputRef}
          aria-label="Version name"
          placeholder="Version name"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} data-testid="versions-save-submit">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function isAutoVersion(v: EditVersionRow): boolean {
  return v.kind === 'auto' || v.name.startsWith('Before restore')
}

const AUTO_VERSION_CAP = 5

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
  const [menuOpen, setMenuOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [autoOpen, setAutoOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<EditVersionRow | null>(null)
  if (!enabled) return null

  const manual = versions.filter((v) => !isAutoVersion(v))
  const auto = versions.filter(isAutoVersion).slice(0, AUTO_VERSION_CAP)

  const versionRow = (v: EditVersionRow) => (
    <DropdownMenuItem
      key={v.id}
      className="flex flex-col items-start gap-1 py-2"
      onClick={(e) => e.preventDefault()}
      data-testid={`versions-row-${v.id}`}
    >
      <span className="text-sm font-medium">{v.name}</span>
      <span className="text-[11px] text-muted-foreground">{relativeTime(v.createdAt)}</span>
      <span className="mt-1 flex gap-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setMenuOpen(false)
            onRestoreVersion(v.id)
          }}
        >
          Restore
        </Button>
        {v.kind !== 'original' ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-destructive"
            onClick={() => setPendingDelete(v)}
          >
            <Trash2 className="mr-1 size-3" aria-hidden />
            Delete
          </Button>
        ) : null}
      </span>
    </DropdownMenuItem>
  )

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
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
              setMenuOpen(false)
              setSaveDialogOpen(true)
            }}
            data-testid="versions-save-item"
          >
            Save version…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {manual.length === 0 && auto.length === 0 ? (
            <DropdownMenuItem disabled data-testid="versions-empty-item">
              No saved versions yet
            </DropdownMenuItem>
          ) : (
            manual.map((v) => versionRow(v))
          )}
          {auto.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  setAutoOpen((o) => !o)
                }}
                data-testid="versions-auto-toggle"
              >
                Auto backups ({auto.length})
              </DropdownMenuItem>
              {autoOpen ? auto.map((v) => versionRow(v)) : null}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false)
              onRestoreOriginal()
            }}
            data-testid="versions-restore-original"
          >
            Restore original
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SaveVersionDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={onSaveVersion}
      />
      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md" data-testid="versions-delete-dialog">
          <DialogHeader>
            <DialogTitle>Delete version?</DialogTitle>
            <DialogDescription>
              {pendingDelete ? `"${pendingDelete.name}" will be removed permanently.` : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              data-testid="versions-delete-confirm"
              onClick={() => {
                if (pendingDelete) onDeleteVersion(pendingDelete.id)
                setPendingDelete(null)
                setMenuOpen(false)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
    <Popover>
      <PopoverTrigger
        render={
          <Button type="button" size="sm" variant="outline" className="gap-1" data-testid="layout-menu">
            Layout
            <ChevronDown className="size-3.5 opacity-70" aria-hidden />
          </Button>
        }
      />
      <PopoverContent align="end" side="bottom" collisionPadding={16} className="max-w-[min(100vw-1rem,22rem)] p-3">
        {children}
      </PopoverContent>
    </Popover>
  )
}
