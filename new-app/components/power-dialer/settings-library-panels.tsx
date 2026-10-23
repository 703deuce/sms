'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/app/page-primitives'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
const jsonHeaders = { 'Content-Type': 'application/json' }

const SAMPLE_MERGE = {
  first_name: 'Ada',
  rep_name: 'Alex',
  company: 'Acme Co',
}

function renderScriptPreview(body: string) {
  return body
    .replace(/\{\{\s*first_name\s*\}\}/gi, SAMPLE_MERGE.first_name)
    .replace(/\{\{\s*rep_name\s*\}\}/gi, SAMPLE_MERGE.rep_name)
    .replace(/\{\{\s*company\s*\}\}/gi, SAMPLE_MERGE.company)
}

type DispositionRow = {
  id: string
  label: string
  category: string
  outcomeClass?: string | null
  colorHex?: string | null
  hotkey?: string | null
  answerContext?: string
  actionsJson?: unknown
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

type ScriptRow = {
  id: string
  name: string
  body: string
  isDefault: boolean
  assignmentJson?: { teamUserIds?: string[]; campaignIds?: string[] } | null
}

type VmDrop = { id: string; name: string; storageUrl: string; mimeType: string | null }

function DispositionSetEditor({
  set,
  onRefresh,
  onClone,
}: {
  set: DispositionSet
  onRefresh: () => Promise<void>
  onClone: (id: string) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DispositionRow | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const labelInputRef = useRef<HTMLInputElement | null>(null)
  const [focusLabelAfterExpand, setFocusLabelAfterExpand] = useState(false)

  useEffect(() => {
    if (!focusLabelAfterExpand || !expandedId) return
    const id = window.requestAnimationFrame(() => {
      labelInputRef.current?.focus()
      labelInputRef.current?.select()
      setFocusLabelAfterExpand(false)
    })
    return () => window.cancelAnimationFrame(id)
  }, [focusLabelAfterExpand, expandedId, set.dispositions.length])

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
    const j = (await res.json()) as { data?: DispositionRow }
    const newId = j.data?.id
    await onRefresh()
    if (newId) {
      const fresh = j.data
      setExpandedId(newId)
      setDraft(fresh ? { ...fresh } : null)
      setFocusLabelAfterExpand(true)
      toast.success('Outcome added — edit the label below')
    }
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
    setDeleteBusy(true)
    try {
      const res = await fetch(`/api/phone/power-dialer/dispositions/${set.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error || 'Delete failed')
      }
      onRefresh()
      toast.success('Set deleted')
      setDeleteOpen(false)
    } finally {
      setDeleteBusy(false)
    }
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
            <Button type="button" size="sm" variant="ghost" onClick={() => setDeleteOpen(true)}>
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
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Label</span>
                    <Input
                      ref={expandedId === d.id ? labelInputRef : undefined}
                      value={row.label}
                      onChange={(e) => setDraft({ ...row, label: e.target.value })}
                      aria-label="Outcome label"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Category</span>
                    <Input value={row.category} onChange={(e) => setDraft({ ...row, category: e.target.value })} aria-label="Category" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Outcome class</span>
                    <Input value={row.outcomeClass || ''} onChange={(e) => setDraft({ ...row, outcomeClass: e.target.value })} aria-label="Outcome class" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Color (hex)</span>
                    <Input value={row.colorHex || ''} onChange={(e) => setDraft({ ...row, colorHex: e.target.value })} placeholder="#22c55e" aria-label="Color hex" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Hotkey</span>
                    <Input value={row.hotkey || ''} onChange={(e) => setDraft({ ...row, hotkey: e.target.value })} placeholder="1-9" aria-label="Hotkey" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Answer context</span>
                    <select
                      className="rounded-md border bg-background px-2 py-1"
                      value={row.answerContext || 'any'}
                      onChange={(e) => setDraft({ ...row, answerContext: e.target.value })}
                      aria-label="Answer context"
                    >
                      <option value="any">Any</option>
                      <option value="live">Live answer</option>
                      <option value="no_answer">No answer</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Follow-up actions (JSON array)</span>
                    <Textarea
                      className="min-h-[100px] font-mono text-[11px]"
                      value={JSON.stringify(row.actionsJson || [], null, 2)}
                      onChange={(e) => {
                        try {
                          setDraft({ ...row, actionsJson: JSON.parse(e.target.value) as unknown })
                        } catch {
                          /* user still typing */
                        }
                      }}
                      aria-label="Disposition actions JSON"
                    />
                    <span className="text-muted-foreground">
                      Types: tag, send_sms, send_email, voicemail_drop, crm_note, create_task, create_deal,
                      cadence_enroll, customer_webhook (signed workspace webhooks), …
                    </span>
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">Sort order</span>
                    <Input
                      type="number"
                      value={row.sortOrder}
                      onChange={(e) => setDraft({ ...row, sortOrder: Number(e.target.value) })}
                      aria-label="Sort order"
                    />
                  </label>
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
                    onClick={() =>
                      void patchDispo(d.id, {
                        ...draft,
                        actionsJson: draft.actionsJson,
                      }).catch((e) => toast.error(e.message))
                    }
                  >
                    Save outcome
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete disposition set?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Outcomes in &quot;{set.name}&quot; are removed. If this set is assigned to a campaign, deletion is blocked — reassign the campaign first.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteBusy}
              onClick={() => void deleteSet().catch((e) => toast.error(e.message))}
            >
              Delete set
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}

export function DispositionsLibraryPanel() {
  const [sets, setSets] = useState<DispositionSet[]>([])
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/phone/power-dialer/dispositions')
    const j = await r.json()
    if (!r.ok) throw new Error('Could not load disposition sets')
    setSets(j.data || [])
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; action: 'archive' | 'delete' } | null>(null)

  const load = useCallback(() => {
    void fetch('/api/phone/power-dialer/scripts')
      .then((r) => r.json())
      .then((j) => setScripts(j.data || []))
      .catch(() => toast.error('Could not load scripts'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveNew = async () => {
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

  const saveEdit = async (
    id: string,
    patch: { name: string; body: string; assignmentJson?: ScriptRow['assignmentJson'] },
  ) => {
    const res = await fetch(`/api/phone/power-dialer/scripts/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error('Save failed')
    setEditingId(null)
    load()
    toast.success('Script updated')
  }

  const runAction = async () => {
    if (!confirm) return
    const { id, action } = confirm
    if (action === 'delete') {
      const res = await fetch(`/api/phone/power-dialer/scripts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      toast.success('Script deleted')
    } else {
      const res = await fetch(`/api/phone/power-dialer/scripts/${id}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ action: 'archive' }),
      })
      if (!res.ok) throw new Error('Archive failed')
      toast.success('Script archived')
    }
    setConfirm(null)
    load()
  }

  const cloneScript = async (id: string) => {
    const res = await fetch(`/api/phone/power-dialer/scripts/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ action: 'clone' }),
    })
    if (!res.ok) throw new Error('Clone failed')
    load()
    toast.success('Script cloned')
  }

  const setDefault = async (id: string) => {
    const res = await fetch(`/api/phone/power-dialer/scripts/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ isDefault: true }),
    })
    if (!res.ok) throw new Error('Could not set default')
    load()
    toast.success('Default script updated')
  }

  const previewScript = scripts.find((s) => s.id === previewId)

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Script library" description="Use merge fields: {{first_name}}, {{company}}, {{rep_name}}, and custom field keys. Assign a script on each campaign under Call handling.">
        <div className="grid max-w-2xl gap-3">
          <Input placeholder="Script name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Script name" />
          <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Script body" />
          <Button className="self-start" onClick={() => void saveNew()}>Add script</Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Example preview</span> (sample merge data): {renderScriptPreview(body)}
        </p>
      </Panel>
      <Panel title="Saved scripts">
        <ul className="space-y-3 text-sm">
          {scripts.map((s) => (
            <li key={s.id} className="rounded-lg border p-3">
              {editingId === s.id ? (
                <ScriptEditForm
                  script={s}
                  onCancel={() => setEditingId(null)}
                  onSave={(patch) => void saveEdit(s.id, patch).catch((e) => toast.error(e.message))}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{s.name}</span>
                    {s.isDefault && <span className="text-xs text-muted-foreground">Default</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.body}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(s.id)}>Edit</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setPreviewId(s.id)}>Preview</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void cloneScript(s.id).catch((e) => toast.error(e.message))}>Clone</Button>
                    {!s.isDefault && (
                      <Button type="button" size="sm" variant="outline" onClick={() => void setDefault(s.id).catch((e) => toast.error(e.message))}>
                        Set default
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm({ id: s.id, action: 'archive' })}>Archive</Button>
                    <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirm({ id: s.id, action: 'delete' })}>Delete</Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Assign a script on each <Link href="/app/power-dialer/campaigns" className="text-primary hover:underline">campaign</Link> under Call handling.
        </p>
      </Panel>
      <Dialog open={!!previewScript} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{previewScript?.name} — preview</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-sm">{previewScript ? renderScriptPreview(previewScript.body) : ''}</p>
          <p className="text-xs text-muted-foreground">Example preview using sample merge data (Ada, Alex, Acme Co.). Live calls use the contact and rep on the session.</p>
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.action === 'delete' ? 'Delete script?' : 'Archive script?'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirm?.action === 'delete'
              ? 'This permanently removes the script. Campaigns referencing it should be updated first.'
              : 'Archived scripts are hidden from the library but historical sessions keep their text.'}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={() => void runAction().catch((e) => toast.error(e.message))}>
              {confirm?.action === 'delete' ? 'Delete' : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ScriptEditForm({
  script,
  onCancel,
  onSave,
}: {
  script: ScriptRow
  onCancel: () => void
  onSave: (patch: { name: string; body: string; assignmentJson?: ScriptRow['assignmentJson'] }) => void
}) {
  const [name, setName] = useState(script.name)
  const [body, setBody] = useState(script.body)
  const [teamUserIds, setTeamUserIds] = useState<string[]>(script.assignmentJson?.teamUserIds || [])
  const [members, setMembers] = useState<{ userId: string; name: string }[]>([])
  useEffect(() => {
    void fetch('/api/phone/power-dialer/workspace-members')
      .then((r) => r.json())
      .then((j) => setMembers(j.data || []))
      .catch(() => undefined)
  }, [])
  return (
    <div className="flex flex-col gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Script name" />
      <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Script body" />
      <fieldset className="text-xs">
        <legend className="mb-1 font-medium">Team assignment (M39)</legend>
        <p className="mb-2 text-muted-foreground">Reps not listed can still use campaign-assigned scripts.</p>
        <ul className="max-h-32 overflow-auto rounded border p-2">
          {members.map((m) => (
            <li key={m.userId}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={teamUserIds.includes(m.userId)}
                  onChange={(e) =>
                    setTeamUserIds((prev) =>
                      e.target.checked ? [...prev, m.userId] : prev.filter((id) => id !== m.userId),
                    )
                  }
                />
                {m.name}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onSave({ name, body, assignmentJson: { teamUserIds } })}
        >
          Save
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
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
      toast.error('Enable voicemail drop opt-in under Settings → Voicemail drops first')
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
    <Panel title="Voicemail drops" description="Record in-browser or upload audio. Files are saved to your workspace and played on live calls when you use voicemail drop.">
      {!optIn && (
        <p className="mb-3 text-sm text-warning-foreground">Uploads disabled until compliance opt-in is enabled on the Voicemail Drops tab.</p>
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
