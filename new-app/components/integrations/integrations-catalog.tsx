'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge, type Tone } from '@/components/app/status'
import { INTEGRATION_CATALOG, type IntegrationCatalogItem } from '@/lib/integrations/catalog'
import { formatWhen } from '@/lib/format'

function isBookingLinkOnlyLaunch() {
  return false
}

type Status = 'connected' | 'available' | 'error' | 'loading'

const STATUS: Record<Status, { label: string; tone: Tone }> = {
  connected: { label: 'Connected', tone: 'success' },
  available: { label: 'Not connected', tone: 'muted' },
  error: { label: 'Needs reconnect', tone: 'danger' },
  loading: { label: 'Loading…', tone: 'muted' },
}

const ALL_CATEGORIES = ['Calendar', 'CRM', 'Payments'] as const
const CATEGORIES = isBookingLinkOnlyLaunch()
  ? ALL_CATEGORIES.filter((c) => c !== 'Calendar')
  : [...ALL_CATEGORIES]

type CalendarRow = {
  id: string
  name: string
  provider: string
  status: string
  config?: Record<string, unknown>
  updatedAt?: string | null
}

type ConnectionRow = {
  provider: string
  status: string
  lastSyncAt: string | null
  updatedAt: string | null
  config: Record<string, unknown>
}

type StatusPayload = {
  connections: ConnectionRow[]
  calendars: CalendarRow[]
  payments: {
    connections: Array<{ provider: string; status: string; canAcceptPayments?: boolean }>
  }
  crmEnv: Record<string, boolean>
  stripePlatformConfigured: boolean
}

function calendarStatus(rows: CalendarRow[], provider: 'google' | 'microsoft'): Status {
  const match = rows.find((r) => r.provider === provider)
  if (!match) return 'available'
  if (match.status === 'connected') return 'connected'
  if (match.status === 'needs_reauth' || match.status === 'error') return 'error'
  return 'available'
}

function crmStatus(connections: ConnectionRow[], provider: string): Status {
  const row = connections.find((c) => c.provider === provider)
  if (!row || row.status === 'disconnected') return 'available'
  if (row.status === 'connected') return 'connected'
  if (row.status === 'needs_reauth' || row.status === 'error') return 'error'
  return 'available'
}

function stripeStatus(payload: StatusPayload | null): Status {
  if (!payload?.stripePlatformConfigured) return 'available'
  const stripe = payload.payments.connections.find((c) => c.provider === 'STRIPE')
  if (!stripe) return 'available'
  if (stripe.status === 'connected' || stripe.canAcceptPayments) return 'connected'
  if (stripe.status === 'needs_attention' || stripe.status === 'onboarding_incomplete') return 'error'
  return 'available'
}

