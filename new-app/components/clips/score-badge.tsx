'use client'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function ScoreBadge({ score, scores }: { score: number; scores?: Record<string, string> }) {
  const sub = scores
    ? `Hook ${scores.hook ?? '—'} · Flow ${scores.flow ?? '—'} · Value ${scores.value ?? '—'}`
    : ''
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="secondary" className="tabular-nums">{score}</Badge>
        </TooltipTrigger>
        {sub ? <TooltipContent>{sub}</TooltipContent> : null}
      </Tooltip>
    </TooltipProvider>
  )
}
