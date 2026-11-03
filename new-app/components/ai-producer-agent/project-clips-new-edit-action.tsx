'use client'

import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { aiProducerAgentPublicEnabled, AI_PRODUCER_AGENT_LABEL } from '@/lib/ai-producer-agent/flags'
import { NewEditDialog, type NewEditDialogSource } from '@/components/ai-producer-agent/new-edit-dialog'

export function ProjectClipsNewEditAction({
  projectId,
  clipIds,
}: {
  projectId: string
  clipIds: string[]
}) {
  const [open, setOpen] = useState(false)
  const sources = useMemo<NewEditDialogSource[]>(
    () =>
      clipIds.slice(0, 8).map((clipId, i) => ({
        sourceId: `src_${i}`,
        kind: 'clip' as const,
        clipId,
        projectId,
      })),
    [clipIds, projectId],
  )
  if (!aiProducerAgentPublicEnabled()) return null
  return (
    <>
      <Button size="sm" variant="outline" className="gap-1" data-testid="ai-producer-agent-project-entry" onClick={() => setOpen(true)}>
        <Sparkles className="size-3.5" aria-hidden />
        {AI_PRODUCER_AGENT_LABEL}
      </Button>
      <NewEditDialog open={open} onOpenChange={setOpen} defaultSources={sources.length ? sources : [{ sourceId: 'project', kind: 'clip', projectId }]} />
    </>
  )
}
