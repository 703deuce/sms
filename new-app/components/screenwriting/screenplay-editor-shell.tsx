'use client'

import { useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import type { FormatSpec } from '@/lib/screenwriting/formats/types'
import { ScreenplayEditor } from '@/components/screenwriting/screenplay-editor'
import { ScriptStatusBar } from '@/components/screenwriting/script-status-bar'

export function ScreenplayEditorShell({
  scriptId,
  formatSpec,
  initialDoc,
}: {
  scriptId: string
  formatSpec: FormatSpec
  initialDoc: object
}) {
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span>Local mode · autosave to database</span>
        <span className="tabular-nums">
          {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Saved'}
        </span>
      </div>
      <ScreenplayEditor
        scriptId={scriptId}
        formatSpec={formatSpec}
        initialDoc={initialDoc as JSONContent}
        onSaveState={setSaveState}
      />
      <ScriptStatusBar pmJson={initialDoc as JSONContent} />
    </div>
  )
}
