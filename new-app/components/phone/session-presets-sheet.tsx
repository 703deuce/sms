'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type Preset = { id: string; name: string; config: Record<string, unknown> }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  presets: Preset[]
  onPresetsChange: (rows: Preset[]) => void
  onLoad: (preset: Preset) => void
}

export function SessionPresetsSheet({ open, onOpenChange, presets, onPresetsChange, onLoad }: Props) {
  const [rows, setRows] = useState<Preset[]>(presets)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    if (!open) return
    setRows(presets)
  }, [open, presets])

  const reload = () => {
    void fetch('/api/phone/power-dialer/session-presets')
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data || []).map((p: { id: string; name: string; configJson: Record<string, unknown> }) => ({
          id: p.id,
          name: p.name,
          config: p.configJson || {},
        }))
        setRows(list)
        onPresetsChange(list)
      })
      .catch(() => toast.error('Could not load presets'))
  }

  useEffect(() => {
    if (open) reload()
  }, [open])

  const rename = async (id: string) => {
    const row = rows.find((r) => r.id === id)
    if (!row || !name.trim()) return
    try {
      const r = await fetch('/api/phone/power-dialer/session-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: name.trim(), config: row.config }),
      })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      toast.success('Preset renamed')
      setEditingId(null)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rename failed')
    }
  }

  const duplicate = async (row: Preset) => {
    try {
      const r = await fetch('/api/phone/power-dialer/session-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${row.name} (copy)`, config: row.config }),
      })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      toast.success('Preset duplicated')
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Duplicate failed')
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this preset?')) return
    try {
      const r = await fetch(`/api/phone/power-dialer/session-presets?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok || j.error) throw new Error(j.error || 'Delete failed')
      toast.success('Preset deleted')
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Manage session presets</SheetTitle>
        </SheetHeader>
        <p className="mt-2 text-xs text-muted-foreground">Load, rename, duplicate, or delete saved dialer setup (campaign, mode, phone fields).</p>
        <ul className="mt-4 divide-y text-sm">
          {rows.length === 0 && <li className="py-4 text-muted-foreground">No presets saved yet.</li>}
          {rows.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 py-3">
              {editingId === p.id ? (
                <div className="flex gap-2">
                  <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Preset name" />
                  <Button type="button" size="sm" onClick={() => void rename(p.id)}>Save</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{p.name}</span>
                  <div className="flex flex-wrap gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => { onLoad(p); onOpenChange(false) }}>Load</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingId(p.id); setName(p.name) }}>Rename</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => void duplicate(p)}>Duplicate</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => void remove(p.id)}>Delete</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
