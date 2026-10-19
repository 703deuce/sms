'use client'

import { useState } from 'react'
import { Check, PhoneOutgoing, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from '@/components/app/page-primitives'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { type Call } from '@/lib/data'
import { patchCall } from '@/lib/phone-api'
import { useNumbers } from '@/components/providers/numbers-provider'

export function CallActions({ call }: { call: Call }) {
  const { startCall } = useWorkspace()
  const { owned } = useNumbers()
  const [handled, setHandled] = useState(call.handled)
  const callerId = owned[0]?.number || call.callerNumber

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          void patchCall(call.id, { handled: !handled })
            .then(() => {
              setHandled((h) => !h)
              toast.success(handled ? 'Marked as needing follow-up' : 'Marked as handled')
            })
            .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not update'))
        }}
      >
        {handled ? <RotateCcw /> : <Check />}
        {handled ? 'Reopen' : 'Mark handled'}
      </Button>
      <Button
        onClick={() => {
          const ok = startCall({ name: call.caller, number: call.callerNumber, callerId, source: 'callback' })
          if (ok) toast('Calling back', { description: `Using Main line as caller ID` })
        }}
      >
        <PhoneOutgoing />
        Call back
      </Button>
    </>
  )
}

type NoteRow = { id: string; content: string; createdAt: string; author: string | null }

export function CallNotes({ callId, initial = [] }: { callId: string; initial?: NoteRow[] }) {
  const [notes, setNotes] = useState<NoteRow[]>(initial)
  const [draft, setDraft] = useState('')

  return (
    <Panel title="Internal notes" description="Visible to your team only">
      <div className="flex flex-col gap-3">
        {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
        {notes.map((n) => (
          <p key={n.id} className="rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed">
            <span className="mr-2 text-xs font-medium text-muted-foreground">{n.author ?? 'Team'}</span>
            {n.content}
          </p>
        ))}
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft.trim()) return
            const text = draft.trim()
            void patchCall(callId, { note: text })
              .then((updated) => {
                const saved = updated.notes?.at(-1)
                setNotes((n) => [
                  ...n,
                  saved ?? {
                    id: `local-${Date.now()}`,
                    content: text,
                    createdAt: new Date().toISOString(),
                    author: 'Team',
                  },
                ])
                setDraft('')
              })
              .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not save note'))
          }}
        >
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a note for the team…" aria-label="New note" rows={2} />
          <Button type="submit" variant="outline" size="sm" className="self-end" disabled={!draft.trim()}>
            Add note
          </Button>
        </form>
      </div>
    </Panel>
  )
}
