'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function CrmOAuthConnectButton({
  provider,
  children,
  size = 'sm',
  variant = 'default',
}: {
  provider: string
  children: React.ReactNode
  size?: 'sm' | 'default'
  variant?: 'default' | 'outline'
}) {
  const [busy, setBusy] = useState(false)

  const connect = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/crm/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error((j as { error?: string }).error || 'Could not start connect')
      const url = (j as { data?: { redirectUrl?: string } }).data?.redirectUrl
      if (!url) throw new Error('No authorization URL returned')
      window.location.href = url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Connect failed')
      setBusy(false)
    }
  }

  return (
    <Button type="button" size={size} variant={variant} disabled={busy} onClick={() => void connect()}>
      {children}
    </Button>
  )
}
