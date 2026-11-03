'use client'

import { EditorRail, type EditorPanelId } from '@/components/clips/editor/editor-rail'
import type { EditorRailGroupId } from '@/lib/clips/editor/editor-rail-navigation'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

export function EditorMobileRail({
  active,
  onChange,
  onSelectGroup,
}: {
  active: EditorPanelId
  onChange: (id: EditorPanelId) => void
  onSelectGroup?: (groupId: EditorRailGroupId) => void
}) {
  return (
    <ScrollArea className="w-full shrink-0 border-b border-border lg:hidden">
      <div className="p-2">
        <EditorRail active={active} onChange={onChange} onSelectGroup={onSelectGroup} variant="horizontal" />
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
