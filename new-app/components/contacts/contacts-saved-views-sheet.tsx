'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

export type SavedViewRow = {
  id: string
  name: string
  pinned: boolean
  filtersJson?: Record<string, unknown>
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  views: SavedViewRow[]
  onViewsChange: () => void
  activeViewId: string
  onSelectView: (id: string) => void
  currentFilters?: Record<string, unknown>
}

export function ContactsSavedViewsSheet({
  open,
  onOpenChange,
  views,
  onViewsChange,
  activeViewId,
  onSelectView,
  currentFilters = {},
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [leadStage, setLeadStage] = useState('')
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    if (!open) return
    const v = views.find((x) => x.id === editingId)
    if (v) {
      setName(v.name)
      setPinned(v.pinned)
      const f = v.filtersJson || {}
      setLeadStage(typeof f.leadStage === 'string' ? f.leadStage : '')
    } else {
      setName('')
      setLeadStage(typeof currentFilters.leadStage === 'string' ? currentFilters.leadStage : '')
      setPinned(false)
    }
  }, [open, editingId, views, currentFilters.leadStage])

  const save = async () => {
    if (!name.trim()) {
      toast.error('View name is required')
      return
    }
    const filtersJson = { ...currentFilters, ...(leadStage.trim() ? { leadStage: leadStage.trim() } : {}) }
    try {
      const r = await fetch(editingId ? `/api/crm/native/views/${editingId}` : '/api/crm/native/views', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), filtersJson, pinned }),
      })
      const j = await r.json()
      if (!r.ok || j.error) throw new Error(j.error || 'Save failed')
      toast.success(editingId ? 'View updated' : 'View created')
      setEditingId(null)
      onViewsChange()
      if (j.data?.id) onSelectView(j.data.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this saved view?')) return
    try {
      const r = await fetch(`/api/crm/native/views/${id}`, { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok || j.error) throw new Error(j.error || 'Delete failed')
      toast.success('View deleted')
      if (activeViewId === id) onSelectView('')
      onViewsChange()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const duplicate = async (v: SavedViewRow) => {
    try {
      const r = await fetch('/api/crm/native/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${v.name} (copy)`,
          filtersJson: v.filtersJson || {},
          pinned: false,
        }),
      })
      const j = await r.json()
      if (!r.ok || j.error) throw new Error(j.error || 'Duplicate failed')
      toast.success('View duplicated')
      onViewsChange()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Duplicate failed')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Saved views</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <p className="text-sm font-medium">{editingId ? 'Edit view' : 'New view'}</p>
            <label className="text-sm">
              Name
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} aria-label="View name" />
            </label>
            <label className="text-sm">
              Lead stage filter (optional)
              <Input className="mt-1" value={leadStage} onChange={(e) => setLeadStage(e.target.value)} placeholder="e.g. qualified" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              Pin in view list
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void save()}>{editingId ? 'Save changes' : 'Create view'}</Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancel edit</Button>
              )}
            </div>
          </div>
          <ul className="divide-y text-sm">
            {views.length === 0 && <li className="py-4 text-muted-foreground">No saved views yet.</li>}
            {views.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <button
                  type="button"
                  className="font-medium text-left hover:text-primary"
                  onClick={() => {
                    onSelectView(v.id)
                    onOpenChange(false)
                  }}
                >
                  {v.pinned ? '★ ' : ''}{v.name}
                </button>
                <div className="flex flex-wrap gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(v.id)}>Edit</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void duplicate(v)}>Duplicate</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void remove(v.id)}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  )
}
