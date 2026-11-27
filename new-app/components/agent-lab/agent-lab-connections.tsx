'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

type AuthField = {
  name: string
  display_name?: string
  type?: string
  description?: string
  required?: boolean
  is_secret?: boolean
}

type ConnectedMap = Record<string, { status?: string; connected_at?: string | null }>

const DATA = catalog as Catalog

const TYPE_FILTERS: { id: 'all' | 'one_click' | 'api_key' | 'no_auth' | 'connected'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'one_click', label: 'One-click' },
  { id: 'api_key', label: 'API key' },
  { id: 'no_auth', label: 'No sign-in' },
  { id: 'connected', label: 'Connected' },
]

function matchesType(
  app: CatalogApp,
  filter: (typeof TYPE_FILTERS)[number]['id'],
  connected: ConnectedMap,
) {
  if (filter === 'all') return true
  if (filter === 'one_click') return app.connect === 'one_click' || app.connect === 'native'
  if (filter === 'connected') return Boolean(connected[app.slug])
  return app.connect === filter
}

function labelVariant(kind: ConnectKind): 'default' | 'secondary' | 'outline' | 'beta' {
  if (kind === 'one_click' || kind === 'native') return 'default'
  if (kind === 'api_key') return 'secondary'
  return 'outline'
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(String(data?.error || `Request failed (${res.status})`))
  return data
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
  const [connected, setConnected] = useState<ConnectedMap>({})
  const [noAuth, setNoAuth] = useState<Set<string>>(new Set())
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [oauthNote, setOauthNote] = useState<string | null>(null)

  const [modalApp, setModalApp] = useState<CatalogApp | null>(null)
  const [modalFields, setModalFields] = useState<AuthField[]>([])
  const [modalGuide, setModalGuide] = useState<string | null>(null)
  const [modalValues, setModalValues] = useState<Record<string, string>>({})
  const [modalError, setModalError] = useState<string | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalSubmitting, setModalSubmitting] = useState(false)

  const refreshStatus = useCallback(async () => {
    try {
      const data = await api<{
        connected?: ConnectedMap
        no_auth_toolkits?: string[]
      }>('/api/agent-lab/connections/connected')
      setConnected(data.connected || {})
      setNoAuth(new Set((data.no_auth_toolkits || []).map((s) => s.toLowerCase())))
      setStatusError(null)
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Could not load connection status')
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
    const onFocus = () => {
      void refreshStatus()
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshStatus()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refreshStatus])

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
      if (!matchesType(app, type, connected)) return false
      if (category !== 'all' && !(app.categories || []).includes(category)) return false
      if (!needle) return true
      const hay = [app.name, app.slug, app.description, ...(app.categories || [])].join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }, [q, type, category, connected])

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
  const connectedCount = Object.keys(connected).length

  const isNoAuth = (app: CatalogApp) => app.connect === 'no_auth' || noAuth.has(app.slug)
  const isConnected = (app: CatalogApp) => Boolean(connected[app.slug])

  async function onConnect(app: CatalogApp) {
    setActionError(null)
    setOauthNote(null)
    if (isNoAuth(app)) return
    if (app.connect === 'api_key') {
      setModalApp(app)
      setModalFields([])
      setModalGuide(null)
      setModalValues({})
      setModalError(null)
      setModalLoading(true)
      try {
        const data = await api<{
          fields?: AuthField[]
          auth_guide_url?: string | null
          hint_url?: string | null
          kind?: string
        }>(`/api/agent-lab/connections/auth-fields?toolkit=${encodeURIComponent(app.slug)}`)
        if (data.kind && data.kind !== 'api_key') {
          setModalApp(null)
          setActionError('This app does not use an API key. Try Connect again as a one-click sign-in.')
          return
        }
        setModalFields(data.fields || [])
        setModalGuide(data.auth_guide_url || data.hint_url || null)
      } catch (err) {
        setModalError(err instanceof Error ? err.message : 'Could not load sign-in fields')
      } finally {
        setModalLoading(false)
      }
      return
    }
    setBusy(app.slug)
    try {
      const data = await api<{ url: string }>('/api/agent-lab/connections/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolkit: app.slug }),
      })
      const popup = window.open(data.url, 'agentlab-connect', 'noopener,noreferrer,width=640,height=720')
      if (!popup) window.open(data.url, '_blank', 'noopener,noreferrer')
      setOauthNote(`Finish signing in to ${app.name} in the new tab. This page will update when you come back. You'll see Composio on the sign-in screen — Composio is our secure connection partner.`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not start connect')
    } finally {
      setBusy(null)
    }
  }

  async function onDisconnect(app: CatalogApp) {
    if (!window.confirm(`Disconnect ${app.name}? The agent will not be able to use it until you connect again.`)) return
    setActionError(null)
    setBusy(app.slug)
    try {
      await api('/api/agent-lab/connections/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolkit: app.slug }),
      })
      await refreshStatus()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not disconnect')
    } finally {
      setBusy(null)
    }
  }

  async function submitApiKey() {
    if (!modalApp) return
    const fields: Record<string, string> = {}
    for (const f of modalFields) {
      const v = (modalValues[f.name] || '').trim()
      if (!v && f.required !== false) {
        setModalError(`Enter ${f.display_name || f.name}`)
        return
      }
      if (v) fields[f.name] = v
    }
    setModalSubmitting(true)
    setModalError(null)
    try {
      await api('/api/agent-lab/connections/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolkit: modalApp.slug, fields }),
      })
      setModalValues({})
      setModalApp(null)
      await refreshStatus()
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Could not connect')
    } finally {
      setModalSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Connections securely handled by Composio. You&apos;ll see Composio on the sign-in screen.</p>
        <p>
          One-click apps open a secure sign-in tab. For API-key apps, Connect asks for the key on this page — it is
          sent to the agent host and never shown in the address bar. Apps that need no setup are marked Ready.
        </p>
        <p>
          {DATA.included.toLocaleString()} apps from a live catalog of {DATA.catalog_total.toLocaleString()} toolkits
          ({oneClick.toLocaleString()} one-click, including {DATA.counts.native} built-in;{' '}
          {(DATA.counts.api_key || 0).toLocaleString()} API key; {DATA.counts.no_auth || 0} no sign-in).{' '}
          {DATA.excluded_oauth_unmanaged.toLocaleString()} unmanaged OAuth apps are omitted because they need our own
          app registration.
          {statusLoading ? ' Loading status…' : connectedCount ? ` ${connectedCount} connected.` : ''}
        </p>
      </div>

      {statusError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Could not load connection status: {statusError}{' '}
          <button type="button" className="underline" onClick={() => void refreshStatus()}>
            Retry
          </button>
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}
      {oauthNote ? (
        <p className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-foreground">{oauthNote}</p>
      ) : null}

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
                {group.apps.map((app) => {
                  const ready = isNoAuth(app)
                  const on = isConnected(app)
                  return (
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
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {ready ? (
                              <Badge variant="outline">Ready, no setup needed</Badge>
                            ) : on ? (
                              <>
                                <Badge variant="default">Connected</Badge>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={busy === app.slug}
                                  onClick={() => void onDisconnect(app)}
                                >
                                  {busy === app.slug ? 'Working…' : 'Disconnect'}
                                </Button>
                              </>
                            ) : (
                              <>
                                <Badge variant="outline">Not connected</Badge>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={busy === app.slug}
                                  onClick={() => void onConnect(app)}
                                >
                                  {busy === app.slug ? 'Working…' : 'Connect'}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Dialog
        open={modalApp !== null}
        onOpenChange={(open) => {
          if (!open && !modalSubmitting) {
            setModalApp(null)
            setModalValues({})
            setModalError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect {modalApp?.name}</DialogTitle>
            <DialogDescription>
              Your key is sent securely to the agent host and is never shown in the address bar or stored in the
              browser.
            </DialogDescription>
          </DialogHeader>
          {modalLoading ? (
            <p className="text-sm text-muted-foreground">Loading fields…</p>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                void submitApiKey()
              }}
            >
              {modalFields.map((f) => (
                <div key={f.name} className="flex flex-col gap-1.5">
                  <Label htmlFor={`conn-field-${f.name}`}>
                    {f.display_name || f.name}
                    {f.required === false ? '' : ' (required)'}
                  </Label>
                  <Input
                    id={`conn-field-${f.name}`}
                    name={f.name}
                    type={f.is_secret === false ? 'text' : 'password'}
                    autoComplete="off"
                    value={modalValues[f.name] || ''}
                    onChange={(e) => setModalValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                    required={f.required !== false}
                  />
                  {f.description ? <p className="text-xs text-muted-foreground">{f.description}</p> : null}
                </div>
              ))}
              {modalGuide ? (
                <p className="text-xs">
                  <a href={modalGuide} target="_blank" rel="noopener noreferrer" className="underline">
                    Where do I find my key?
                  </a>
                </p>
              ) : null}
              {modalError ? <p className="text-sm text-destructive">{modalError}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalApp(null)} disabled={modalSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={modalSubmitting || modalLoading || modalFields.length === 0}>
                  {modalSubmitting ? 'Connecting…' : 'Connect'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
