'use client'

import Link from 'next/link'
import { Mic, MicOff, Pause, Phone, PhoneOff, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { formatDuration, formatPhone } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_LABEL = {
  idle: 'Idle',
  connecting: 'Connecting…',
  ringing: 'Ringing…',
  live: 'Live',
  ended: 'Call ended',
  failed: 'Call failed',
}

export function IncomingCallBar() {
  const { incomingCall, answerIncoming, rejectIncoming } = useWorkspace()
  if (!incomingCall) return null
  return (
    <div
      role="region"
      aria-label="Incoming call"
      className="sticky top-16 z-30 flex flex-wrap items-center gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2"
    >
      <span className="text-sm font-medium">Incoming call</span>
      <span className="font-mono text-sm">{formatPhone(incomingCall.from)}</span>
      <div className="ml-auto flex gap-2">
        <Button size="sm" className="bg-success text-success-foreground" onClick={answerIncoming}>
          <Phone />
          Answer
        </Button>
        <Button size="sm" variant="destructive" onClick={rejectIncoming}>
          <PhoneOff />
          Decline
        </Button>
      </div>
    </div>
  )
}

export function ActiveCallBar() {
  const { activeCall, elapsed, endCall, toggleMute, toggleHold } = useWorkspace()
  if (!activeCall) return null
  const live = activeCall.status === 'live'
  const ended = activeCall.status === 'ended' || activeCall.status === 'failed'

  return (
    <div
      role="region"
      aria-label="Active call"
      className="sticky top-16 z-30 flex flex-wrap items-center gap-3 border-b border-primary/15 bg-accent px-4 py-2 text-accent-foreground"
    >
      <span className="relative flex size-2.5">
        {live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-70" />}
        <span className={cn('relative inline-flex size-2.5 rounded-full', ended ? 'bg-muted-foreground' : 'bg-warning')} />
      </span>
      <Link href="/app/phone/dialer" className="flex min-w-0 items-baseline gap-2 hover:underline">
        <span className="truncate text-sm font-medium">{activeCall.name}</span>
        <span className="font-mono text-xs text-muted-foreground">{formatPhone(activeCall.number)}</span>
      </Link>
      <span aria-live="polite" className="font-mono text-xs text-foreground">
        {live ? formatDuration(elapsed || 0) || '0:00' : STATUS_LABEL[activeCall.status]}
        {activeCall.onHold && ' · On hold'}
      </span>
      <span className="rounded-md surface px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        Live
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="text-accent-foreground hover:bg-card hover:text-foreground"
          onClick={toggleMute}
          disabled={!live}
          aria-pressed={activeCall.muted}
        >
          {activeCall.muted ? <MicOff /> : <Mic />}
          <span className="hidden sm:inline">{activeCall.muted ? 'Unmute' : 'Mute'}</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-accent-foreground hover:bg-card hover:text-foreground"
          onClick={toggleHold}
          disabled={!live}
          aria-pressed={activeCall.onHold}
        >
          {activeCall.onHold ? <Play /> : <Pause />}
          <span className="hidden sm:inline">{activeCall.onHold ? 'Resume' : 'Hold'}</span>
        </Button>
        <Button size="sm" className="bg-destructive text-primary-foreground hover:bg-destructive/90" onClick={endCall} disabled={ended}>
          <PhoneOff />
          Hang up
        </Button>
      </div>
    </div>
  )
}
