'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

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
        />
      </div>
      <ToggleGroup
        type="single"
        value={statusValue}
        onValueChange={(v) => v && setStatus(v)}
        className="flex flex-wrap gap-1"
      >
        <ToggleGroupItem value="all" className="h-9 rounded-lg px-3 text-xs">All</ToggleGroupItem>
        <ToggleGroupItem value="processing" className="h-9 gap-1.5 rounded-lg px-3 text-xs">
          <span className="size-1.5 rounded-full bg-sky-500" />
          Processing
        </ToggleGroupItem>
        <ToggleGroupItem value="ready" className="h-9 gap-1.5 rounded-lg px-3 text-xs">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Ready
        </ToggleGroupItem>
        <ToggleGroupItem value="failed" className="h-9 gap-1.5 rounded-lg px-3 text-xs">
          <span className="size-1.5 rounded-full bg-red-500" />
          Failed
        </ToggleGroupItem>
      </ToggleGroup>
      {(q || status) && (
        <Button size="sm" variant="outline" render={<Link href="/app/clips" />}>Clear</Button>
      )}
    </div>
  )
}