export function IntegrationsCatalog() {
  const searchParams = useSearchParams()
  const [payload, setPayload] = useState<StatusPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingDisconnect, setPendingDisconnect] = useState<IntegrationCatalogItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/integrations/status')
      if (!res.ok) throw new Error('Could not load integrations')
      const json = (await res.json()) as { data: StatusPayload }
      setPayload(json.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const connected = searchParams.get('connected')
    const err = searchParams.get('connected_error')
    const stripe = searchParams.get('stripe')
    if (connected) toast.success(`${connected} connected`)
    if (err) toast.error(err)
    if (stripe === 'return') toast.message('Stripe onboarding finished — refresh status if needed.')
  }, [searchParams])

  const statusFor = (item: IntegrationCatalogItem): Status => {
    if (loading || !payload) return loading ? 'loading' : 'available'
    if (item.calendarProvider) return calendarStatus(payload.calendars, item.calendarProvider)
    if (item.crmProvider) return crmStatus(payload.connections, item.connectionProvider || item.crmProvider)
    if (item.paymentProvider === 'stripe') return stripeStatus(payload)
    return 'available'
  }

  const connectCalendar = async (item: IntegrationCatalogItem) => {
    if (!item.calendarProvider) return
    setBusyId(item.id)
    try {
      const createRes = await fetch('/api/integrations/calendars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          provider: item.calendarProvider,
          config: { productContext: 'ai_receptionist' },
        }),
      })
      const createJson = (await createRes.json()) as { data?: CalendarRow; error?: string }
      if (!createRes.ok) throw new Error(createJson.error || 'Could not create calendar connection')
      const connectionId = createJson.data?.id
      if (!connectionId) throw new Error('Missing connection id')
      const returnTo = '/app/integrations?provider=calendar'
      const oauthPath =
        item.calendarProvider === 'google'
          ? `/api/integrations/calendars/oauth/google?connectionId=${encodeURIComponent(connectionId)}&returnTo=${encodeURIComponent(returnTo)}`
          : `/api/integrations/calendars/oauth/microsoft?connectionId=${encodeURIComponent(connectionId)}&returnTo=${encodeURIComponent(returnTo)}`
      window.location.href = oauthPath
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connect failed')
      setBusyId(null)
    }
  }

  const connectCrm = async (item: IntegrationCatalogItem) => {
    if (!item.crmProvider) return
    if (payload && !payload.crmEnv[item.crmProvider]) {
      toast.error(`${item.name} OAuth is not configured on this server.`)
      return
    }
    setBusyId(item.id)
    try {
      const res = await fetch('/api/crm/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: item.crmProvider }),
      })
      const json = (await res.json()) as { data?: { redirectUrl: string }; error?: string }
      if (!res.ok) throw new Error(json.error || 'Could not start CRM OAuth')
      if (!json.data?.redirectUrl) throw new Error('Missing authorize URL')
      window.location.href = json.data.redirectUrl
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connect failed')
      setBusyId(null)
    }
  }

  const connectStripe = async () => {
    setBusyId('stripe')
    try {
      const res = await fetch('/api/merchant-payments/stripe/connect', { method: 'POST' })
      const json = (await res.json()) as { data?: { url: string }; error?: string }
      if (!res.ok) throw new Error(json.error || 'Stripe connect failed')
      if (!json.data?.url) throw new Error('Missing Stripe onboarding URL')
      window.location.href = json.data.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connect failed')
      setBusyId(null)
    }
  }

  const disconnect = async (item: IntegrationCatalogItem) => {
    setBusyId(item.id)
    try {
      if (item.paymentProvider === 'stripe') {
        const res = await fetch('/api/merchant-payments/stripe/disconnect', { method: 'POST' })
        if (!res.ok) {
          const json = (await res.json()) as { error?: string }
          throw new Error(json.error || 'Disconnect failed')
        }
      } else if (item.connectionProvider) {
        const res = await fetch('/api/integrations/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: item.connectionProvider, action: 'disconnect' }),
        })
        if (!res.ok) {
          const json = (await res.json()) as { error?: string }
          throw new Error(json.error || 'Disconnect failed')
        }
      } else {
        toast.message('Disconnect this calendar from Settings → Calendars when available.')
        return
      }
      toast.success(`${item.name} disconnected`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Disconnect failed')
    } finally {
      setBusyId(null)
      setPendingDisconnect(null)
    }
  }

  const onConnect = (item: IntegrationCatalogItem) => {
    if (item.calendarProvider) return connectCalendar(item)
    if (item.crmProvider) return connectCrm(item)
    if (item.paymentProvider === 'stripe') return connectStripe()
  }

  const detailFor = (item: IntegrationCatalogItem): string => {
    if (!payload) return item.detail
    if (item.calendarProvider) {
      const row = payload.calendars.find((c) => c.provider === item.calendarProvider)
      if (row?.status === 'connected') {
        const email = (row.config?.email as string) || row.name
        return `${email} · connected`
      }
    }
    if (item.crmProvider) {
      const row = payload.connections.find((c) => c.provider === item.crmProvider)
      if (row?.status === 'connected') {
        const name = (row.config.connectedAccountName as string) || 'Connected account'
        return name
      }
      if (!payload.crmEnv[item.crmProvider]) return `${item.detail} (OAuth credentials not set on server)`
    }
    if (item.paymentProvider === 'stripe' && !payload.stripePlatformConfigured) {
      return 'Stripe platform keys are not configured on this server.'
    }
    return item.detail
  }

  const lastSyncFor = (item: IntegrationCatalogItem): string | null => {
    if (!payload?.connections || !item.connectionProvider) return null
    const row = payload.connections.find((c) => c.provider === item.connectionProvider)
    return row?.lastSyncAt || row?.updatedAt || null
  }

  return (
    <div className="flex flex-col gap-8">
      {CATEGORIES.map((cat) => {
        const items = INTEGRATION_CATALOG.filter((i) => i.category === cat)
        if (!items.length) return null
        return (
          <section key={cat} aria-labelledby={`cat-${cat}`} className="flex flex-col gap-3">
            <h2 id={`cat-${cat}`} className="text-sm font-semibold text-muted-foreground">
              {cat}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => {
                const s = statusFor(item)
                const busy = busyId === item.id
                const lastSync = lastSyncFor(item)
                return (
                  <article key={item.id} className="flex flex-col gap-4 rounded-xl surface p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex size-10 items-center justify-center rounded-xl bg-linear-to-b from-card to-muted text-sm font-semibold tracking-tight text-foreground/80 shadow-xs ring-1 ring-foreground/8 ring-inset"
                          aria-hidden
                        >
                          {item.name.slice(0, 2)}
                        </span>
                        <h3 className="font-medium">{item.name}</h3>
                      </div>
                      <StatusBadge tone={STATUS[s].tone}>{STATUS[s].label}</StatusBadge>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{detailFor(item)}</p>
                    <dl className="flex flex-col gap-1 text-xs">
                      <div className="flex gap-1">
                        <dt className="text-muted-foreground">Powers:</dt>
                        <dd>{item.impacts.join(', ')}</dd>
                      </div>
                      {lastSync && s !== 'available' && (
                        <div className="flex gap-1">
                          <dt className="text-muted-foreground">Last sync:</dt>
                          <dd>{formatWhen(lastSync)}</dd>
                        </div>
                      )}
                    </dl>
                    <div className="mt-auto flex gap-2">
                      {(s === 'available' || s === 'error') && (
                        <Button className="flex-1" disabled={busy} onClick={() => onConnect(item)}>
                          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                          {s === 'error' ? 'Reconnect' : 'Connect'}
                        </Button>
                      )}
                      {s === 'connected' && (
                        <>
                          <Button variant="outline" className="flex-1" onClick={() => onConnect(item)} disabled={busy}>
                            Reconnect
                          </Button>
                          <Button variant="outline" onClick={() => setPendingDisconnect(item)} disabled={busy}>
                            Disconnect
                          </Button>
                        </>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}

      <Dialog open={!!pendingDisconnect} onOpenChange={(o) => !o && setPendingDisconnect(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {pendingDisconnect?.name}?</DialogTitle>
            <DialogDescription>Stored credentials are revoked immediately. You can reconnect later.</DialogDescription>
          </DialogHeader>
          {pendingDisconnect && (
            <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
              <p className="leading-relaxed">
                This will stop: <strong>{pendingDisconnect.impacts.join(', ')}</strong>.
                {pendingDisconnect.category === 'Calendar' &&
                  ' The AI Receptionist will no longer book appointments and will take messages instead.'}
              </p>
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={!!busyId}
              onClick={() => pendingDisconnect && disconnect(pendingDisconnect)}
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
