'use client'

import { useCallback, useState } from 'react'
import type { ProducerToolCall } from '@/lib/clips/edits-reducer'
import { producerPlanFromTools, type ProducerPlanStep } from '@/lib/clips/editor/producer-plan'
import { Button } from '@/components/ui/button'

export function ProducerPlanList({
  tools,
  busy,
  onRunStep,
  onRunAll,
  onDismiss,
}: {
  tools: ProducerToolCall[]
  busy?: boolean
  onRunStep: (index: number) => void
  onRunAll: () => void
  onDismiss: () => void
}) {
  const steps: ProducerPlanStep[] = producerPlanFromTools(tools)
  const [done, setDone] = useState<Set<number>>(() => new Set())

  const markDone = useCallback((i: number) => setDone((d) => new Set(d).add(i)), [])

  if (!steps.length) return null

  return (
    <div className="space-y-2 border-b bg-muted/30 px-3 py-2 text-xs" data-testid="producer-plan">
      <p className="font-medium">Plan ({steps.length} step{steps.length === 1 ? '' : 's'})</p>
      <ol className="max-h-40 space-y-1 overflow-y-auto">
        {steps.map((s) => (
          <li key={s.index} className="flex flex-wrap items-center gap-2 rounded border border-border/60 bg-background px-2 py-1">
            <span className="font-mono text-[10px] text-muted-foreground">{s.index + 1}</span>
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <Button
              size="xs"
              variant="secondary"
              disabled={busy || done.has(s.index)}
              data-testid={`producer-plan-run-${s.index}`}
              onClick={() => {
                onRunStep(s.index)
                markDone(s.index)
              }}
            >
              Run
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button size="xs" disabled={busy} data-testid="producer-plan-run-all" onClick={onRunAll}>
          Run all
        </Button>
        <Button size="xs" variant="ghost" onClick={onDismiss}>
          Dismiss plan
        </Button>
      </div>
    </div>
  )
}
