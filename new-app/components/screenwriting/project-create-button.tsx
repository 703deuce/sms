'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function SwProjectCreateButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/sw/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New screenplay' }),
      })
      const json = (await res.json()) as { data?: { script: { id: string } }; error?: string }
      if (!res.ok) throw new Error(json.error || 'Create failed')
      const scriptId = json.data?.script?.id
      if (!scriptId) throw new Error('No script id')
      router.push(`/app/sw/scripts/${scriptId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size="sm" onClick={() => void create()} disabled={busy}>
      {busy ? 'Creating…' : 'New screenplay'}
    </Button>
  )
}
