'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Pause, Phone, Play, Plus, SkipForward, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from '@/components/app/page-primitives'
import { StatusBadge, type Tone } from '@/components/app/status'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { CAMPAIGNS, DIALER_QUEUE, LISTS, getContact, type Campaign } from '@/lib/data'
import { formatPhone, formatWhen } from '@/lib/format'
import { cn } from '@/lib/utils'

const CAMPAIGN_STATUS: Record<Campaign['status'], { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  draft: { label: 'Draft', tone: 'muted' },
  completed: { label: 'Completed', tone: 'neutral' },
}

const DISPOSITIONS = ['Booked', 'Interested', 'Callback', 'No answer', 'Voicemail', 'Not interested', 'Wrong number', 'Do not call'] as const

export function PowerDialer({ initialTab = 'session' }: { initialTab?: string }) {
  return (
    <Tabs defaultValue={initialTab} className="gap-6">
      <TabsList>
        <TabsTrigger value="session">Session</TabsTrigger>
        <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        <TabsTrigger value="lists">Lists</TabsTrigger>
      </TabsList>
      <TabsContent value="session"><Session /></TabsContent>
      <TabsContent value="campaigns"><Campaigns /></TabsContent>
      <TabsContent value="lists"><Lists /></TabsContent>
    </Tabs>
  )
}

function Session() {
  const { startCall, endCall, activeCall } = useWorkspace()
  const campaign = CAMPAIGNS[0]
  const [index, setIndex] = useState(0)
  const [running, setRunning] = useState(false)
  const [disposition, setDisposition] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState<{ name: string; result: string }[]>([])

  const entry = DIALER_QUEUE[index]
  const contact = entry ? getContact(entry.contactId) : undefined
  const onCall = !!activeCall && activeCall.status !== 'ended' && activeCall.status !== 'failed'

  const dial = () => {
    if (!contact) return
    setRunning(true)
    startCall({ name: contact.name, number: contact.phone, callerId: campaign.callerId, source: 'power_dialer' })
  }

  const next = () => {
    if (!contact || !disposition) return
    if (onCall) endCall()
    setDone((d) => [{ name: contact.name, result: disposition }, ...d])
    setDisposition(null)
    setNotes('')
    if (index + 1 >= DIALER_QUEUE.length) {
      setRunning(false)
      toast.success('Queue complete')
    }
    setIndex((i) => i + 1)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Panel
          title={campaign.name}
          description={`Calling from ${formatPhone(campaign.callerId)} · max ${campaign.maxAttempts} attempts · ${index}/${DIALER_QUEUE.length} in this session`}
          actions={
            running ? (
              <Button variant="outline" size="sm" onClick={() => setRunning(false)}>
                <Pause />
                Pause
              </Button>
            ) : (
              <Button size="sm" onClick={dial} disabled={!contact}>
                <Play />
                {index === 0 ? 'Start session' : 'Resume'}
              </Button>
            )
          }
        >
          {contact && entry ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xl font-semibold">{contact.name}</span>
                  <span className="font-mono text-sm text-muted-foreground">{formatPhone(contact.phone)} · {entry.tz}</span>
                  <span className="text-xs text-muted-foreground">Attempt {entry.attempts + 1} of {campaign.maxAttempts} · last: {entry.lastResult}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={onCall} onClick={() => setIndex((i) => i + 1)}>
                    <SkipForward />
                    Skip
                  </Button>
                  <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" disabled={onCall} onClick={dial}>
                    <Phone />
                    Dial
                  </Button>
                </div>
              </div>
              <p className="rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed">{entry.notes}</p>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">Disposition</legend>
                <div className="flex flex-wrap gap-2">
                  {DISPOSITIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={disposition === d}
                      onClick={() => setDisposition(d)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-sm transition-colors',
                        disposition === d ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-col gap-2">
                <label htmlFor="pd-notes" className="text-sm font-medium">Notes</label>
                <Textarea id="pd-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </div>
              <Button className="self-end" disabled={!disposition} onClick={next}>
                Save & next
              </Button>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No more contacts in this session.</p>
          )}
        </Panel>
      </div>

      <Panel title="Session log" bodyClassName="p-0">
        <ul className="divide-y">
          {done.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Dispositions appear here.</li>}
          {done.map((d, i) => (
            <li key={i} className="flex items-center justify-between px-5 py-3 text-sm">
              {d.name}
              <StatusBadge tone={d.result === 'Booked' ? 'success' : d.result === 'Do not call' ? 'danger' : 'neutral'}>{d.result}</StatusBadge>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

function Campaigns() {
  return (
    <Panel
      title="Campaigns"
      actions={
        <Button size="sm" onClick={() => toast('New campaign', { description: 'Pick a list, caller ID and attempt rules.' })}>
          <Plus />
          New campaign
        </Button>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y">
        {CAMPAIGNS.map((c) => {
          const list = LISTS.find((l) => l.id === c.listId)
          return (
            <li key={c.id} className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-center">
              <span className="flex flex-col">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{list?.name} · {c.owner}</span>
              </span>
              <span className="flex items-center gap-2">
                <Progress value={c.completedPct} className="h-1.5 flex-1" aria-label={`${c.completedPct}% complete`} />
                <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{c.completedPct}%</span>
              </span>
              <span className="text-xs text-muted-foreground">{c.attempts} attempts · created {formatWhen(c.created)}</span>
              <StatusBadge tone={CAMPAIGN_STATUS[c.status].tone}>{CAMPAIGN_STATUS[c.status].label}</StatusBadge>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function Lists() {
  return (
    <Panel
      title="Call lists"
      description="Ineligible entries (opted out, blocked, invalid) are excluded automatically."
      actions={
        <Button size="sm" variant="outline" onClick={() => toast('Import CSV', { description: 'Map name, phone and tags columns.' })}>
          <Upload />
          Import CSV
        </Button>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y">
        {LISTS.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <span className="flex flex-col">
              <span className="text-sm font-medium">{l.name}</span>
              <span className="text-xs text-muted-foreground">{l.source} · updated {formatWhen(l.updated)}</span>
            </span>
            <span className="flex gap-2 text-xs">
              <StatusBadge tone="success">{l.eligible} eligible</StatusBadge>
              <StatusBadge tone="muted">{l.ineligible} excluded</StatusBadge>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
