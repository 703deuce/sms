'use client'

import { Button } from '@/components/ui/button'
import { REVISION_SETS } from '@/lib/screenwriting/revisions/palette'

export function RevisionsPanel({
  revisionSet,
  onRevisionSet,
  pageLocks,
  onPageLocks,
  pageCount,
  onMarkRevised,
}: {
  revisionSet: string
  onRevisionSet: (id: string) => void
  pageLocks: number[]
  onPageLocks: (pages: number[]) => void
  pageCount: number
  onMarkRevised: () => void
}) {
  const active = REVISION_SETS.find((r) => r.id === revisionSet) ?? REVISION_SETS[0]
  return (
    <div className="space-y-3 text-xs">
      <p className="text-muted-foreground">Revision pages use colored paper; revised lines show <strong>*</strong> in the margin.</p>
      <div className="flex flex-wrap gap-1">
        {REVISION_SETS.map((r) => (
          <button
            key={r.id}
            type="button"
            title={r.label}
            className={`h-6 w-6 rounded border ${revisionSet === r.id ? 'ring-2 ring-primary' : ''}`}
            style={{ background: r.color }}
            onClick={() => onRevisionSet(r.id)}
          />
        ))}
      </div>
      <p>Active: <strong>{active.label}</strong> {active.asterisk ? '(asterisk on)' : ''}</p>
      <Button size="sm" variant="outline" onClick={onMarkRevised}>Mark selection revised *</Button>
      <div>
        <p className="mb-1 font-medium">Page locks</p>
        <ul className="max-h-32 space-y-1 overflow-auto">
          {Array.from({ length: Math.max(pageCount, 1) }, (_, i) => i + 1).map((p) => {
            const locked = pageLocks.includes(p)
            return (
              <li key={p} className="flex items-center gap-2">
                <button
                  type="button"
                  className={`rounded px-2 py-0.5 ${locked ? 'bg-destructive/20' : 'hover:bg-muted'}`}
                  onClick={() => {
                    if (locked) onPageLocks(pageLocks.filter((x) => x !== p))
                    else onPageLocks([...pageLocks, p].sort((a, b) => a - b))
                  }}
                >
                  Page {p} {locked ? '🔒' : 'unlock'}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
