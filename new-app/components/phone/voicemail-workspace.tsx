'use client'

import { useEffect, useState } from 'react'
import { Voicemail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader, Panel } from '@/components/app/page-primitives'

type Box = {
  id: string
  name: string
  emailNotify: string | null
  messages: Array<{ id: string; fromE164: string | null; createdAt: string }>
}

export function VoicemailWorkspace() {
  const [boxes, setBoxes] = useState<Box[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')

  const reload = () => {
    void fetch('/api/phone/voicemail/boxes')
      .then((r) => r.json())
      .then((j) => setBoxes(j.data || []))
      .catch(() => toast.error('Could not load voicemail'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  const create = () => {
    void fetch('/api/phone/voicemail/boxes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || 'Business voicemail' }),
    })
      .then((r) => {
        if (!r.ok) throw new Error('Create failed')
        setName('')
        reload()
        toast.success('Voicemail box created')
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Voicemail"
        description="Greetings, notification email, and recent messages."
        eyebrow={
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Voicemail className="size-4" aria-hidden />
            Phone
          </span>
        }
      />

      <Panel title="Voicemail boxes">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Notify</TableHead>
                <TableHead>Recent messages</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {boxes.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.emailNotify || '—'}</TableCell>
                  <TableCell>{b.messages?.length ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="vm-name">New box name</Label>
            <Input id="vm-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <Button type="button" size="sm" onClick={create}>Create box</Button>
        </div>
      </Panel>
    </div>
  )
}
