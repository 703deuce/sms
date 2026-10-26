'use client'

import type { BreakdownTag } from '@/lib/screenwriting/breakdown/types'
import { BREAKDOWN_CATEGORIES } from '@/lib/screenwriting/breakdown/types'
import { breakdownReport } from '@/lib/screenwriting/breakdown/report'

export function BreakdownPanel({
  tags,
  onRemove,
}: {
  tags: BreakdownTag[]
  onRemove: (id: string) => void
}) {
  const report = breakdownReport(tags)
  return (
    <div className="space-y-2 text-xs">
      <p className="text-muted-foreground">
        Select text in the script, then press <kbd className="rounded border px-1">Ctrl+Shift+B</kbd> to tag.
      </p>
      {!tags.length ? <p>No tags yet.</p> : null}
      <ul className="max-h-40 space-y-1 overflow-auto">
        {tags.map((t) => (
          <li key={t.id} className="flex justify-between gap-2 border-b pb-1">
            <span><strong>{t.category}</strong>: {t.label}</span>
            <button type="button" className="text-destructive" onClick={() => onRemove(t.id)}>×</button>
          </li>
        ))}
      </ul>
      {report.length ? (
        <div>
          <p className="font-medium">Breakdown report</p>
          <table className="w-full text-[10px]">
            <tbody>
              {report.map((r) => (
                <tr key={r.category}>
                  <td className="font-medium capitalize">{r.category}</td>
                  <td>{r.count}</td>
                  <td className="truncate">{r.items.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="text-[10px] text-muted-foreground">Categories: {BREAKDOWN_CATEGORIES.join(', ')}</p>
    </div>
  )
}
