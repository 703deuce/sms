'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PrimaryButton } from '@/components/app/primary-button'
import { Input } from '@/components/ui/input'
import { RoomsFullPage, RoomsTopBar } from './rooms-layout-shell'

/** Guest entry: exchange invite token → prejoin */
export function GuestJoinClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tokenFromUrl = searchParams.get('token') ?? ''
  const [inviteToken, setInviteToken] = useState(tokenFromUrl)
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onContinue() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/recording/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inviteToken, displayName }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not join')
        return
      }
      const { sessionId, participantId, token, url } = json.data
      sessionStorage.setItem(
        `rooms:${sessionId}`,
        JSON.stringify({
          token,
          url,
          identity: participantId,
          displayName,
          role: 'GUEST',
          headphones: 'yes',
        }),
      )
      router.push(`/app/rooms/${sessionId}/studio`)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <RoomsFullPage>
      <RoomsTopBar title="Join a room" />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="surface w-full max-w-[400px] space-y-4 rounded-xl border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">Join recording</h1>
          <div className="space-y-2">
            <label className="text-[13px] font-semibold">Invite link token</label>
            <Input className="h-9" value={inviteToken} onChange={(e) => setInviteToken(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-[13px] font-semibold">Your name</label>
            <Input className="h-9" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <PrimaryButton
            className="h-9 w-full"
            disabled={!inviteToken || !displayName.trim() || loading}
            onClick={onContinue}
          >
            Continue
          </PrimaryButton>
        </div>
      </div>
    </RoomsFullPage>
  )
}
