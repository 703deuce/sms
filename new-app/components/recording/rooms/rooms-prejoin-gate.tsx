'use client'

import { useEffect, useState } from 'react'
import { RoomsPrejoinClient } from './prejoin-client'
import {
  clearPendingGuestPrejoin,
  isSessionHostClient,
  readPendingGuestPrejoin,
} from '@/lib/recording/rooms-join-storage'
import { assertLiveKitWsUrl } from '@/lib/recording/livekit-connect'

type Role = 'HOST' | 'GUEST' | 'PRODUCER'

type Creds = {
  token: string
  url: string
  identity: string
  role: Role
}

export function RoomsPrejoinGate({
  sessionId,
  sessionTitle,
  hostFromCookie = false,
}: {
  sessionId: string
  sessionTitle: string
  hostFromCookie?: boolean
}) {
  const [creds, setCreds] = useState<Creds | null>(null)
  const [role, setRole] = useState<Role>('GUEST')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const pending = readPendingGuestPrejoin(sessionId)
      if (pending) {
        clearPendingGuestPrejoin(sessionId)
        try {
          const url = assertLiveKitWsUrl(pending.url)
          if (!cancelled) {
            setCreds({
              token: pending.token,
              url,
              identity: pending.identity,
              role: (pending.role.toUpperCase() as Role) || 'GUEST',
            })
            setRole((pending.role.toUpperCase() as Role) || 'GUEST')
          }
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e))
        } finally {
          if (!cancelled) setLoading(false)
        }
        return
      }

      const isHost = isSessionHostClient(sessionId)
      if (isHost) {
        try {
          const res = await fetch(`/api/recording/sessions/${sessionId}/token`, { method: 'POST' })
          const json = await res.json()
          if (!res.ok) {
            if (!cancelled) setError(json.error ?? 'Could not load host credentials')
            return
          }
          const url = assertLiveKitWsUrl(json.data.url as string)
          if (!cancelled) {
            setCreds({
              token: json.data.token as string,
              url,
              identity: json.data.identity as string,
              role: 'HOST',
            })
            setRole('HOST')
          }
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e))
        } finally {
          if (!cancelled) setLoading(false)
        }
        return
      }

      if (!cancelled) {
        setRole('GUEST')
        setCreds(null)
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Loading room…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    )
  }

  if (!creds) {
    return (
      <GuestPrejoinLoader sessionId={sessionId} sessionTitle={sessionTitle} />
    )
  }

  const isProducer = role === 'PRODUCER'
  return (
    <RoomsPrejoinClient
      sessionId={sessionId}
      sessionTitle={sessionTitle}
      role={role === 'HOST' ? 'HOST' : 'GUEST'}
      showHostBadge={role === 'HOST'}
      producerMode={isProducer}
      token={creds.token}
      livekitUrl={creds.url}
      identity={creds.identity}
    />
  )
}

function GuestPrejoinLoader({
  sessionId,
  sessionTitle,
}: {
  sessionId: string
  sessionTitle: string
}) {
  const [name, setName] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [guestCreds, setGuestCreds] = useState<Creds | null>(null)

  if (guestCreds) {
    return (
      <RoomsPrejoinClient
        sessionId={sessionId}
        sessionTitle={sessionTitle}
        role="GUEST"
        showHostBadge={false}
        token={guestCreds.token}
        livekitUrl={guestCreds.url}
        identity={guestCreds.identity}
        defaultDisplayName={name}
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="w-full max-w-[400px] space-y-4 rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Join as guest</h1>
        <p className="text-[13px] text-muted-foreground">
          This room link is for guests. Enter your name, or use an invite link from the host.
        </p>
        <label className="block text-[13px] font-semibold">Your name</label>
        <input
          className="h-9 w-full rounded-lg border border-border px-3 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Display name"
        />
        {joinError ? <p className="text-xs text-destructive">{joinError}</p> : null}
        <button
          type="button"
          disabled={!name.trim() || joining}
          className="h-9 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
          onClick={async () => {
            setJoining(true)
            setJoinError(null)
            try {
              const res = await fetch(`/api/recording/sessions/${sessionId}/join-guest`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ displayName: name.trim() }),
              })
              const json = await res.json()
              if (!res.ok) {
                setJoinError(json.error ?? 'Could not join')
                return
              }
              const url = assertLiveKitWsUrl(json.data.url as string)
              setGuestCreds({
                token: json.data.token as string,
                url,
                identity: json.data.participantId as string,
                role: 'GUEST',
              })
            } catch (e) {
              setJoinError(e instanceof Error ? e.message : 'Network error')
            } finally {
              setJoining(false)
            }
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
