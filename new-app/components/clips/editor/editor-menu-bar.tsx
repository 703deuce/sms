'use client'

import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** MENUBAR1: one item in the editor top menu bar. `disabledHint` set = greyed out, hint shown (never hidden). */
export type EditorMenuItem = {
  id: string
  label: string
  onSelect: () => void
  disabledHint?: string | null
  shortcut?: string
}
export type EditorMenuGroup = { label?: string; items: EditorMenuItem[] }
export type EditorMenu = { id: string; label: string; groups: EditorMenuGroup[] }

export function EditorMenuBar({ menus, onOpenSearch }: { menus: EditorMenu[]; onOpenSearch: () => void }) {
  return (
    <div className="hidden min-w-0 items-center gap-1 lg:flex" data-testid="editor-menu-bar">
      <nav className="flex items-center" aria-label="Editor menu">
        {menus.map((menu) => (
          <DropdownMenu key={menu.id}>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground data-[popup-open]:bg-muted data-[popup-open]:text-foreground"
                  data-testid={`editor-menu-${menu.id}`}
                />
              }
            >
              {menu.label}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72" sideOffset={6}>
              {menu.groups.map((group, gi) => (
                <DropdownMenuGroup key={`${menu.id}-${gi}`}>
                  {gi > 0 ? <DropdownMenuSeparator /> : null}
                  {group.label ? (
                    <DropdownMenuLabel className="px-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </DropdownMenuLabel>
                  ) : null}
                  {group.items.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      disabled={Boolean(item.disabledHint)}
                      onClick={() => item.onSelect()}
                      data-testid={`editor-menu-item-${item.id}`}
                      title={item.disabledHint ?? undefined}
                    >
                      <span className="truncate">{item.label}</span>
                      {item.disabledHint ? (
                        <span className="ml-auto shrink-0 pl-3 text-[11px] text-muted-foreground">{item.disabledHint}</span>
                      ) : item.shortcut ? (
                        <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </nav>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-2 px-2.5 text-[13px] font-normal text-muted-foreground xl:w-48 xl:justify-start"
        onClick={onOpenSearch}
        aria-label="Search tools"
        data-testid="editor-menu-search"
      >
        <Search className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden xl:inline">Search tools…</span>
        <Kbd className="ml-auto hidden xl:inline-flex">⌘K</Kbd>
      </Button>
    </div>
  )
}
