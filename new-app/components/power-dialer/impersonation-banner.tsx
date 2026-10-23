'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type State = {
  active: { sessionId: string; targetUserId: string; startedAt: string } | null
  canImpersonate: boolean
  reps: { userId: string; name: string; role: string }[]
}

export function PowerDialerImpersonationBanner() {
  const [state, setState] = useState<State | null>(null)

  const load = () => {
    void fetch('/api/phone/power-dialer/impersonation')
      .then((r) => r.json())
      .then((j) => setState(j.data))
      .catch(() => undefined)
  }

  useEffect(() => {
    load()
  }, [])

  if (!state?.active) return null
  const rep = state.reps.find((r) => r.userId === state.active?.targetUserId)

  return (
    <div
      className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm"
      role="status"
      aria-live="polite"
    >
      <span className="font-medium">Impersonation active:</span> you are viewing as{' '}
      <span className="font-medium">{rep?.name || state.active.targetUserId}</span>. Actions are logged
      under your admin account.
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="ml-3"
        onClick={() => {
          void fetch('/api/phone/power-dialer/impersonation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'stop' }),
          }).then(() => load())
        }}
      >
        Stop impersonation
      </Button>
    </div>
  )
}
