'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export type ClarityEdit = { wordId: string; text: string }

export function ScriptClarityPanel({
  compositionId,
  onApply,
}: {
  compositionId: string
  onApply: (edits: ClarityEdit[]) => void
}) {
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<ClarityEdit[] | null>(null)
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'heavy'>('medium')

  const run = async () => {
    setBusy(true)
    try {
      const res = await clipsFetch<{ edits: ClarityEdit[] }>(
        `/api/clips/compositions/${compositionId}/clarity`,
        { method: 'POST', body: JSON.stringify({ intensity }) },
      )
      const edits = res.edits ?? []
      if (!edits.length) {
        toast.message('No clarity edits suggested')
        setPending(null)
        return
      }
      setPending(edits)
      toast.success(`Review ${edits.length} suggested word edits`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Clarity failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 p-3 text-sm" data-testid="script-clarity-panel">
      <p className="text-[13px] font-semibold">Edit for clarity</p>
      <div className="flex gap-1">
        {(['low', 'medium', 'heavy'] as const).map((lvl) => (
          <Button
            key={lvl}
            type="button"
            size="sm"
            variant={intensity === lvl ? 'default' : 'outline'}
            className="h-7 flex-1 text-[10px] capitalize"
            onClick={() => setIntensity(lvl)}
          >
            {lvl}
          </Button>
        ))}
      </div>
      <Button type="button" size="sm" disabled={busy} onClick={() => void run()}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : 'Scan transcript'}
      </Button>
      {pending && (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2 text-xs">
          {pending.slice(0, 12).map((e) => (
            <p key={e.wordId} className="text-muted-foreground">
              <span className="font-mono text-[10px]">{e.wordId.split(':').pop()}</span> → {e.text}
            </p>
          ))}
          {pending.length > 12 ? <p className="text-[10px]">+{pending.length - 12} more</p> : null}
        </div>
      )}
      {pending && (
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setPending(null)}>Discard</Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onApply(pending)
              setPending(null)
              toast.success('Clarity edits applied')
            }}
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  )
}
