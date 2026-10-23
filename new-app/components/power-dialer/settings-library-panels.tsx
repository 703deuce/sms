'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/app/page-primitives'
import { Textarea } from '@/components/ui/textarea'
const jsonHeaders = { 'Content-Type': 'application/json' }

type DispositionRow = {
  id: string
  label: string
  category: string
  sortOrder: number
  requireNotes: boolean
  markConnected: boolean
  markContactCompleted: boolean
  scheduleCallback: boolean
  removeFromQueue: boolean
  addToDnc: boolean
  triggerCrmUpdate: boolean
  triggerFollowUp: boolean
}

type DispositionSet = {
  id: string
  name: string
  isDefault: boolean
  dispositions: DispositionRow[]
}

type ScriptRow = { id: string; name: string; body: string; isDefault: boolean }

type VmDrop = { id: string; name: string; storageUrl: string; mimeType: string | null }

function DispositionSetEditor({
  set,
  onRefresh,
  onClone,
}: {
  set: DispositionSet
  onRefresh: () => void
  onClone: (id: string) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DispositionRow | null>(null)

  const patchDispo = async (dispoId: string, patch: Partial<DispositionRow>) => {
    const res = await fetch(`/api/phone/power-dialer/dispositions/${set.id}/items/${dispoId}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error((j as { error?: string }).error || 'Update failed')
    }
    onRefresh()
    toast.success('Disposition updated')
  }

  const deleteDispo = async (dispoId: string) => {
    const res = await fetch(`/api/phone/power-dialer/dispositions/${set.id}/items/${dispoId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error((j as { error?: string }).error || 'Delete failed')
    }
    onRefresh()
    toast.success('Disposition removed')
  }

  const move = async (index: number, dir: -1 | 1) => {
    const ordered = [...set.dispositions].sort((a, b) => a.sortOrder - b.sortOrder)
    const j = index + dir
    if (j < 0 || j >= ordered.length) return
    const swapped = [...ordered]
    const tmp = swapped[index]
    swapped[index] = swapped[j]
    swapped[j] = tmp
    await fetch(`/api/phone/power-dialer/dispositions/${set.id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ action: 'reorder', orderedDispositionIds: swapped.map((d) => d.id) }),
    })
    onRefresh()
  }

  const addRow = async () => {
    const res = await fetch(`/api/phone/power-dialer/dispositions/${set.id}/items`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ label: 'New outcome' }),
    })
    if (!res.ok) throw new Error('Could not add disposition')
    onRefresh()
  }

  const setDefault = async () => {
    await fetch(`/api/phone/power-dialer/dispositions/${set.id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ action: 'set_default' }),
    })
    onRefresh()
    toast.success('Default set updated')
  }

  const deleteSet = async () => {
    const res = await fetch(`/api/phone/power-dialer/dispositions/${set.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error((j as { error?: string }).error || 'Delete failed')
    }
    onRefresh()
    toast.success('Set deleted')
  }

  const sorted = [...set.dispositions].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <li className="rounded-lg border p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{set.name}{set.isDefault ? ' (default)' : ''}</span>
        <div className="flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="outline" onClick={() => onClone(set.id)}>Clone</Button>
          {!set.isDefault && (
            <Button type="button" size="sm" variant="outline" onClick={() => void setDefault().catch((e) => toast.error(e.message))}>
              Set default
            </Button>
          )}
          {!set.isDefault && (
            <Button type="button" size="sm" variant="ghost" onClick={() => void deleteSet().catch((e) => toast.error(e.message))}>
              Delete set
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => void addRow().catch(() => toast.error('Add failed'))}>
            Add outcome
          </Button>
        </div>
      </div>
      <ol className="space-y-2">
        {sorted.map((d, index) => {
          const open = expandedId === d.id
          const row = open && draft?.id === d.id ? draft : d
          return (
            <li key={d.id} className="rounded-md border bg-muted/30 p-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-left font-medium hover:underline"
                  onClick={() => {
                    setExpandedId(open ? null : d.id)
                    setDraft(d)
                  }}
                >
                  {d.label}
                </button>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2" disabled={index === 0} onClick={() => void move(index, -1)}>
                    ↑
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2" disabled={index === sorted.length - 1} onClick={() => void move(index, 1)}>
                    ↓
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => void deleteDispo(d.id).catch((e) => toast.error(e.message))}>
                    Remove
                  </Button>
                </div>
              </div>
              {open && draft && (
                <div className="mt-3 grid gap-2 border-t pt-3">
                  <Input value={row.label} onChange={(e) => setDraft({ ...row, label: e.target.value })} aria-label="Outcome label" />
                  <Input value={row.category} onChange={(e) => setDraft({ ...row, category: e.target.value })} aria-label="Category" />
                  {(
                    [
                      ['requireNotes', 'Require notes'],
                      ['markConnected', 'Mark connected'],
                      ['markContactCompleted', 'Mark contact completed'],
                      ['scheduleCallback', 'Schedule callback'],
                      ['removeFromQueue', 'Remove from queue'],
                      ['addToDnc', 'Add to DNC'],
                      ['triggerCrmUpdate', 'Trigger CRM update'],
                      ['triggerFollowUp', 'Trigger follow-up'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={row[key]}
                        onChange={(e) => setDraft({ ...row, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    className="self-start"
                    onClick={() => void patchDispo(d.id, draft).catch((e) => toast.error(e.message))}
                  >
                    Save outcome
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </li>
  )
}

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
    <Panel title="Disposition sets" description="Assign a set per campaign under Outcomes. Edit labels, flags, order, and default set.">
      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="New set name" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="New disposition set name" />
        <Button size="sm" onClick={() => void createSet()}>Create set</Button>
      </div>
      <ul className="space-y-4 text-sm">
        {sets.map((s) => (
          <DispositionSetEditor key={s.id} set={s} onRefresh={load} onClone={(id) => void cloneSet(id)} />
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
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const load = useCallback(() => {
    void fetch('/api/phone/power-dialer/voicemail-drops')
      .then((r) => r.json())
      .then((j) => setDrops(j.data || []))
      .catch(() => toast.error('Could not load voicemail drops'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const uploadBlob = async (blob: Blob, filename: string) => {
    if (!optIn) {
      toast.error('Enable admin opt-in under VM compliance first')
      return
    }
    const form = new FormData()
    form.set('name', name || 'Voicemail drop')
    form.set('file', new File([blob], filename, { type: blob.type || 'audio/webm' }))
    const res = await fetch('/api/phone/power-dialer/voicemail-drops/upload', { method: 'POST', body: form })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error((j as { error?: string }).error || 'Upload failed')
    }
    setName('')
    setPreviewUrl(null)
    load()
    toast.success('Voicemail drop saved')
  }

  const onFile = (file: File | null) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    void uploadBlob(file, file.name).catch((e) => toast.error(e.message))
  }

  const startRecord = async () => {
    if (!optIn) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        void uploadBlob(blob, 'voicemail-drop.webm').catch((e) => toast.error(e.message))
      }
      rec.start()
      setMediaRecorder(rec)
      setRecording(true)
    } catch {
      toast.error('Microphone access denied or unavailable')
    }
  }

  const stopRecord = () => {
    mediaRecorder?.stop()
    setMediaRecorder(null)
    setRecording(false)
  }

  return (
    <Panel title="Voicemail drops" description="Record in-browser or upload audio. Files are stored in workspace storage; dialer playback uses Telnyx call control (not mock) in production.">
      {!optIn && (
        <p className="mb-3 text-sm text-warning-foreground">Uploads disabled until compliance opt-in is enabled on the VM compliance tab.</p>
      )}
      <div className="mb-4 grid max-w-xl gap-2">
        <Input placeholder="Drop name" value={name} onChange={(e) => setName(e.target.value)} disabled={!optIn} aria-label="Voicemail drop name" />
        <div className="flex flex-wrap gap-2">
          {!recording ? (
            <Button type="button" size="sm" disabled={!optIn} onClick={() => void startRecord()}>Record</Button>
          ) : (
            <Button type="button" size="sm" variant="destructive" onClick={stopRecord}>Stop recording</Button>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              disabled={!optIn}
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            <span className="rounded-md border px-3 py-1.5 text-xs">Upload file</span>
          </label>
        </div>
        {previewUrl && (
          <audio controls src={previewUrl} className="w-full max-w-md" aria-label="Voicemail drop preview">
            <track kind="captions" />
          </audio>
        )}
      </div>
      <ul className="text-sm">
        {drops.map((d) => (
          <li key={d.id} className="border-b py-2">
            <span className="font-medium">{d.name}</span>
            <audio controls src={d.storageUrl} className="mt-1 w-full max-w-md" preload="none">
              <track kind="captions" />
            </audio>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
