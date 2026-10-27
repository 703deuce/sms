'use client'

import { T2vPanelCaptions } from '@/components/t2v/t2v-panel-captions'
import { T2vPanelTemplates } from '@/components/t2v/t2v-panel-templates'
import type { T2vDraftV1 } from '@/lib/t2v/types'

export function T2vPanelStyles({
  draftId,
  doc,
  onChange,
  onTemplateApplied,
}: {
  draftId: string
  doc: T2vDraftV1
  onChange: (next: T2vDraftV1) => void
  onTemplateApplied: (doc: T2vDraftV1, revision: number) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <T2vPanelCaptions doc={doc} onChange={onChange} />
      <div className="border-t border-border p-2">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Templates</p>
        <T2vPanelTemplates draftId={draftId} onApplied={onTemplateApplied} />
      </div>
    </div>
  )
}
