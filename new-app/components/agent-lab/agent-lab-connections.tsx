'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

type ConnectedMap = Record<string, { status?: string; connected_at?: string | null; missing?: string[] }>

export type TriggerItem = {
  trigger_id: string
  toolkit: string
  slug: string
  status: 'active' | 'paused' | 'needs_reconnect' | string
  paused_reason?: string | null
  auto_calls?: boolean
  auto_do?: boolean
  routine_id?: string | null
  routine_name?: string | null
}

type DeadEvent = { id: number; slug?: string | null; toolkit?: string | null; error?: string; received_at?: string; routine_id?: string | null }

function triggerKey(t: TriggerItem): string {
  return t.routine_id ? `${t.trigger_id}:${t.routine_id}` : t.trigger_id
}

const NO_TRIGGERS: TriggerItem[] = []

function triggerLabel(slug: string) {
  return slug.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

const DATA = catalog as Catalog
const PAGE_SIZE = 60
const OAUTH_BANNER_MS = 90_000
/** Third-party catalog logos 404 / fail SSL often and spam the console. Only auto-load hosts we trust. */
const LOGO_HOSTS = new Set(['logos.composio.dev', 'cdn.jsdelivr.net'])

const TYPE_FILTERS: { id: 'all' | 'one_click' | 'api_key' | 'no_auth' | 'connected'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'one_click', label: 'One-click' },
  { id: 'api_key', label: 'API key' },
  { id: 'no_auth', label: 'No sign-in' },
  { id: 'connected', label: 'Connected' },
]

function matchesType(app: CatalogApp, filter: (typeof TYPE_FILTERS)[number]['id']) {
  if (filter === 'all' || filter === 'connected') return true
  if (filter === 'one_click') return app.connect === 'one_click' || app.connect === 'native'
  return app.connect === filter
}

function labelVariant(kind: ConnectKind): 'default' | 'secondary' | 'outline' | 'beta' {
  if (kind === 'one_click' || kind === 'native') return 'default'
  if (kind === 'api_key') return 'secondary'
  return 'outline'
}

function safeLogo(url?: string): string | undefined {
  if (!url || !url.startsWith('https://')) return undefined
  try {
    const host = new URL(url).hostname
    if (LOGO_HOSTS.has(host)) return url
  } catch {
    return undefined
  }
  return undefined
}

