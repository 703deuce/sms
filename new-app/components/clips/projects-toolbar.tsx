'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ProjectsToolbar({
  q,
  status,
}: {
  q?: string
  status?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [query, setQuery] = useState(q || '')

  useEffect(() => {
    setQuery(q || '')
  }, [q])

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      const trimmed = query.trim()
      if (trimmed) next.set('q', trimmed)
      else next.delete('q')
      const qs = next.toString()
      router.replace(qs ? `/app/clips?${qs}` : '/app/clips')
    }, 300)
    return () => clearTimeout(t)
  }, [query, params, router])

  const statusValue = useMemo(() => status || 'all', [status])

  const setStatus = (value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value === 'all') next.delete('status')
    else next.set('status', value)
    const qs = next.toString()
    router.replace(qs ? `/app/clips?${qs}` : '/app/clips')
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pb-4" data-testid="projects-toolbar">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 w-64 pl-9"
          placeholder="Search projects…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Project status">
        {(
          [
            { value: 'all', label: 'All' },
            { value: 'processing', label: 'Processing', dot: 'bg-sky-500' },
            { value: 'ready', label: 'Ready', dot: 'bg-emerald-500' },
            { value: 'failed', label: 'Failed', dot: 'bg-red-500' },
          ] satisfies Array<{ value: string; label: string; dot?: string }>
        ).map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={statusValue === opt.value ? 'default' : 'outline'}
            className="h-9 gap-1.5 rounded-lg px-3 text-xs"
            onClick={() => setStatus(opt.value)}
          >
            {'dot' in opt && opt.dot ? <span className={`size-1.5 rounded-full ${opt.dot}`} /> : null}
            {opt.label}
          </Button>
        ))}
      </div>
      {(q || status) && (
        <Button size="sm" variant="outline" render={<Link href="/app/clips" />}>Clear</Button>
      )}
    </div>
  )
}
