'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Panel } from '@/newui-transplant/components/app/kit'
import { td, th } from '@/newui-transplant/components/app/opus-tables'
import { OPUS_TABLE_HEAD } from '@/newui-transplant/components/app/opus-surfaces'
import { cn } from '@/lib/utils'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { Label } from '@/newui-transplant/components/ui/label'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/newui-transplant/components/ui/dialog'
import { addMctbExclusion, deleteMctbExclusion, fetchMctbExclusions } from '@/lib/newui-transplant/api/mctb-setup-client'
import { fmtCallPhone } from '@/lib/voice/calls/display'

type Row = { id: string; number: string; label: string; source: string; added: string }

function mapExclusionRow(raw: Record<string, unknown>): Row {
  const phone = String(raw.phoneE164 || raw.phone || raw.number || '')
  const created = raw.createdAt ? new Date(String(raw.createdAt)) : null
  return {
    id: String(raw.id || phone),
    number: phone ? fmtCallPhone(phone) : '—',
    label: String(raw.label || raw.name || '—'),
    source: String(raw.source || raw.reason || 'Manual'),
    added: created
      ? created.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : '—',
  }
}

export function ExclusionsTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState('')
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchMctbExclusions()
      setRows(list.map((r) => mapExclusionRow(r as Record<string, unknown>)))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <Panel
      title="Do-not-text list"
      description={`${rows.length} numbers`}
      bodyClassName="p-0"
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" variant="outline" />}>
            <Plus /> Add number
          </DialogTrigger>
          <DialogContent>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!number.trim()) return
                setActionError(null)
                try {
                  await addMctbExclusion({ phoneE164: number.trim(), label: label.trim() || undefined })
                  setNumber('')
                  setLabel('')
                  setOpen(false)
                  await reload()
                } catch (err) {
                  setActionError(err instanceof Error ? err.message : 'Could not add exclusion')
                }
              }}
              className="flex flex-col gap-4"
            >
              <DialogHeader>
                <DialogTitle>Add excluded number</DialogTitle>
                <DialogDescription>This number will never receive recovery texts.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-1.5">
                <Label htmlFor="ex-number">Phone number</Label>
                <Input id="ex-number" type="tel" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="(512) 555-0123" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ex-label">Label (optional)</Label>
                <Input id="ex-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Vendor" />
              </div>
              {actionError ? (
                <p className="text-sm text-destructive" role="alert">{actionError}</p>
              ) : null}
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <Button type="submit">Add number</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {actionError && !open ? (
        <p className="px-5 pt-4 text-sm text-destructive" role="alert">{actionError}</p>
      ) : null}
      {loading ? (
        <p className="p-5 text-sm text-muted-foreground">Loading exclusions…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead className={OPUS_TABLE_HEAD}>
              <tr>
                <th scope="col" className={th}>Number</th>
                <th scope="col" className={th}>Label</th>
                <th scope="col" className={th}>Source</th>
                <th scope="col" className={th}>Added</th>
                <th scope="col" className={th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className={cn(td, 'font-mono text-xs')}>{row.number}</td>
                  <td className={td}>{row.label}</td>
                  <td className={cn(td, 'text-muted-foreground')}>{row.source}</td>
                  <td className={cn(td, 'text-muted-foreground')}>{row.added}</td>
                  <td className={cn(td, 'text-right')}>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove ${row.number}`}
                      onClick={async () => {
                        setActionError(null)
                        try {
                          await deleteMctbExclusion(row.id)
                          await reload()
                        } catch (err) {
                          setActionError(err instanceof Error ? err.message : 'Could not remove exclusion')
                        }
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
