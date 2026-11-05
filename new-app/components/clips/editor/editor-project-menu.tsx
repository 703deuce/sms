'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { ChevronDown, Download, History, Keyboard, Settings2 } from 'lucide-react'
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
import { cn } from '@/lib/utils'

export type EditorProjectMenuAction =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'button'; label: string; onClick: () => void; disabled?: boolean }

/** File-style menu on the clip editor project title (existing routes/handlers only). */
export function EditorProjectMenu({
  title,
  onTitleChange,
  actions,
  className,
}: {
  title: string
  onTitleChange: (t: string) => void
  actions: {
    newProject: EditorProjectMenuAction
    openProjects: EditorProjectMenuAction
    rename?: EditorProjectMenuAction
    versionsHistory?: EditorProjectMenuAction
    projectSettings?: EditorProjectMenuAction
    export: EditorProjectMenuAction
    keyboardShortcuts?: EditorProjectMenuAction
    backToProjects: EditorProjectMenuAction
  }
  className?: string
}) {
  const [renaming, setRenaming] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const cancelRenameRef = useRef(false)
  const commitRename = () => {
    setRenaming(false)
    if (!cancelRenameRef.current && draftTitle.trim() && draftTitle !== title) onTitleChange(draftTitle.trim())
    cancelRenameRef.current = false
  }
  const inputRef = useRef<HTMLInputElement>(null)

  const item = (a: EditorProjectMenuAction, icon?: React.ReactNode) =>
    a.kind === 'link' ? (
      <DropdownMenuItem key={a.label} render={<Link href={a.href} />}>
        {icon}
        {a.label}
      </DropdownMenuItem>
    ) : (
      <DropdownMenuItem key={a.label} disabled={a.disabled} onClick={a.onClick}>
        {icon}
        {a.label}
      </DropdownMenuItem>
    )

  if (renaming) {
    return (
      <Input
        ref={inputRef}
        autoFocus
        className={cn('h-9 max-w-md border-transparent bg-transparent text-base font-semibold shadow-none hover:border-input focus-visible:border-input', className)}
        value={draftTitle}
        onChange={(e) => setDraftTitle(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
          if (e.key === 'Escape') {
            e.preventDefault()
            cancelRenameRef.current = true
            setDraftTitle(title)
            e.currentTarget.blur()
          }
        }}
        aria-label="Clip title"
        data-testid="editor-clip-title-input"
      />
    )
  }

  return (
    <div className={cn('flex w-full min-w-0 max-w-full items-center', className)} data-testid="editor-project-menu">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex w-full min-w-0 max-w-full items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Project menu"
              data-testid="editor-project-menu-trigger"
            >
              <span className="min-w-0 truncate text-sm font-semibold">{title || 'Untitled'}</span>
              <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
            </button>
          }
        />
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{title}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {item(actions.newProject)}
          {item(actions.openProjects)}
          <DropdownMenuItem
            onClick={() => {
              cancelRenameRef.current = false
              setDraftTitle(title)
              setRenaming(true)
              actions.rename?.kind === 'button' && actions.rename.onClick()
              window.setTimeout(() => inputRef.current?.focus(), 0)
            }}
          >
            Rename
          </DropdownMenuItem>
          {actions.versionsHistory ? item(actions.versionsHistory, <History className="size-4" aria-hidden />) : null}
          {actions.projectSettings ? item(actions.projectSettings, <Settings2 className="size-4" aria-hidden />) : null}
          <DropdownMenuSeparator />
          {item(actions.export, <Download className="size-4" aria-hidden />)}
          {actions.keyboardShortcuts ? item(actions.keyboardShortcuts, <Keyboard className="size-4" aria-hidden />) : null}
          <DropdownMenuSeparator />
          {item(actions.backToProjects)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