function sameConnected(a: ConnectedMap, b: ConnectedMap) {
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  return ak.every((k) => a[k]?.status === b[k]?.status)
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

const Logo = memo(function Logo({ name, slug, logo }: { name: string; slug: string; logo?: string }) {
  const [failed, setFailed] = useState(false)
  const src = safeLogo(logo)
  const letter = (name || slug || '?').trim().charAt(0).toUpperCase()
  if (!src || failed) {
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
    // CSP allows https: images; we only request trusted logo hosts (see LOGO_HOSTS).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="size-10 shrink-0 rounded-lg bg-muted object-contain"
      onError={() => setFailed(true)}
    />
  )
})

const NO_MISSING: string[] = []

const AppCard = memo(function AppCard({
  app,
  ready,
  on,
  busy,
  expired,
  missing,
  triggers,
  busyTrigger,
  onConnect,
  onDisconnect,
  onToggleTrigger,
  onToggleAutoDo,
}: {
  app: CatalogApp
  ready: boolean
  on: boolean
  busy: boolean
  expired: boolean
  missing: string[]
  triggers: TriggerItem[]
  busyTrigger: string | null
  onConnect: (app: CatalogApp) => void
  onDisconnect: (app: CatalogApp) => void
  onToggleTrigger: (t: TriggerItem) => void
  onToggleAutoDo: (t: TriggerItem) => void
}) {
  return (
    <li className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Logo name={app.name} slug={app.slug} logo={app.logo} />
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
            ) : expired ? (
              <>
                <Badge variant="outline" className="border-destructive/50 text-destructive">
                  Needs reconnect
                </Badge>
                <Button type="button" size="sm" disabled={busy} onClick={() => onConnect(app)}>
                  {busy ? 'Working…' : 'Reconnect'}
                </Button>
              </>
            ) : on ? (
              <>
                <Badge variant="default">Connected</Badge>
                {missing.length ? (
                  <Badge variant="outline" className="border-amber-500/60 text-amber-700 dark:text-amber-400">
                    Missing permissions
                  </Badge>
                ) : null}
                {missing.length ? (
                  <Button type="button" size="sm" disabled={busy} onClick={() => onConnect(app)}>
                    {busy ? 'Working…' : 'Reconnect'}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onDisconnect(app)}>
                  {busy ? 'Working…' : 'Disconnect'}
                </Button>
              </>
            ) : (
              <>
                <Badge variant="outline">Not connected</Badge>
                <Button type="button" size="sm" disabled={busy} onClick={() => onConnect(app)}>
                  {busy ? 'Working…' : 'Connect'}
                </Button>
              </>
            )}
          </div>
          {on && !expired && missing.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Some actions will not work until you reconnect and allow: {missing.slice(0, 6).join(', ')}
              {missing.length > 6 ? ` and ${missing.length - 6} more` : ''}.
            </p>
          ) : null}
          {triggers.length ? (
            <ul className="mt-3 flex flex-col gap-1.5 border-t pt-2" aria-label={`${app.name} triggers`}>
              {triggers.map((t) => {
                const paused = t.status !== 'active'
                const waiting = t.status === 'needs_reconnect'
                return (
                  <li key={triggerKey(t)} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0">
                      <span className="font-medium">{triggerLabel(t.slug)}</span>
                      {t.routine_name ? <span className="text-muted-foreground"> → {t.routine_name}</span> : null}
                      <span className="block text-muted-foreground">
                        {waiting ? 'Paused until reconnected' : paused ? 'Paused' : 'Active'}
                        {t.auto_do || t.auto_calls ? ' · does it automatically' : ''}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        title="Do this trigger's saved action automatically, without asking in chat"
                        aria-checked={Boolean(t.auto_do || t.auto_calls)}
                        aria-label={`${t.auto_do || t.auto_calls ? 'Turn off' : 'Turn on'} automatic actions for ${t.routine_name || triggerLabel(t.slug)}`}
                        disabled={waiting || busyTrigger === triggerKey(t)}
                        onClick={() => onToggleAutoDo(t)}
                        className={cn(
                          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50',
                          t.auto_do || t.auto_calls ? 'bg-foreground' : 'bg-muted',
                        )}
                      >
                        <span
                          className={cn(
                            'inline-block size-3.5 rounded-full bg-background shadow transition-transform',
                            t.auto_do || t.auto_calls ? 'translate-x-4' : 'translate-x-0.5',
                          )}
                        />
                      </button>
                      <button
                        type="button"
                        role="switch"
                        title="Pause or resume this trigger"
                        aria-checked={!paused}
                        aria-label={`${paused ? 'Resume' : 'Pause'} ${t.routine_name || triggerLabel(t.slug)}`}
                        disabled={waiting || busyTrigger === triggerKey(t)}
                        onClick={() => onToggleTrigger(t)}
                        className={cn(
                          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50',
                          paused ? 'bg-muted' : 'bg-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'inline-block size-3.5 rounded-full bg-background shadow transition-transform',
                            paused ? 'translate-x-0.5' : 'translate-x-4',
                          )}
                        />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  )
})

export function AgentLabConnections() {
  const [q, setQ] = useState('')
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]['id']>('all')
  const [category, setCategory] = useState('all')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [connected, setConnected] = useState<ConnectedMap>({})
  const [noAuth, setNoAuth] = useState<Set<string>>(() => new Set())
  // Apps the host says customers cannot connect (host-side list, GB-7). Hidden unless already connected.
  const [unavailable, setUnavailable] = useState<Set<string>>(() => new Set())
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [oauthNote, setOauthNote] = useState<string | null>(null)
  const [triggers, setTriggers] = useState<TriggerItem[]>([])
  const [dead, setDead] = useState<DeadEvent[]>([])
  const [busyTrigger, setBusyTrigger] = useState<string | null>(null)
  const [connectHint, setConnectHint] = useState<CatalogApp | null>(null)
  const oauthSlug = useRef<string | null>(null)
  const oauthTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const oauthPoll = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastStatusAt = useRef(0)

  const [modalApp, setModalApp] = useState<CatalogApp | null>(null)
  const [modalFields, setModalFields] = useState<AuthField[]>([])
  const [modalGuide, setModalGuide] = useState<string | null>(null)
  const [modalValues, setModalValues] = useState<Record<string, string>>({})
  const [modalError, setModalError] = useState<string | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalSubmitting, setModalSubmitting] = useState(false)

  const clearOauthBanner = useCallback(() => {
    setOauthNote(null)
    oauthSlug.current = null
    if (oauthTimer.current) {
      clearTimeout(oauthTimer.current)
      oauthTimer.current = null
    }
    if (oauthPoll.current) {
      clearInterval(oauthPoll.current)
      oauthPoll.current = null
    }
  }, [])

  const refreshStatus = useCallback(async (opts?: { force?: boolean }) => {
    const now = Date.now()
    if (!opts?.force && now - lastStatusAt.current < 4000) return
    lastStatusAt.current = now
    try {
      const data = await api<{
        connected?: ConnectedMap
        no_auth_toolkits?: string[]
        unconnectable_toolkits?: string[]
        triggers?: TriggerItem[]
        dead_events?: DeadEvent[]
      }>('/api/agent-lab/connections/connected')
      const next = data.connected || {}
      setConnected((prev) => (sameConnected(prev, next) ? prev : next))
      setTriggers(data.triggers || [])
      setDead(data.dead_events || [])
      const nextNoAuth = data.no_auth_toolkits || []
      setNoAuth((prev) => {
        if (prev.size === nextNoAuth.length && nextNoAuth.every((s) => prev.has(s.toLowerCase()))) return prev
        return new Set(nextNoAuth.map((s) => s.toLowerCase()))
      })
      const nextHidden = data.unconnectable_toolkits || []
      setUnavailable((prev) => {
        if (prev.size === nextHidden.length && nextHidden.every((s) => prev.has(s.toLowerCase()))) return prev
        return new Set(nextHidden.map((s) => s.toLowerCase()))
      })
      setStatusError(null)
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Could not load connection status')
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshStatus({ force: true })
    const onFocus = () => {
      void (async () => {
        await refreshStatus({ force: true })
        // If the popup is still open, keep the banner. If they came back from a
        // closed tab (or a _blank tab we cannot watch), clear it.
        if (oauthSlug.current && !oauthPoll.current) clearOauthBanner()
      })()
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') onFocus()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      if (oauthTimer.current) clearTimeout(oauthTimer.current)
      if (oauthPoll.current) clearInterval(oauthPoll.current)
    }
  }, [refreshStatus, clearOauthBanner])

  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [q, type, category])

  // The app list customers see: the catalog minus apps the host cannot connect. A connected app always stays visible.
  const apps = useMemo(
    () => DATA.apps.filter((app) => !unavailable.has(app.slug.toLowerCase()) || Boolean(connected[app.slug])),
    [unavailable, connected],
  )

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const app of apps) {
      for (const c of app.categories || []) {
        if (c) set.add(c)
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [apps])

  // Search/type/category run over the full catalog. `connected` is only a dep when that filter is on,
  // so a status poll does not rebuild the All / type / category views.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return apps.filter((app) => {
      if (!matchesType(app, type)) return false
      if (type === 'connected' && !connected[app.slug]) return false
      if (category !== 'all' && !(app.categories || []).includes(category)) return false
      if (!needle) return true
      const hay = [app.name, app.slug, app.description, ...(app.categories || [])].join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }, [apps, q, type, category, type === 'connected' ? connected : null])

  const shown = useMemo(() => filtered.slice(0, visible), [filtered, visible])

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogApp[]>()
    for (const app of shown) {
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
  }, [shown])

  const oneClick = (DATA.counts.one_click || 0) + (DATA.counts.native || 0)
  const connectedCount = Object.keys(connected).length
  const hasMore = visible < filtered.length
  const connectedApps = useMemo(
    () => apps.filter((app) => Boolean(connected[app.slug])),
    [apps, connected],
  )


  const isNoAuth = useCallback(
    (app: CatalogApp) => app.connect === 'no_auth' || noAuth.has(app.slug),
    [noAuth],
  )

  const triggersBy = useMemo(() => {
    const map = new Map<string, TriggerItem[]>()
    for (const t of triggers) {
      const k = (t.toolkit || '').toLowerCase()
      map.set(k, [...(map.get(k) || []), t])
    }
    return map
  }, [triggers])

  const onToggleTrigger = useCallback(
    async (t: TriggerItem) => {
      setActionError(null)
      setBusyTrigger(triggerKey(t))
      try {
        await api('/api/agent-lab/connections/trigger-pause', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger_id: t.trigger_id, routine_id: t.routine_id, paused: t.status === 'active' }),
        })
        await refreshStatus({ force: true })
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not change the trigger')
      } finally {
        setBusyTrigger(null)
      }
    },
    [refreshStatus],
  )

  const onToggleAutoDo = useCallback(
    async (t: TriggerItem) => {
      setActionError(null)
      setBusyTrigger(triggerKey(t))
      try {
        await api('/api/agent-lab/connections/trigger-auto-do', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger_id: t.trigger_id, routine_id: t.routine_id, auto_do: !(t.auto_do || t.auto_calls) }),
        })
        await refreshStatus({ force: true })
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not change automatic actions')
      } finally {
        setBusyTrigger(null)
      }
    },
    [refreshStatus],
  )

  const onRetry = useCallback(
    async (id: number) => {
      setActionError(null)
      try {
        await api('/api/agent-lab/connections/trigger-retry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: id }),
        })
        await refreshStatus({ force: true })
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not retry the event')
      }
    },
    [refreshStatus],
  )

  const onConnect = useCallback(
    async (app: CatalogApp) => {
      setConnectHint(null)
      setActionError(null)
      clearOauthBanner()
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
        // Don't put noopener in the feature string: that makes the window reference null, so we
        // couldn't tell when the tab was closed, and a fallback would open a second tab.
        const popup = window.open(data.url, 'agentlab-connect', 'width=640,height=720')
        if (!popup) {
          window.open(data.url, '_blank', 'noopener,noreferrer')
        } else {
          try {
            popup.opener = null
          } catch {
            /* ignore */
          }
          oauthPoll.current = setInterval(() => {
            let closed = false
            try {
              closed = popup.closed
            } catch {
              closed = true
            }
            if (closed) {
              if (oauthPoll.current) {
                clearInterval(oauthPoll.current)
                oauthPoll.current = null
              }
              void refreshStatus({ force: true }).finally(() => clearOauthBanner())
            }
          }, 700)
        }
        oauthSlug.current = app.slug
        setOauthNote(
          `Finish signing in to ${app.name} in the new tab. This page will update when you come back. You'll see Composio on the sign-in screen — Composio is our secure connection partner.`,
        )
        oauthTimer.current = setTimeout(() => clearOauthBanner(), OAUTH_BANNER_MS)
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not start connect')
      } finally {
        setBusy(null)
      }
    },
    [clearOauthBanner, isNoAuth, refreshStatus],
  )

  // Chat sends https://transovo.ai/app/agent-lab/connections?connect=<app>: API-key apps open the key form right
  // away; sign-in apps need a click (browsers block pop-ups that a page opens by itself).
  const deepLinked = useRef(false)
  useEffect(() => {
    if (deepLinked.current || typeof window === 'undefined') return
    deepLinked.current = true
    const slug = (new URLSearchParams(window.location.search).get('connect') || '').trim().toLowerCase()
    if (!slug) return
    const app = apps.find((a) => a.slug === slug)
    if (!app) {
      setActionError(`No app called "${slug}" in the catalog. Search for it below.`)
      return
    }
    setQ(app.name)
    if (app.connect === 'api_key') void onConnect(app)
    else if (app.connect !== 'no_auth') setConnectHint(app)
  }, [apps, onConnect])

  const onDisconnect = useCallback(
    async (app: CatalogApp) => {
      if (!window.confirm(`Disconnect ${app.name}? The agent will not be able to use it until you connect again.`)) return
      setActionError(null)
      setBusy(app.slug)
      try {
        await api('/api/agent-lab/connections/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toolkit: app.slug }),
        })
        await refreshStatus({ force: true })
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not disconnect')
      } finally {
        setBusy(null)
      }
    },
    [refreshStatus],
  )

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
      await refreshStatus({ force: true })
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Could not connect')
    } finally {
      setModalSubmitting(false)
    }
  }

  const moreRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = moreRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible((n) => n + PAGE_SIZE)
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, shown.length])

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Connections securely handled by Composio. You&apos;ll see Composio on the sign-in screen.</p>
        <p>
          One-click apps open a secure sign-in tab. For API-key apps, Connect asks for the key on this page — it is
          sent to the agent host and never shown in the address bar. Apps that need no setup are marked Ready.
        </p>
        <p>
          {DATA.included.toLocaleString()} apps available
          ({oneClick.toLocaleString()} one-click, including {DATA.counts.native} built-in;{' '}
          {(DATA.counts.api_key || 0).toLocaleString()} API key or client credentials; {DATA.counts.no_auth || 0} no sign-in).{' '}
          {statusLoading ? ' Loading status…' : connectedCount ? ` ${connectedCount} connected.` : ''}
        </p>
      </div>

      {statusError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Could not load connection status: {statusError}{' '}
          <button type="button" className="underline" onClick={() => void refreshStatus({ force: true })}>
            Retry
          </button>
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}
      {connectHint ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          <p>Connect {connectHint.name}: click to open its secure sign-in.</p>
          <Button type="button" size="sm" onClick={() => void onConnect(connectHint)}>
            Connect {connectHint.name}
          </Button>
        </div>
      ) : null}
      {triggers.length || dead.length ? (
        <section className="flex flex-col gap-2 rounded-lg border px-3 py-3 text-sm" aria-label="App triggers">
          <h2 className="font-semibold">App triggers</h2>
          <p className="text-xs text-muted-foreground">
            {triggers.filter((t) => t.status === 'active').length} active,{' '}
            {triggers.filter((t) => t.status === 'paused').length} paused,{' '}
            {triggers.filter((t) => t.status === 'needs_reconnect').length} waiting for a reconnect. Each one is shown
            under its app with a pause switch (use the Connected filter).
          </p>
          {dead.length ? (
            <ul className="flex flex-col gap-1.5">
              {dead.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-3 rounded-md bg-destructive/5 px-2 py-1.5 text-xs">
                  <span>
                    <span className="font-medium">Not handled: {triggerLabel(d.slug || 'event')}</span>
                    {d.toolkit ? ` (${d.toolkit})` : ''} — {d.error || 'failed 3 times'}
                  </span>
                  <button type="button" className="shrink-0 underline" onClick={() => void onRetry(d.id)}>
                    Retry
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {oauthNote ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-foreground">
          <p>{oauthNote}</p>
          <button type="button" className="shrink-0 text-xs underline" onClick={clearOauthBanner}>
            Dismiss
          </button>
        </div>
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
          Showing {shown.length.toLocaleString()} of {filtered.length.toLocaleString()}
          {filtered.length !== DATA.included ? ` (filtered from ${DATA.included.toLocaleString()})` : ''} apps
        </p>
      </div>

      {type === 'all' && (statusLoading || connectedApps.length) ? (
        <section className="flex flex-col gap-3" aria-label="Connected apps">
          <h2 className="text-section-title font-semibold">Connected</h2>
          {statusLoading && !connectedApps.length ? (
            <p className="text-sm text-muted-foreground">Loading status…</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {connectedApps.map((app) => (
                <AppCard
                  key={`connected-${app.source}-${app.slug}`}
                  app={app}
                  ready={isNoAuth(app)}
                  on={Boolean(connected[app.slug]) && connected[app.slug]?.status !== 'EXPIRED'}
                  busy={busy === app.slug}
                  expired={connected[app.slug]?.status === 'EXPIRED'}
                  missing={connected[app.slug]?.missing || NO_MISSING}
                  triggers={triggersBy.get(app.slug) || NO_TRIGGERS}
                  busyTrigger={busyTrigger}
                  onConnect={onConnect}
                  onDisconnect={onDisconnect}
                  onToggleTrigger={onToggleTrigger}
                  onToggleAutoDo={onToggleAutoDo}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {filtered.length === 0 && !(type === 'all' && connectedApps.length) ? (
        <p className="text-sm text-muted-foreground">No apps match those filters.</p>
      ) : filtered.length === 0 ? null : (
        <div className="flex flex-col gap-8">
          {grouped.map((group) => (
            <section key={group.name} className="flex flex-col gap-3">
              <h2 className="text-section-title font-semibold capitalize">{group.name}</h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.apps.map((app) => (
                  <AppCard
                    key={`${app.source}-${app.slug}`}
                    app={app}
                    ready={isNoAuth(app)}
                    on={Boolean(connected[app.slug]) && connected[app.slug]?.status !== 'EXPIRED'}
                    busy={busy === app.slug}
                    expired={connected[app.slug]?.status === 'EXPIRED'}
                    missing={connected[app.slug]?.missing || NO_MISSING}
                    triggers={triggersBy.get(app.slug) || NO_TRIGGERS}
                    busyTrigger={busyTrigger}
                    onConnect={onConnect}
                    onDisconnect={onDisconnect}
                    onToggleTrigger={onToggleTrigger}
                  onToggleAutoDo={onToggleAutoDo}
                  />
                ))}
              </ul>
            </section>
          ))}
          {hasMore ? (
            <div ref={moreRef} className="flex justify-center">
              <Button type="button" variant="outline" onClick={() => setVisible((n) => n + PAGE_SIZE)}>
                Show more ({(filtered.length - visible).toLocaleString()} left)
              </Button>
            </div>
          ) : null}
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
