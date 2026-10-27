'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PrimaryButton } from '@/components/app/primary-button'
import { Input } from '@/components/ui/input'
import { markSessionHost } from '@/lib/recording/rooms-join-storage'
import { RoomsFullPage, RoomsTopBar } from './rooms-layout-shell'

export function RoomsNewClient() {
  const router = useRouter()
  const [title, setTitle] = useState('Untitled room')
  const [hostName, setHostName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function create() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/recording/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, hostDisplayName: hostName || 'Host' }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to create session')
        return
      }
      markSessionHost(json.data.sessionId)
      router.push(`/app/rooms/${json.data.sessionId}`)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <RoomsFullPage>
      <RoomsTopBar title="Start a room" />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="surface w-full max-w-[480px] space-y-4 rounded-xl border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">Record with others</h1>
          <div className="space-y-2">
            <label className="text-[13px] font-semibold">Room title</label>
            <Input className="h-9" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-[13px] font-semibold">Your name</label>
            <Input className="h-9" value={hostName} onChange={(e) => setHostName(e.target.value)} />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <PrimaryButton className="h-9 w-full" disabled={loading || !title.trim()} onClick={create}>
            Create room
          </PrimaryButton>
        </div>
      </div>
    </RoomsFullPage>
  )
}
