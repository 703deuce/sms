'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatPhone } from '@/lib/format'

type DupGroup = {
  phone: string
  contacts: { id: string; name: string; email: string | null; title: string | null; company: string | null }[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onMerged: () => void
}

const FIELDS = ['name', 'email', 'title', 'company'] as const

export function ContactMergeWizard({ open, onOpenChange, onMerged }: Props) {
  const [groups, setGroups] = useState<DupGroup[]>([])
  const [groupIdx, setGroupIdx] = useState(0)
  const [primaryId, setPrimaryId] = useState('')
  const [mergedId, setMergedId] = useState('')
  const [winners, setWinners] = useState<Record<string, 'primary' | 'merged'>>({})
  const [busy, setBusy] = useState(false)
  const [lastUndo, setLastUndo] = useState<{ mergeRecordId: string; until: string } | null>(null)

  useEffect(() => {
    if (!open) return
    void fetch('/api/crm/native/contacts/duplicates')
      .then((r) => r.json())
      .then((j) => {
        const g = (j.data || []) as DupGroup[]
        setGroups(g)
        setGroupIdx(0)
        if (g[0]?.contacts.length >= 2) {
          setPrimaryId(g[0].contacts[0].id)
          setMergedId(g[0].contacts[1].id)
        }
      })
      .catch(() => toast.error('Could not load duplicates'))
  }, [open])

  const group = groups[groupIdx]
  const primary = group?.contacts.find((c) => c.id === primaryId)
  const merged = group?.contacts.find((c) => c.id === mergedId)

  const merge = async () => {
    if (!primaryId || !mergedId || primaryId === mergedId) {
      toast.error('Pick two different contacts')
      return
    }
    setBusy(true)
    try {
      const fieldWinners: Record<string, 'primary' | 'merged'> = {}
      if (winners.email) fieldWinners.email = winners.email
      if (winners.title) fieldWinners.title = winners.title
      if (winners.company) fieldWinners.company = winners.company
      const r = await fetch('/api/crm/native/contacts/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryId, mergedId, fieldWinners }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Merge failed')
      setLastUndo({ mergeRecordId: j.data.mergeRecordId, until: j.data.undoUntil })
      toast.success('Contacts merged')
      onMerged()
      if (groupIdx < groups.length - 1) setGroupIdx((i) => i + 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Merge failed')
    } finally {
      setBusy(false)
    }
  }

  const undo = async () => {
    if (!lastUndo) return
    try {
      const r = await fetch('/api/crm/native/contacts/merge/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mergeRecordId: lastUndo.mergeRecordId }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Undo failed')
      toast.success('Merge undone')
      setLastUndo(null)
      onMerged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Undo failed')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge duplicate contacts</DialogTitle>
        </DialogHeader>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No duplicate phone numbers found in this workspace.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Group {groupIdx + 1} of {groups.length} · {formatPhone(group.phone)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium">Primary record (keep)</p>
                <select
                  className="w-full rounded border px-2 py-1.5 text-sm"
                  value={primaryId}
                  onChange={(e) => setPrimaryId(e.target.value)}
                  aria-label="Primary contact"
                >
                  {group.contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">Duplicate (merge in)</p>
                <select
                  className="w-full rounded border px-2 py-1.5 text-sm"
                  value={mergedId}
                  onChange={(e) => setMergedId(e.target.value)}
                  aria-label="Merged contact"
                >
                  {group.contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {primary && merged && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 text-left" scope="col">Field</th>
                    <th className="py-2 text-left" scope="col">Primary</th>
                    <th className="py-2 text-left" scope="col">Duplicate</th>
                    <th className="py-2 text-left" scope="col">Keep</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELDS.map((f) => {
                    const pv = f === 'name' ? primary.name : (primary as Record<string, string | null>)[f]
                    const mv = f === 'name' ? merged.name : (merged as Record<string, string | null>)[f]
                    if (f === 'name') return null
                    return (
                      <tr key={f} className="border-b">
                        <td className="py-2 capitalize">{f}</td>
                        <td className="py-2">{pv || '—'}</td>
                        <td className="py-2">{mv || '—'}</td>
                        <td className="py-2">
                          <select
                            className="rounded border px-1 text-xs"
                            value={winners[f] || 'primary'}
                            onChange={(e) =>
                              setWinners((w) => ({ ...w, [f]: e.target.value as 'primary' | 'merged' }))
                            }
                            aria-label={`Winner for ${f}`}
                          >
                            <option value="primary">Primary</option>
                            <option value="merged">Duplicate</option>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {lastUndo && (
              <p className="text-xs text-muted-foreground">
                Undo available until {new Date(lastUndo.until).toLocaleTimeString()}.{' '}
                <button type="button" className="text-primary underline" onClick={() => void undo()}>Undo merge</button>
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={busy || !primaryId || !mergedId} onClick={() => void merge()}>Confirm merge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
