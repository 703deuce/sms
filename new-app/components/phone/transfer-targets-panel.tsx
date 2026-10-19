'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Panel } from '@/components/app/page-primitives'
import { fetchTransferTargets, saveTransferTargets, type TransferTargetDto } from '@/lib/phone-api'

export function TransferTargetsPanel() {
  const [targets, setTargets] = useState<TransferTargetDto[]>([])
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetchTransferTargets()
      .then((rows) => {
        setTargets(rows)
        setDirty(false)
      })
      .catch(() => toast.error('Could not load transfer destinations'))
      .finally(() => setLoading(false))
  }, [])

  const save = () => {
    void saveTransferTargets(targets.filter((t) => t.number.trim()))
      .then((rows) => {
        setTargets(rows)
        setDirty(false)
        toast.success('Transfer destinations saved')
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not save'))
  }

  return (
    <Panel title="Transfer destinations" description="Used during live calls and when routing forwards externally.">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {targets.length === 0 && (
            <p className="text-sm text-muted-foreground">Add numbers your team transfers callers to (on-call line, billing, etc.).</p>
          )}
          {targets.map((t, i) => (
            <div key={t.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <div>
                <Label className="sr-only">Name</Label>
                <Input
                  value={t.name}
                  onChange={(e) => {
                    setDirty(true)
                    setTargets((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                  }}
                  placeholder="Label"
                  aria-label={`Transfer destination ${i + 1} name`}
                />
              </div>
              <div>
                <Label className="sr-only">Phone</Label>
                <Input
                  value={t.number}
                  onChange={(e) => {
                    setDirty(true)
                    setTargets((rows) => rows.map((r, j) => (j === i ? { ...r, number: e.target.value } : r)))
                  }}
                  placeholder="+1…"
                  className="font-mono"
                  aria-label={`Transfer destination ${i + 1} phone`}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove destination"
                onClick={() => {
                  setDirty(true)
                  setTargets((rows) => rows.filter((_, j) => j !== i))
                }}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDirty(true)
                setTargets((rows) => [...rows, { id: `t${Date.now()}`, name: '', number: '' }])
              }}
            >
              <Plus />
              Add destination
            </Button>
            <Button type="button" size="sm" disabled={!dirty} onClick={save}>
              Save destinations
            </Button>
          </div>
        </div>
      )}
    </Panel>
  )
}
