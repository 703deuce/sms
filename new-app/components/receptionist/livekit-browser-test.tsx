'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Mic, PhoneOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { startReceptionistLiveKitTest } from '@/lib/receptionist-api'

type ToolEvent = { tool: string; ok: boolean; at: string }

export function LiveKitBrowserTest({ version }: { version: 'draft' | 'live' }) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'ended' | 'error'>('idle')
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([])
  const roomRef = useRef<import('livekit-client').Room | null>(null)

  const end = useCallback(async () => {
    const room = roomRef.current
    if (room) {
      await room.disconnect()
      roomRef.current = null
    }
    setStatus('ended')
  }, [])

  const start = async () => {
    setStatus('connecting')
    setToolEvents([])
    try {
      const session = await startReceptionistLiveKitTest(version)
      const { Room, RoomEvent } = await import('livekit-client')
      const room = new Room()
      roomRef.current = room
      room.on(RoomEvent.DataReceived, (payload) => {
        try {
          const text = new TextDecoder().decode(payload)
          const parsed = JSON.parse(text) as { type?: string; tool?: string; ok?: boolean }
          if (parsed.type === 'tool_event' && parsed.tool) {
            setToolEvents((e) => [
              { tool: parsed.tool!, ok: parsed.ok !== false, at: new Date().toISOString() },
              ...e,
            ])
          }
        } catch {
          /* ignore non-json */
        }
      })
      await room.connect(session.livekit.url, session.livekit.token)
      setStatus('connected')
      toast.success('Connected to LiveKit', {
        description: 'Speak into your microphone — the V3 worker handles the conversation.',
      })
    } catch (e) {
      setStatus('error')
      toast.error(e instanceof Error ? e.message : 'LiveKit test failed')
    }
  }

  return (
    <Panel title="Live voice test (LiveKit)">
      <p className="mb-3 text-sm text-muted-foreground">
        Real browser session against the Python V3 worker using your {version} configuration. Requires LiveKit env and a running worker.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusBadge tone={status === 'connected' ? 'success' : status === 'error' ? 'danger' : 'muted'}>
          {status}
        </StatusBadge>
        {status === 'idle' || status === 'ended' || status === 'error' ? (
          <Button onClick={() => void start()}>
            <Mic data-icon="inline-start" />
            Start live test
          </Button>
        ) : (
          <Button variant="outline" onClick={() => void end()}>
            {status === 'connecting' ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <PhoneOff data-icon="inline-start" />}
            End session
          </Button>
        )}
      </div>
      {toolEvents.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-lg border p-2 font-mono text-[11px]">
          {toolEvents.map((ev, i) => (
            <li key={i} className={ev.ok ? 'text-muted-foreground' : 'text-destructive'}>
              {ev.tool} · {ev.at}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
