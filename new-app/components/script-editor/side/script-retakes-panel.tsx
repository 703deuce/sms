'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'
import { formatScriptTimecode } from '@/lib/clips/script-editor/sync-playhead'

type RetakeRange = { startMs: number; endMs: number; reason: string; wordIds: string[] }

export function ScriptRetakesPanel({
  compositionId,
  rangeStartMs,
  onApplyDelete,
}: {
  compositionId: string
  rangeStartMs: number
  onApplyDelete: (wordIds: string[]) => void
}) {
  const [busy, setBusy] = useState(false)
  const [ranges, setRanges] = useState<RetakeRange[]>([])
  const [checked, setChecked] = useState<Record<number, boolean>>({})

  const find = async () => {
    setBusy(true)
    try {
      const data = await clipsFetch<{ ranges: RetakeRange[] }>(
        `/api/clips/compositions/${compositionId}/retakes`,
        { method: 'POST', body: '{}' },
      )
      setRanges(data.ranges ?? [])
      setChecked(Object.fromEntries((data.ranges ?? []).map((_, i) => [i, true])))
    } finally {
      setBusy(false)
    }
  }

  const apply = () => {
    const ids = ranges.flatMap((r, i) => (checked[i] ? r.wordIds : []))
    const unique = [...new Set(ids)]
    if (!unique.length) return
    onApplyDelete(unique)
    setRanges([])
    setChecked({})
  }

  return (
    <div className="flex flex-col gap-3 p-3 text-sm" data-testid="script-retakes-panel">
      <p className="text-[13px] font-semibold">Remove retakes</p>
      <p className="text-xs text-muted-foreground">LLM proposes duplicate takes; review before cutting (§15).</p>
      <Button type="button" size="sm" disabled={busy} onClick={() => void find()}>
        {busy ? 'Scanning…' : 'Find retakes'}
      </Button>
      {ranges.length > 0 && (
        <ul className="max-h-48 space-y-2 overflow-y-auto">
          {ranges.map((r, i) => (
            <li key={i} className="rounded-md border border-border px-2 py-1.5 text-xs">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked[i] ?? false}
                  onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))}
                />
                <span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {formatScriptTimecode(r.startMs - rangeStartMs)}–{formatScriptTimecode(r.endMs - rangeStartMs)}
                  </span>
                  <span className="mt-0.5 block">{r.reason}</span>
                  <span className="text-[10px] text-muted-foreground">{r.wordIds.length} words</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {ranges.length > 0 && (
        <Button type="button" size="sm" variant="destructive" onClick={apply}>
          Cut selected retakes
        </Button>
      )}
    </div>
  )
}
