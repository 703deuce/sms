'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mic, MicOff, MonitorUp, PhoneOff, Users, Video, VideoOff } from 'lucide-react'
import { Room, RoomEvent } from 'livekit-client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RoomsFullPage } from './rooms-layout-shell'
import { RoomsUploadCard } from './upload-card'

type JoinPayload = {
  token: string
  url: string
  identity: string
  displayName: string
  role: string
  headphones: string
}

/** §24 in-room layout (stage + bottom bar h72; People panel simplified for launch) */
export function RoomsStudioClient({ sessionId, sessionTitle }: { sessionId: string; sessionTitle: string }) {
  const router = useRouter()
  const [payload, setPayload] = useState<JoinPayload | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [connected, setConnected] = useState(false)
  const [recording, setRecording] = useState(false)
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null)
  const [recSeconds, setRecSeconds] = useState(0)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem(`rooms:${sessionId}`)
    if (!raw) {
      router.replace(`/app/rooms/${sessionId}`)
      return
    }
    setPayload(JSON.parse(raw) as JoinPayload)
  }, [router, sessionId])

  useEffect(() => {
    if (!payload) return
    const lkRoom = new Room({ adaptiveStream: true, dynacast: true })
    setRoom(lkRoom)
    lkRoom
      .connect(payload.url, payload.token)
      .then(async () => {
        setConnected(true)
        await lkRoom.localParticipant.setMicrophoneEnabled(true)
        await lkRoom.localParticipant.setCameraEnabled(true)
      })
      .catch(() => setConnected(false))
    lkRoom.on(RoomEvent.Disconnected, () => setConnected(false))
    return () => {
      lkRoom.disconnect()
    }
  }, [payload])

  useEffect(() => {
    if (!recording) return
    const t = window.setInterval(() => setRecSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [recording])

  const recLabel = useMemo(() => {
    const m = Math.floor(recSeconds / 60)
    const s = recSeconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }, [recSeconds])

  if (!payload) return null

  return (
    <RoomsFullPage>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        <Link href="/app/clips" className="text-[13px] text-muted-foreground hover:text-foreground">
          ← Back to editor
        </Link>
        <span className="flex-1 truncate text-center text-sm font-semibold">{sessionTitle}</span>
        <Button variant="outline" className="h-8 text-[13px]">Invite</Button>
      </header>
      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col bg-[oklch(0.1_0_0)] p-4">
          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
            <ParticipantTile name={payload.displayName} label="You" active />
            <ParticipantTile name="Waiting for others…" muted />
          </div>
          {showUpload ? (
            <div className="absolute bottom-20 right-4">
              <RoomsUploadCard onDone={() => router.push(`/app/rooms/${sessionId}/upload`)} />
            </div>
          ) : null}
        </main>
        <aside className="hidden w-[296px] shrink-0 border-l border-border bg-card p-3 lg:block">
          <p className="text-sm font-semibold">People</p>
          <p className="mt-4 text-xs text-muted-foreground">{connected ? 'Connected to room' : 'Connecting…'}</p>
        </aside>
        <nav className="hidden w-20 shrink-0 flex-col items-center gap-2 border-l border-border bg-card py-3 md:flex">
          <RailItem icon={Users} label="People" />
        </nav>
      </div>
      <footer className="flex h-[72px] shrink-0 items-center justify-center gap-4 border-t border-border bg-background px-4">
        {recording ? (
          <span className="rounded-full bg-lane-record px-3 py-1 font-mono text-[11px] tabular-nums text-white">
            ● REC {recLabel} | Rooms
          </span>
        ) : null}
        <button
          type="button"
          className="flex flex-col items-center gap-1"
          onClick={async () => {
            if (!recording) {
              setRecording(true)
              setRecSeconds(0)
              const res = await fetch(`/api/recording/sessions/${sessionId}/takes`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'start', startAtHostMs: Date.now() }),
              })
              const json = await res.json()
              if (json.data?.takeId) setActiveTakeId(json.data.takeId)
            } else {
              setRecording(false)
              setShowUpload(true)
              if (activeTakeId) {
                await fetch(`/api/recording/sessions/${sessionId}/takes`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    action: 'stop',
                    takeId: activeTakeId,
                    stopAtHostMs: Date.now(),
                  }),
                }).catch(() => {})
              }
            }
          }}
        >
          <span
            className={cn(
              'flex size-12 items-center justify-center rounded-full text-white',
              recording ? 'bg-destructive' : 'bg-lane-record',
            )}
          >
            {recording ? '■' : '●'}
          </span>
          <span className="text-[11px]">{recording ? 'Stop' : 'Start'}</span>
        </button>
        <RoundControl
          icon={micOn ? Mic : MicOff}
          label="Mic"
          onClick={async () => {
            const next = !micOn
            setMicOn(next)
            await room?.localParticipant.setMicrophoneEnabled(next)
          }}
        />
        <RoundControl
          icon={camOn ? Video : VideoOff}
          label="Video"
          onClick={async () => {
            const next = !camOn
            setCamOn(next)
            await room?.localParticipant.setCameraEnabled(next)
          }}
        />
        <RoundControl icon={MonitorUp} label="Share" onClick={() => {}} />
        <Button
          variant="outline"
          className="h-10 rounded-full border-destructive/40 bg-destructive/10 text-destructive"
          onClick={() => {
            room?.disconnect()
            router.push('/app/clips')
          }}
        >
          <PhoneOff className="mr-2 size-4" />
          Leave
        </Button>
      </footer>
    </RoomsFullPage>
  )
}

function ParticipantTile({
  name,
  label,
  active,
  muted,
}: {
  name: string
  label?: string
  active?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={cn(
        'relative flex aspect-video items-end rounded-xl bg-black/40 p-3 ring-1 ring-white/10',
        active && 'ring-[3px] ring-[oklch(0.72_0.17_150)]',
      )}
    >
      <span className="rounded-md bg-black/60 px-2 py-1 text-xs text-white">
        {label ? `${label} · ` : ''}
        {name}
        {muted ? ' (muted)' : ''}
      </span>
    </div>
  )
}

function RoundControl({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Mic
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" className="flex flex-col items-center gap-1" onClick={onClick}>
      <span className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white">
        <Icon className="size-[18px]" />
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </button>
  )
}

function RailItem({ icon: Icon, label }: { icon: typeof Users; label: string }) {
  return (
    <button type="button" className="flex h-14 w-16 flex-col items-center justify-center gap-1 rounded-lg hover:bg-accent/60">
      <Icon className="size-[18px]" />
      <span className="text-[10px]">{label}</span>
    </button>
  )
}
