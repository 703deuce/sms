'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'

export function ClipsAccessForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/app/clips'
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/clips/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || 'Access denied')
      router.replace(next.startsWith('/') ? next : '/app/clips')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Access denied')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Page className="mx-auto max-w-md py-16">
      <PageHeader title="Clips access" description="Enter the shared password to open the app (temporary until sign-in ships)." />
      <Panel>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(error)}
          />
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <Button type="submit" disabled={loading || !password}>{loading ? 'Checking…' : 'Continue'}</Button>
        </form>
      </Panel>
    </Page>
  )
}
