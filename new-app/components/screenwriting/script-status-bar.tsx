'use client'

import { useScriptLayout } from '@/components/screenwriting/use-script-layout'
import type { JSONContent } from '@tiptap/core'

export function ScriptStatusBar({
  pmJson,
  saveState = 'saved',
  collabLabel,
}: {
  pmJson: JSONContent | null
  saveState?: 'saved' | 'saving' | 'error' | 'offline'
  collabLabel?: string
}) {
  const layout = useScriptLayout(pmJson)
  const pages = layout?.pageCount ?? 0
  const scenes = layout?.sceneEighths ? Object.keys(layout.sceneEighths).length : 0
  const saveLabel =
    saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save error' : saveState === 'offline' ? 'Offline draft' : 'Saved'
  return (
    <div className="sw-fd-status flex flex-wrap gap-4 border-t px-3 py-1 text-xs text-muted-foreground">
      <span>{pages} pages</span>
      <span>{scenes} scenes</span>
      {collabLabel ? <span>{collabLabel}</span> : null}
      <span className="ml-auto">{saveLabel}</span>
    </div>
  )
}
