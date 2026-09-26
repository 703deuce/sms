'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Panel } from '@/components/app/kit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type Row = { number: string; label: string; source: string; added: string }

const INITIAL: Row[] = [
  { number: '(512) 555-0100', label: 'Supply House', source: 'Manual', added: 'Aug 2' },
  { number: '(512) 555-0133', label: 'Owner — personal', source: 'Manual', added: 'Jul 18' },
  { number: '(737) 555-0102', label: '—', source: 'Replied STOP', added: 'Sep 11' },
  { number: '(512) 555-0175', label: 'Answering service', source: 'Manual', added: 'Jun 30' },
]

export function ExclusionsTable() {
  const [rows, setRows] = useState(INITIAL)
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState('')
  const [label, setLabel] = useState('')

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
              onSubmit={(e) => {
                e.preventDefault()
                if (!number.trim()) return
                setRows([{ number: number.trim(), label: label.trim() || '—', source: 'Manual', added: 'Today' }, ...rows])
                setNumber('')
                setLabel('')
                setOpen(false)
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
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <Button type="submit">Add number</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="px-5 py-2.5 font-medium">Number</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Label</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Source</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Added</th>
              <th scope="col" className="w-12 px-3 py-2.5"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.number}>
                <td className="px-5 py-3 font-mono">{r.number}</td>
                <td className="px-3 py-3">{r.label}</td>
                <td className="px-3 py-3 text-muted-foreground">{r.source}</td>
                <td className="px-3 py-3 text-muted-foreground">{r.added}</td>
                <td className="px-3 py-3">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${r.number}`}
                    onClick={() => setRows(rows.filter((x) => x.number !== r.number))}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
