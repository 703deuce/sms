'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState, Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { CheckSquare } from 'lucide-react'
import { formatWhen } from '@/lib/format'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type TaskRow = {
  id: string
  title: string
  dueAt: string | null
  status: string
  notes: string | null
  assigneeUserId: string | null
  contact: { id: string; firstName: string | null; lastName: string | null } | null
  deal: { id: string; title: string } | null
}

async function crmGet<T>(path: string): Promise<T> {
  const r = await fetch(path)
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error || 'Request failed')
  return j.data as T
}

async function crmSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error || 'Request failed')
  return j.data as T
}

export function TasksWorkspace() {
  const [bucket, setBucket] = useState<'due' | 'overdue' | 'upcoming' | 'done'>('due')
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<TaskRow> & { id?: string }>({})

  const load = useCallback(() => {
    setLoadError(null)
    void crmGet<TaskRow[]>(`/api/crm/native/tasks?bucket=${bucket}`)
      .then((data) => {
        setTasks(data)
        setLoadError(null)
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Load failed'
        setLoadError(msg)
        setTasks([])
        toast.error(msg)
      })
  }, [bucket])

  useEffect(() => {
    load()
  }, [load])

  const openNew = () => {
    setEditing({ title: '', status: 'open' })
    setEditorOpen(true)
  }

  const saveTask = () => {
    const title = editing.title?.trim()
    if (!title) {
      toast.error('Title is required')
      return
    }
    const payload = {
      title,
      dueAt: editing.dueAt || undefined,
      notes: editing.notes || undefined,
      assigneeUserId: editing.assigneeUserId || undefined,
      contactId: editing.contact?.id || undefined,
      dealId: editing.deal?.id || undefined,
      status: editing.status,
    }
    if (editing.id) {
      void crmSend(`/api/crm/native/tasks/${editing.id}`, 'PATCH', {
        title: payload.title,
        dueAt: editing.dueAt ? new Date(editing.dueAt).toISOString() : null,
        notes: payload.notes ?? null,
        assigneeUserId: payload.assigneeUserId ?? null,
        contactId: payload.contactId ?? null,
        dealId: payload.dealId ?? null,
        status: payload.status,
      })
        .then(() => {
          toast.success('Task updated')
          setEditorOpen(false)
          load()
        })
        .catch((e) => toast.error(e.message))
    } else {
      void crmSend('/api/crm/native/tasks', 'POST', {
        title: payload.title,
        dueAt: editing.dueAt ? new Date(editing.dueAt).toISOString() : undefined,
        notes: payload.notes,
        assigneeUserId: payload.assigneeUserId,
        contactId: payload.contactId,
        dealId: payload.dealId,
      })
        .then(() => {
          toast.success('Task created')
          setEditorOpen(false)
          load()
        })
        .catch((e) => toast.error(e.message))
    }
  }

  const complete = (id: string) => {
    void crmSend(`/api/crm/native/tasks/${id}`, 'PATCH', { status: 'done' }).then(load).catch((e) => toast.error(e.message))
  }

  const reopen = (id: string) => {
    void crmSend(`/api/crm/native/tasks/${id}`, 'PATCH', { status: 'open' }).then(load).catch((e) => toast.error(e.message))
  }

  const remove = (id: string) => {
    if (!confirm('Delete this task?')) return
    void crmSend(`/api/crm/native/tasks/${id}`, 'DELETE')
      .then(() => {
        toast.success('Task deleted')
        load()
      })
      .catch((e) => toast.error(e.message))
  }

  return (
    <Page>
      <PageHeader
        title="Tasks & follow-ups"
        description="Create tasks, set due dates, link contacts and deals, and mark complete."
        actions={<Button type="button" onClick={openNew}>New task</Button>}
      />
      {loadError && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {loadError}
        </p>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        {(['due', 'overdue', 'upcoming', 'done'] as const).map((b) => (
          <Button key={b} type="button" size="sm" variant={bucket === b ? 'default' : 'outline'} onClick={() => setBucket(b)}>
            {b === 'due' ? 'Due today' : b.charAt(0).toUpperCase() + b.slice(1)}
          </Button>
        ))}
      </div>
      <Panel title="Tasks">
        {!tasks.length ? (
          <EmptyState icon={CheckSquare} title="No tasks" description="Add a task or create one from the dialer." />
        ) : (
          <ul className="space-y-2 text-sm">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2">
                <div>
                  <button type="button" className="font-medium hover:text-primary" onClick={() => { setEditing(t); setEditorOpen(true) }}>
                    {t.title}
                  </button>
                  {t.dueAt && <span className="ml-2 text-muted-foreground">· {formatWhen(t.dueAt)}</span>}
                  {t.assigneeUserId && <span className="ml-2 font-mono text-xs text-muted-foreground">Owner {t.assigneeUserId.slice(0, 8)}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {t.contact && (
                    <Link href={`/app/contacts/${t.contact.id}`} className="text-xs text-primary">Contact</Link>
                  )}
                  {t.deal && (
                    <span className="text-xs text-muted-foreground">Deal: {t.deal.title}</span>
                  )}
                  {t.status !== 'done' ? (
                    <>
                      <Button type="button" size="sm" variant="ghost" onClick={() => complete(t.id)}>Mark complete</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(t); setEditorOpen(true) }}>Edit</Button>
                    </>
                  ) : (
                    <Button type="button" size="sm" variant="ghost" onClick={() => reopen(t.id)}>Reopen</Button>
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={() => remove(t.id)}>Delete</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editing.id ? 'Edit task' : 'New task'}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            <label>
              Title
              <Input className="mt-1" value={editing.title || ''} onChange={(e) => setEditing((p) => ({ ...p, title: e.target.value }))} aria-label="Title" />
            </label>
            <label>
              Due date
              <Input
                type="datetime-local"
                className="mt-1"
                value={editing.dueAt ? editing.dueAt.slice(0, 16) : ''}
                onChange={(e) => setEditing((p) => ({ ...p, dueAt: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                aria-label="Due date"
              />
            </label>
            <label>
              Owner user ID
              <Input
                className="mt-1"
                value={editing.assigneeUserId || ''}
                onChange={(e) => setEditing((p) => ({ ...p, assigneeUserId: e.target.value }))}
                aria-label="Owner"
              />
            </label>
            <label>
              Contact ID
              <Input
                className="mt-1"
                value={editing.contact?.id || ''}
                onChange={(e) => setEditing((p) => ({ ...p, contact: e.target.value ? { id: e.target.value, firstName: null, lastName: null } : null }))}
                aria-label="Contact id"
              />
            </label>
            <label>
              Deal ID
              <Input
                className="mt-1"
                value={editing.deal?.id || ''}
                onChange={(e) => setEditing((p) => ({ ...p, deal: e.target.value ? { id: e.target.value, title: '' } : null }))}
                aria-label="Deal id"
              />
            </label>
            <label>
              Notes
              <Input className="mt-1" value={editing.notes || ''} onChange={(e) => setEditing((p) => ({ ...p, notes: e.target.value }))} aria-label="Notes" />
            </label>
            <Button type="button" onClick={saveTask}>{editing.id ? 'Save' : 'Create task'}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </Page>
  )
}
