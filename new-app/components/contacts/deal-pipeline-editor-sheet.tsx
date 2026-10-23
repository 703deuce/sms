'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type StageRow = {
  id?: string
  name: string
  sortOrder: number
  isClosedWon?: boolean
  isClosedLost?: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function DealPipelineEditorSheet({ open, onOpenChange, onSaved }: Props) {
  const [stages, setStages] = useState<StageRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    void fetch('/api/crm/native/deal-stages')
      .then((r) => r.json())
      .then((j) => {
        const rows = (j.data || []) as { id: string; name: string; sortOrder: number; isClosedWon: boolean; isClosedLost: boolean }[]
        setStages(
          rows.map((s) => ({
            id: s.id,
            name: s.name,
            sortOrder: s.sortOrder,
            isClosedWon: s.isClosedWon,
            isClosedLost: s.isClosedLost,
          })),
        )
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load stages'))
      .finally(() => setLoading(false))
  }, [open])

  const save = async () => {
    if (!stages.length) {
      toast.error('At least one stage is required')
      return
    }
    try {
      const payload = stages.map((s, i) => ({
        id: s.id,
        name: s.name.trim(),
        sortOrder: i,
        isClosedWon: Boolean(s.isClosedWon),
        isClosedLost: Boolean(s.isClosedLost),
      }))
      const r = await fetch('/api/crm/native/deal-stages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages: payload }),
      })
      const j = await r.json()
      if (!r.ok || j.error) throw new Error(j.error || 'Save failed')
      toast.success('Pipeline updated')
      onSaved()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= stages.length) return
    setStages((prev) => {
      const copy = [...prev]
      const [row] = copy.splice(index, 1)
      copy.splice(next, 0, row)
      return copy
    })
  }

  const removeStage = (index: number) => {
    if (stages.length <= 1) {
      toast.error('Keep at least one stage. Move deals to another stage before removing.')
      return
    }
    setStages((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Manage pipeline</SheetTitle>
        </SheetHeader>
        <p className="mt-2 text-xs text-muted-foreground">
          Renaming or reordering applies to future deals. Removing a stage does not delete deals — move them first if a stage is in use.
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading stages…</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {stages.map((s, i) => (
              <li key={s.id || `new-${i}`} className="rounded-lg border p-3">
                <Input
                  value={s.name}
                  onChange={(e) =>
                    setStages((prev) => prev.map((row, idx) => (idx === i ? { ...row, name: e.target.value } : row)))
                  }
                  aria-label={`Stage ${i + 1} name`}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={Boolean(s.isClosedWon)}
                      onChange={(e) =>
                        setStages((prev) =>
                          prev.map((row, idx) =>
                            idx === i ? { ...row, isClosedWon: e.target.checked, isClosedLost: e.target.checked ? false : row.isClosedLost } : row,
                          ),
                        )
                      }
                    />
                    Won
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={Boolean(s.isClosedLost)}
                      onChange={(e) =>
                        setStages((prev) =>
                          prev.map((row, idx) =>
                            idx === i ? { ...row, isClosedLost: e.target.checked, isClosedWon: e.target.checked ? false : row.isClosedWon } : row,
                          ),
                        )
                      }
                    />
                    Lost
                  </label>
                  <Button type="button" size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>Up</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === stages.length - 1}>Down</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeStage(i)}>Remove</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStages((prev) => [...prev, { name: 'New stage', sortOrder: prev.length }])}
          >
            Add stage
          </Button>
          <Button type="button" onClick={() => void save()}>Save pipeline</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
