'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/app/page-primitives'
import { formatPhone, formatWhen } from '@/lib/format'
import { buttonVariants } from '@/components/ui/button'

type VmRow = {
  id: string
  fromE164: string | null
  createdAt: string
  durationSeconds: number | null
  recordingUrl: string | null
  transcriptText: string | null
  aiSummary: string | null
  isRead: boolean
  humanCallId: string | null
}

export function MctbVoicemailInbox() {
  const [rows, setRows] = useState<VmRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    void fetch('/api/phone/voicemail?limit=50')
      .then((r) => r.json())
      .then((j) => setRows(j.data?.messages ?? []))
      .catch(() => toast.error('Could not load voicemail'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const active = rows.find((r) => r.id === selected) ?? rows[0] ?? null

  const markReviewed = (id: string) => {
    void fetch(`/api/phone/voicemail/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true }),
    })
      .then((r) => {
        if (!r.ok) throw new Error('update failed')
        load()
      })
      .catch(() => toast.error('Could not mark reviewed'))
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading voicemail…</p>

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Panel title="Messages">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No voicemail messages yet.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 px-1 py-3 text-left hover:bg-muted/50"
                  onClick={() => setSelected(r.id)}
                >
                  <span className="font-mono text-sm">{formatPhone(r.fromE164 || 'Unknown')}</span>
                  <span className="text-xs text-muted-foreground">{formatWhen(r.createdAt)}</span>
                  {!r.isRead && <span className="text-xs font-medium text-primary">New</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Selected message">
        {!active ? (
          <p className="text-sm text-muted-foreground">Select a message to listen.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              From <span className="font-mono">{formatPhone(active.fromE164 || 'Unknown')}</span> ·{' '}
              {formatWhen(active.createdAt)}
            </p>
            {active.recordingUrl ? (
              <audio controls className="w-full" src={active.recordingUrl}>
                <track kind="captions" />
              </audio>
            ) : (
              <p className="text-sm text-muted-foreground">Recording not available yet.</p>
            )}
            {active.aiSummary && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">AI summary</h3>
                <p className="text-sm">{active.aiSummary}</p>
              </div>
            )}
            {active.transcriptText && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Transcript</h3>
                <p className="text-sm whitespace-pre-wrap">{active.transcriptText}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {!active.isRead && (
                <Button type="button" variant="secondary" onClick={() => markReviewed(active.id)}>
                  Mark reviewed
                </Button>
              )}
              {active.humanCallId && (
                <Link href={`/app/mctb/calls/${active.humanCallId}`} className={buttonVariants({ variant: 'outline' })}>
                  View missed call
                </Link>
              )}
              <Link href="/app/phone/voicemail" className={buttonVariants({ variant: 'ghost' })}>
                Greeting settings
              </Link>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
