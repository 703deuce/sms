'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CircleCheck, CircleHelp, Loader2, Menu, Search } from 'lucide-react'
import { useClipsWorkspace } from '@/components/providers/clips-workspace-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { useState } from 'react'

export function DriveTopBar({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  syncing,
}: {
  searchValue: string
  onSearchChange: (v: string) => void
  onSearchSubmit: () => void
  syncing?: boolean
}) {
  const { workspaceName } = useClipsWorkspace()
  const router = useRouter()
  const [scope, setScope] = useState('everywhere')

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3 md:px-4"
      data-testid="drive-top-bar"
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Menu">
              <Menu className="size-[18px]" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem render={<Link href="/app/clips/new" />}>New project</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/app/clips/new" />}>Import…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/app/settings" />}>Settings</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/app/help" />}>Help</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="text-muted-foreground" title={syncing ? 'Syncing…' : 'All changes saved'}>
        {syncing ? <Loader2 className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}
      </span>

      <div className="mx-auto flex h-8 w-full max-w-[720px] items-center gap-2 rounded-lg bg-muted px-2">
        <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <Select value={scope} onValueChange={(v) => v && setScope(v)}>
          <SelectTrigger className="h-7 w-[120px] border-0 bg-transparent text-xs shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="everywhere">Everywhere</SelectItem>
            <SelectItem value="workspace">This workspace</SelectItem>
            <SelectItem value="folder">This folder</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="h-7 flex-1 border-0 bg-transparent text-[13px] shadow-none focus-visible:ring-0"
          placeholder="Search for projects, media, and transcripts"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearchSubmit()
            if (e.key === '/' && !searchValue) {
              e.preventDefault()
              e.currentTarget.focus()
            }
          }}
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" aria-label="Account">
              <span className="flex size-7 items-center justify-center rounded-full bg-speaker-1/30 text-xs font-semibold">
                {workspaceName.slice(0, 1).toUpperCase()}
              </span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{workspaceName}</p>
            <p className="text-xs text-muted-foreground">Workspace</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/app/settings')}>Settings</DropdownMenuItem>
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs">Theme</span>
            <ThemeToggle />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button type="button" variant="ghost" size="icon-sm" aria-label="Help" render={<Link href="/app/help" />}>
        <CircleHelp className="size-[18px]" />
      </Button>
    </header>
  )
}
