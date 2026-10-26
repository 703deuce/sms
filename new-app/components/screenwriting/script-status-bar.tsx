'use client'

import { useScriptLayout } from '@/components/screenwriting/use-script-layout'
import type { JSONContent } from '@tiptap/core'

export function ScriptStatusBar({ pmJson }: { pmJson: JSONContent | null }) {
  const layout = useScriptLayout(pmJson)
  const pages = layout?.pageCount ?? 0
  const scenes = layout?.sceneEighths ? Object.keys(layout.sceneEighths).length : 0
  return (
    <div className="sw-fd-status flex gap-4 border-t px-3 py-1 text-xs text-muted-foreground">
      <span>{pages} pages</span>
      <span>{scenes} scenes</span>
      <span className="ml-auto">Saved</span>
    </div>
  )
}
