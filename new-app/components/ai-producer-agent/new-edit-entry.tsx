'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { aiProducerAgentPublicEnabled, AI_PRODUCER_AGENT_LABEL } from '@/lib/ai-producer-agent/flags'
import { NewEditDialog, type NewEditDialogSource } from '@/components/ai-producer-agent/new-edit-dialog'

export function NewEditEntry(props: { sources: NewEditDialogSource[]; clipId?: string; projectId?: string }) {
  const [open, setOpen] = useState(false)
  if (!aiProducerAgentPublicEnabled()) return null
  return (
    <>
      <Button
        size="xs"
        variant="outline"
        className="gap-1"
        data-testid="ai-producer-agent-new-edit-entry"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="size-3" aria-hidden />
        {AI_PRODUCER_AGENT_LABEL}
      </Button>
      <NewEditDialog open={open} onOpenChange={setOpen} defaultSources={props.sources} />
    </>
  )
}
