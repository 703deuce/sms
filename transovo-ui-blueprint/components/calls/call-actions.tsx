'use client'

import { useState } from 'react'
import { Check, PhoneOutgoing, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from '@/components/app/page-primitives'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { NUMBERS, type Call } from '@/lib/data'

export function CallActions({ call }: { call: Call }) {
  const { startCall } = useWorkspace()
  const [handled, setHandled] = useState(call.handled)

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setHandled((h) => !h)
          toast.success(handled ? 'Marked as needing follow-up' : 'Marked as handled')
        }}
      >
        {handled ? <RotateCcw /> : <Check />}
        {handled ? 'Reopen' : 'Mark handled'}
      </Button>
      <Button
        onClick={() => {
          const ok = startCall({ name: call.caller, number: call.callerNumber, callerId: NUMBERS[0].number })
          if (ok) toast('Calling back', { description: `Using Main line as caller ID` })
        }}
      >
        <PhoneOutgoing />
        Call back
      </Button>
    </>
  )
}

export function CallNotes() {
  const [notes, setNotes] = useState<string[]>([])
  const [draft, setDraft] = useState('')

  return (
    <Panel title="Internal notes" description="Visible to your team only">
      <div className="flex flex-col gap-3">
        {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
        {notes.map((n, i) => (
          <p key={i} className="rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed">
            <span className="mr-2 text-xs font-medium text-muted-foreground">Maya O.</span>
            {n}
          </p>
        ))}
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft.trim()) return
            setNotes((n) => [...n, draft.trim()])
            setDraft('')
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
