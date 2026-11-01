'use client'

import { useMemo } from 'react'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { describeEditsChange } from '@/lib/clips/editor/history-labels'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { cn } from '@/lib/utils'

const MAX_ROWS = 50

type Row =
  | { kind: 'future'; label: string; steps: number }
  | { kind: 'current'; label: string }
  | { kind: 'past'; label: string; steps: number }

function buildRows(
  edits: ClipEditsV2,
  past: ClipEditsV2[],
  pastLabels: (string | undefined)[],
  future: ClipEditsV2[],
): Row[] {
  const rows: Row[] = []
  for (let i = future.length - 1; i >= 0; i--) {
    rows.push({ kind: 'future', label: 'Redo', steps: i + 1 })
  }
  rows.push({ kind: 'current', label: 'Current' })
  for (let i = past.length - 1; i >= 0; i--) {
    const steps = -(past.length - i)
    const prev = past[i]!
    const next = i < past.length - 1 ? past[i + 1]! : edits
    const named = pastLabels[i]
    rows.push({ kind: 'past', label: named?.trim() ? named : describeEditsChange(prev, next), steps })
  }
  return rows.slice(0, MAX_ROWS)
}

export function EditorHistoryPanel({
  edits,
  historyPast,
  historyPastLabels,
  historyFuture,
  jumpHistory,
  disabled,
}: {
  edits: ClipEditsV2
  historyPast: ClipEditsV2[]
  historyPastLabels?: (string | undefined)[]
  historyFuture: ClipEditsV2[]
  jumpHistory: (steps: number) => void
  disabled?: boolean
}) {
  const rows = useMemo(
    () => buildRows(edits, historyPast, historyPastLabels ?? [], historyFuture),
    [edits, historyPast, historyPastLabels, historyFuture],
  )

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label="Edit history"
            className="text-muted-foreground"
            data-testid="editor-history-button"
          />
        }
      >
        <History className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1" data-testid="editor-history-panel">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">History</p>
        <ul className="max-h-64 overflow-y-auto">
          {rows.map((row, idx) => {
            if (row.kind === 'current') {
              return (
                <li
                  key={`cur-${idx}`}
                  className="rounded-sm px-2 py-1.5 text-xs font-medium text-foreground"
                  data-testid="editor-history-row"
                >
                  {row.label}
                </li>
              )
            }
            return (
              <li key={`${row.kind}-${idx}`}>
                <button
                  type="button"
                  className={cn(
                    'w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted',
                    row.kind === 'future' && 'text-muted-foreground',
                  )}
                  data-testid="editor-history-row"
                  onClick={() => jumpHistory(row.steps)}
                >
                  {row.label}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
