'use client'

import { useEffect, useRef, useState } from 'react'
import { ConnectionQuality, Track, type Participant, type Room } from 'livekit-client'
import { MoreHorizontal, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { TrackUploadProgress } from '@/lib/recording/track-upload-manager'
import {
  listMediaDeviceOptions,
  switchCameraViaReplaceTrack,
  switchMicrophoneViaReplaceTrack,
} from '@/lib/recording/livekit-devices'

export type PeopleRow = {
  identity: string
  name: string
  role: string
  isLocal: boolean
  micOn: boolean
  camOn: boolean
  quality: ConnectionQuality
  recording: boolean
  uploadPct?: number
}

function qualityLabel(q: ConnectionQuality) {
  if (q === ConnectionQuality.Excellent || q === ConnectionQuality.Good) return 'Internet connection is good'
  if (q === ConnectionQuality.Poor) return 'Connection is weak'
  if (q === ConnectionQuality.Lost) return 'Connection lost'
  return 'Checking connection…'
}

function qualityDotClass(q: ConnectionQuality) {
  if (q === ConnectionQuality.Excellent || q === ConnectionQuality.Good) return 'bg-success'
  if (q === ConnectionQuality.Poor) return 'bg-warning'
  return 'bg-destructive'
}

export function PeoplePanel({
  room,
  rows,
  recorded,
  notRecorded,
  hostIdentity,
  localIdentity,
  onKick,
  onMute,
  onPin,
  echoCancellation,
  onEchoChange,
}: {
  room: Room | null
  rows: PeopleRow[]
  recorded: PeopleRow[]
  notRecorded: PeopleRow[]
  sessionId: string
  hostIdentity: string
  localIdentity: string
  onKick: (identity: string) => void
  onMute: (identity: string, trackSid: string, muted: boolean) => void
  onPin: (identity: string | null) => void
  echoCancellation: boolean
  onEchoChange: (on: boolean) => void
}) {
  const [cameras, setCameras] = useState<{ deviceId: string; label: string }[]>([])
  const [mics, setMics] = useState<{ deviceId: string; label: string }[]>([])
  const [cameraId, setCameraId] = useState('')
  const [micId, setMicId] = useState('')

  useEffect(() => {
    void listMediaDeviceOptions('videoinput').then(setCameras)
    void listMediaDeviceOptions('audioinput').then(setMics)
  }, [])

  const localRow = rows.find((r) => r.isLocal)
  const localUploadPct = localRow?.uploadPct ?? 0
  const localQuality = room?.localParticipant.connectionQuality ?? ConnectionQuality.Unknown

  const canHostControl = Boolean(hostIdentity && localIdentity === hostIdentity)

  return (
    <aside className="flex h-full w-[296px] shrink-0 flex-col border-l border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        <p className="text-sm font-semibold">People</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
        <Section
          title={`Recorded (${recorded.length})`}
          rows={recorded}
          canHostControl={canHostControl}
          room={room}
          onKick={onKick}
          onMute={onMute}
          onPin={onPin}
        />
        <Section
          title={`Not recorded (${notRecorded.length})`}
          rows={notRecorded}
          canHostControl={canHostControl}
          room={room}
          onKick={onKick}
          onMute={onMute}
          onPin={onPin}
        />
      </div>
      <div className="space-y-3 border-t border-border p-3 text-xs">
        <div>
          <p className="font-semibold uppercase tracking-wide text-muted-foreground">Connection</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${localUploadPct}%` }} />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
            <span className={cn('size-2 rounded-full', qualityDotClass(localQuality))} />
            {qualityLabel(localQuality)}
            <span className="ml-auto font-mono tabular-nums">{localUploadPct}% uploaded</span>
          </p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wide text-muted-foreground">Audio &amp; video</p>
          <label className="mt-2 flex h-9 items-center justify-between gap-2">
            <span>Echo cancellation</span>
            <input type="checkbox" checked={echoCancellation} onChange={(e) => onEchoChange(e.target.checked)} />
          </label>
          <label className="mt-2 block">
            <span className="text-muted-foreground">Camera</span>
            <select
              className="mt-1 flex h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px]"
              value={cameraId}
              onChange={async (e) => {
                const id = e.target.value
                setCameraId(id)
                if (room && id) await switchCameraViaReplaceTrack(room.localParticipant, id)
              }}
            >
              <option value="">Default camera</option>
              {cameras.map((c) => (
                <option key={c.deviceId} value={c.deviceId}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="mt-2 block">
            <span className="text-muted-foreground">Microphone</span>
            <select
              className="mt-1 flex h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px]"
              value={micId}
              onChange={async (e) => {
                const id = e.target.value
                setMicId(id)
                if (room && id) await switchMicrophoneViaReplaceTrack(room.localParticipant, id, echoCancellation)
              }}
            >
              <option value="">Default microphone</option>
              {mics.map((m) => (
                <option key={m.deviceId} value={m.deviceId}>{m.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </aside>
  )
}

function Section({
  title,
  rows,
  canHostControl,
  room,
  onKick,
  onMute,
  onPin,
}: {
  title: string
  rows: PeopleRow[]
  canHostControl: boolean
  room: Room | null
  onKick: (identity: string) => void
  onMute: (identity: string, trackSid: string, muted: boolean) => void
  onPin: (identity: string | null) => void
}) {
  if (!rows.length) return null
  return (
    <div className="mb-4">
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <ParticipantRow
            key={row.identity}
            row={row}
            room={room}
            canHostControl={canHostControl}
            onKick={onKick}
            onMute={onMute}
            onPin={onPin}
          />
        ))}
      </ul>
    </div>
  )
}

function ParticipantRow({
  row,
  room,
  canHostControl,
  onKick,
  onMute,
  onPin,
}: {
  row: PeopleRow
  room: Room | null
  canHostControl: boolean
  onKick: (identity: string) => void
  onMute: (identity: string, trackSid: string, muted: boolean) => void
  onPin: (identity: string | null) => void
}) {
  const participant = room?.localParticipant.identity === row.identity
    ? room?.localParticipant
    : room?.remoteParticipants.get(row.identity)
  const micSid = participant?.getTrackPublication(Track.Source.Microphone)?.trackSid ?? ''

  return (
    <li className="flex h-14 items-center gap-2 rounded-lg px-1 hover:bg-accent/40">
      <div className="flex size-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
        {row.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{row.name}</p>
        <p className="text-[11px] text-muted-foreground">{row.role}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={!canHostControl && !row.isLocal}
        onClick={() => {
          if (row.isLocal) {
            void room?.localParticipant.setMicrophoneEnabled(!row.micOn)
          } else if (micSid) onMute(row.identity, micSid, !row.micOn)
        }}
      >
        {row.micOn ? <Mic className="size-4" /> : <MicOff className="size-4 text-destructive" />}
      </Button>
      <Button variant="ghost" size="icon" className="size-7" disabled={row.isLocal}>
        {row.camOn ? <Video className="size-4" /> : <VideoOff className="size-4 text-muted-foreground" />}
      </Button>
      {canHostControl && !row.isLocal && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" />}>
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onPin(row.identity)}>Pin participant</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onKick(row.identity)}>
              Remove participant
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  )
}

export function ParticipantVideoTile({
  participant,
  name,
  active,
  pinned,
  pttHighlight,
  isScreenShare,
}: {
  participant: Participant
  name: string
  active?: boolean
  pinned?: boolean
  pttHighlight?: boolean
  isScreenShare?: boolean
}) {
  const source = isScreenShare ? Track.Source.ScreenShare : Track.Source.Camera
  const videoPub = participant.getTrackPublication(source)
  const videoTrack = videoPub?.videoTrack
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = videoRef.current
    if (el && videoTrack) {
      videoTrack.attach(el)
      return () => {
        videoTrack.detach(el)
      }
    }
  }, [videoTrack])
  const micMuted = participant.isMicrophoneEnabled === false
  return (
    <div
      className={cn(
        'relative flex aspect-video items-end overflow-hidden rounded-xl bg-black/40 p-3 ring-1 ring-white/10',
        active && 'ring-[3px] ring-[oklch(0.72_0.17_150)]',
        pinned && 'ring-[3px] ring-primary',
        pttHighlight && 'ring-[3px] ring-destructive',
      )}
    >
      {!videoTrack && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">Camera is off</div>
      )}
      <video ref={videoRef} className="absolute inset-0 size-full object-cover" playsInline />
      {pttHighlight && (
        <span className="absolute right-3 top-3 rounded-full bg-destructive p-2 text-white" title="Producer speaking">
          <Mic className="size-4" />
        </span>
      )}
      <span className="relative z-10 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
        {name}
        {isScreenShare ? ' · screen' : ''}
        {micMuted ? ' · mic off' : ''}
      </span>
    </div>
  )
}
