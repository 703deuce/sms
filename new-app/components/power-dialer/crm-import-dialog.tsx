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
import { SimpleSelect } from '@/components/app/filters'

type SourceRow = { provider: string; sources: { id: string; label: string }[] }

export function CrmImportDialog({
  listId,
  open,
  onOpenChange,
  onDone,
}: {
  listId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
}) {
  const [connected, setConnected] = useState<string[]>([])
  const [sources, setSources] = useState<SourceRow[]>([])
  const [provider, setProvider] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    void fetch('/api/phone/power-dialer/lists/crm-sources')
      .then((r) => r.json())
      .then((j) => {
        setConnected(j.data?.connected || [])
        setSources(j.data?.sources || [])
        const first = j.data?.connected?.[0] || ''
        setProvider(first)
        const src = j.data?.sources?.find((s: SourceRow) => s.provider === first)
        setSourceId(src?.sources?.[0]?.id || '')
      })
  }, [open])

  const providerSources = sources.find((s) => s.provider === provider)?.sources || []

  const run = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/phone/power-dialer/lists/${listId}/import-crm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, sourceId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Import failed')
      toast.success(
        `CRM import: ${j.data.created} created, ${j.data.updated} updated, ${j.data.skipped} skipped, ${j.data.rejected} rejected`,
      )
      onOpenChange(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  if (!connected.length) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from CRM</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Provider</span>
            <SimpleSelect
              label="CRM provider"
              value={provider}
              onChange={(v) => {
                setProvider(v)
                const src = sources.find((s) => s.provider === v)
                setSourceId(src?.sources?.[0]?.id || '')
              }}
              options={connected.map((p) => ({ value: p, label: p }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">List source</span>
            <SimpleSelect
              label="List source"
              value={sourceId}
              onChange={setSourceId}
              options={providerSources.map((s) => ({ value: s.id, label: s.label }))}
            />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={() => void run()} disabled={busy || !provider}>
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
