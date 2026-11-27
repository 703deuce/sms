'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import catalog from '@/lib/agent-lab/connections-catalog.json'

export type ConnectKind = 'one_click' | 'api_key' | 'no_auth' | 'native'

export type CatalogApp = {
  slug: string
  name: string
  logo?: string
  description?: string
  categories: string[]
  connect: ConnectKind
  label: string
  source: 'composio' | 'native'
}

type Catalog = {
  generated_at: string
  source: string
  catalog_total: number
  fetched: number
  included: number
  excluded_oauth_unmanaged: number
  counts: Record<string, number>
  notes?: string
  apps: CatalogApp[]
}

const DATA = catalog as Catalog

const TYPE_FILTERS: { id: 'all' | 'one_click' | 'api_key' | 'no_auth'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'one_click', label: 'One-click' },
  { id: 'api_key', label: 'API key' },
  { id: 'no_auth', label: 'No sign-in' },
]

function matchesType(app: CatalogApp, filter: (typeof TYPE_FILTERS)[number]['id']) {
  if (filter === 'all') return true
  if (filter === 'one_click') return app.connect === 'one_click' || app.connect === 'native'
  return app.connect === filter
}

function labelVariant(kind: ConnectKind): 'default' | 'secondary' | 'outline' | 'beta' {
  if (kind === 'one_click' || kind === 'native') return 'default'
  if (kind === 'api_key') return 'secondary'
  return 'outline'
}

function Logo({ app }: { app: CatalogApp }) {
  const [failed, setFailed] = useState(false)
  const letter = (app.name || app.slug || '?').trim().charAt(0).toUpperCase()
  if (!app.logo || failed) {
    return (
      <div
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground"
      >
        {letter}
      </div>
    )
  }
  return (
    // CSP allows https: images; logos come from logos.composio.dev
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={app.logo}
      alt=""
      width={40}
      height={40}
      className="size-10 shrink-0 rounded-lg bg-muted object-contain"
      onError={() => setFailed(true)}
    />
  )
}

export function AgentLabConnections() {
  const [q, setQ] = useState('')
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]['id']>('all')
  const [category, setCategory] = useState('all')

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const app of DATA.apps) {
      for (const c of app.categories || []) {
        if (c) set.add(c)
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return DATA.apps.filter((app) => {
      if (!matchesType(app, type)) return false
      if (category !== 'all' && !(app.categories || []).includes(category)) return false
      if (!needle) return true
      const hay = [app.name, app.slug, app.description, ...(app.categories || [])].join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }, [q, type, category])

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogApp[]>()
    for (const app of filtered) {
      const keys = (app.categories || []).filter(Boolean)
      const key = keys[0] || 'Uncategorized'
      const list = map.get(key) || []
      list.push(app)
      map.set(key, list)
    }
    const names = [...map.keys()].sort((a, b) => {
      if (a === 'Uncategorized') return 1
      if (b === 'Uncategorized') return -1
      return a.localeCompare(b)
    })
    return names.map((name) => ({ name, apps: map.get(name)! }))
  }, [filtered])

  const oneClick = (DATA.counts.one_click || 0) + (DATA.counts.native || 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Connections securely handled by Composio. You&apos;ll see Composio on the sign-in screen.</p>
        <p>
          For apps marked &ldquo;Connect with your API key,&rdquo; paste the key in the Agent Lab chat and the agent will
          connect it for you. Don&apos;t paste keys on this page.
        </p>
        <p>
          {DATA.included.toLocaleString()} apps from a live catalog of {DATA.catalog_total.toLocaleString()} toolkits
          ({oneClick.toLocaleString()} one-click, including {DATA.counts.native} built-in;{' '}
          {(DATA.counts.api_key || 0).toLocaleString()} API key; {DATA.counts.no_auth || 0} no sign-in).{' '}
          {DATA.excluded_oauth_unmanaged.toLocaleString()} unmanaged OAuth apps are omitted because they need our own
          app registration.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search apps"
            aria-label="Search apps"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Connection type" className="flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={type === f.id}
                onClick={() => setType(f.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  type === f.id
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length.toLocaleString()} of {DATA.included.toLocaleString()} apps
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No apps match those filters.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map((group) => (
            <section key={group.name} className="flex flex-col gap-3">
              <h2 className="text-section-title font-semibold capitalize">{group.name}</h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.apps.map((app) => (
                  <li key={`${app.source}-${app.slug}`} className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Logo app={app} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="truncate text-sm font-semibold">{app.name}</h3>
                          <Badge variant={labelVariant(app.connect)}>{app.label}</Badge>
                          {app.source === 'native' ? <Badge variant="outline">Built-in</Badge> : null}
                        </div>
                        {app.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{app.description}</p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
