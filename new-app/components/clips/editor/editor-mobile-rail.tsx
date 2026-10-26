'use client'

import { EditorRail, type EditorPanelId } from '@/components/clips/editor/editor-rail'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

export function EditorMobileRail({
  active,
  onChange,
}: {
  active: EditorPanelId
  onChange: (id: EditorPanelId) => void
}) {
  return (
    <ScrollArea className="w-full shrink-0 border-b border-border lg:hidden">
      <div className="p-2">
        <EditorRail active={active} onChange={onChange} variant="horizontal" />
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
