'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/app/page-primitives'
import { Textarea } from '@/components/ui/textarea'
const jsonHeaders = { 'Content-Type': 'application/json' }

type DispositionSet = {
  id: string
  name: string
  isDefault: boolean
  dispositions: { id: string; label: string; category: string; sortOrder: number }[]
}

type ScriptRow = { id: string; name: string; body: string; isDefault: boolean }

type VmDrop = { id: string; name: string; storageUrl: string; mimeType: string | null }

export function DispositionsLibraryPanel() {
  const [sets, setSets] = useState<DispositionSet[]>([])
  const [newName, setNewName] = useState('')

  const load = useCallback(() => {
    void fetch('/api/phone/power-dialer/dispositions')
      .then((r) => r.json())
      .then((j) => setSets(j.data || []))
      .catch(() => toast.error('Could not load disposition sets'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const createSet = async () => {
    try {
      await fetch('/api/phone/power-dialer/dispositions', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ name: newName || 'Custom outcomes' }),
      })
      setNewName('')
      load()
      toast.success('Disposition set created')
    } catch {
      toast.error('Create failed')
    }
  }

  const cloneSet = async (id: string) => {
    try {
      await fetch('/api/phone/power-dialer/dispositions', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ cloneFromSetId: id }),
      })
      load()
      toast.success('Set cloned')
    } catch {
      toast.error('Clone failed')
    }
  }

  return (
    <Panel title="Disposition sets" description="Assign a set per campaign under Outcomes. Default set matches legacy eight outcomes.">
      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="New set name" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="New disposition set name" />
        <Button size="sm" onClick={() => void createSet()}>Create set</Button>
      </div>
      <ul className="space-y-4 text-sm">
        {sets.map((s) => (
          <li key={s.id} className="rounded-lg border p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{s.name}{s.isDefault ? ' (default)' : ''}</span>
              {!s.isDefault && (
                <Button size="sm" variant="outline" onClick={() => void cloneSet(s.id)}>Clone</Button>
              )}
            </div>
            <ol className="list-decimal pl-5 text-muted-foreground">
              {s.dispositions.map((d) => (
                <li key={d.id}>{d.label}</li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function ScriptsLibraryPanel() {
  const [scripts, setScripts] = useState<ScriptRow[]>([])
  const [name, setName] = useState('')
  const [body, setBody] = useState('Hi {{first_name}}, this is {{rep_name}} from {{company}}.')

  const load = useCallback(() => {
    void fetch('/api/phone/power-dialer/scripts')
      .then((r) => r.json())
      .then((j) => setScripts(j.data || []))
      .catch(() => toast.error('Could not load scripts'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    try {
      await fetch('/api/phone/power-dialer/scripts', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ name: name || 'Script', body }),
      })
      setName('')
      load()
      toast.success('Script saved')
    } catch {
      toast.error('Save failed')
    }
  }

  const preview = body.replace(/\{\{\s*first_name\s*\}\}/g, 'Ada').replace(/\{\{\s*rep_name\s*\}\}/g, 'Alex').replace(/\{\{\s*company\s*\}\}/g, 'Acme Co')

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Script library" description="Use merge fields: {{first_name}}, {{company}}, {{rep_name}}, and custom field keys.">
        <div className="grid max-w-2xl gap-3">
          <Input placeholder="Script name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Script name" />
          <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Script body" />
          <Button className="self-start" onClick={() => void save()}>Add script</Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Preview: {preview}</p>
      </Panel>
      <Panel title="Saved scripts">
        <ul className="space-y-2 text-sm">
          {scripts.map((s) => (
            <li key={s.id} className="border-b py-2">
              <span className="font-medium">{s.name}</span>
              {s.isDefault && <span className="ml-2 text-xs text-muted-foreground">default</span>}
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

export function VoicemailDropsLibraryPanel({ optIn }: { optIn: boolean }) {
  const [drops, setDrops] = useState<VmDrop[]>([])
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  const load = useCallback(() => {
    void fetch('/api/phone/power-dialer/voicemail-drops')
      .then((r) => r.json())
      .then((j) => setDrops(j.data || []))
      .catch(() => toast.error('Could not load voicemail drops'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const add = async () => {
    if (!optIn) {
      toast.error('Enable admin opt-in under Voicemail drops compliance first')
      return
    }
    try {
      const res = await fetch('/api/phone/power-dialer/voicemail-drops', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ name, storageUrl: url, mimeType: 'audio/mpeg', sizeBytes: 0 }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Failed')
      }
      setName('')
      setUrl('')
      load()
      toast.success('Voicemail drop added')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed')
    }
  }

  return (
    <Panel title="Voicemail drops" description="HTTPS audio URL required (same storage pattern as other products). Browser record → export file → upload to storage → paste URL.">
      {!optIn && (
        <p className="mb-3 text-sm text-warning-foreground">Uploads disabled until compliance opt-in is enabled on the Voicemail drops settings tab.</p>
      )}
      <div className="mb-4 grid max-w-xl gap-2">
        <Input placeholder="Drop name" value={name} onChange={(e) => setName(e.target.value)} disabled={!optIn} aria-label="Voicemail drop name" />
        <Input placeholder="https://…/greeting.mp3" value={url} onChange={(e) => setUrl(e.target.value)} disabled={!optIn} aria-label="Audio URL" />
        <Button size="sm" className="self-start" disabled={!optIn} onClick={() => void add()}>Add drop</Button>
      </div>
      <ul className="text-sm">
        {drops.map((d) => (
          <li key={d.id} className="border-b py-2">
            <span className="font-medium">{d.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{d.storageUrl}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
