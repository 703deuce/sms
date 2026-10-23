'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/app/page-primitives'
import {
  PD_API_SCOPES_CLIENT,
  POWER_DIALER_WEBHOOK_EVENTS_CLIENT,
} from '@/lib/products/power-dialer-public-api'

type ApiKeyRow = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  rateLimitPerMinute: number
  lastUsedAt: string | null
}

type WebhookEndpoint = {
  id: string
  name: string
  url: string
  events: string[]
  active: boolean
}

type Delivery = {
  id: string
  eventType: string
  status: string
  attempt: number
  httpStatus: number | null
  errorMessage: string | null
  createdAt: string
  endpoint: { name: string; url: string }
}

export function PowerDialerDeveloperSettingsPanel() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [keyName, setKeyName] = useState('Production API')
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [hookName, setHookName] = useState('Outbound events')
  const [hookUrl, setHookUrl] = useState('')
  const [hookSecret, setHookSecret] = useState<string | null>(null)
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['disposition.saved', 'call.ended'])

  const load = useCallback(() => {
    void fetch('/api/phone/power-dialer/developer/api-keys')
      .then((r) => r.json())
      .then((j) => setKeys(j.data || []))
    void fetch('/api/phone/power-dialer/developer/webhooks')
      .then((r) => r.json())
      .then((j) => {
        setEndpoints(j.data?.endpoints || [])
        setDeliveries(j.data?.deliveries || [])
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const createKey = async () => {
    const res = await fetch('/api/phone/power-dialer/developer/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: keyName,
        scopes: ['contacts:read', 'contacts:write', 'lists:read', 'lists:write', 'dial:write'],
      }),
    })
    const j = await res.json()
    if (!res.ok) {
      toast.error(j.error || 'Could not create key')
      return
    }
    setNewSecret(j.data?.secret || null)
    toast.success('API key created — copy the secret now')
    load()
  }

  const createWebhook = async () => {
    if (!hookUrl.trim()) {
      toast.error('Webhook URL required')
      return
    }
    const res = await fetch('/api/phone/power-dialer/developer/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: hookName, url: hookUrl, events: selectedEvents }),
    })
    const j = await res.json()
    if (!res.ok) {
      toast.error(j.error || 'Could not create webhook')
      return
    }
    setHookSecret(j.data?.signingSecret || null)
    toast.success('Webhook endpoint created')
    load()
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Public API keys (M82)">
        <p className="mb-3 text-sm text-muted-foreground">
          Scoped keys for REST v1 and Zapier. Secrets are shown once at creation or rotation. OpenAPI:{' '}
          <code className="text-xs">docs/openapi/power-dialer-v1.yaml</code>
        </p>
        <label className="flex max-w-md flex-col gap-1 text-sm">
          <span className="font-medium">Key label</span>
          <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} aria-label="API key name" />
        </label>
        <Button type="button" size="sm" className="mt-2" onClick={() => void createKey()}>Create API key</Button>
        {newSecret && (
          <p className="mt-2 rounded-md border bg-muted/40 p-2 font-mono text-xs break-all" role="status">
            New secret (copy now): {newSecret}
          </p>
        )}
        <ul className="mt-4 space-y-2 text-sm">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
              <span>
                <span className="font-medium">{k.name}</span> · {k.prefix}… · {k.scopes.join(', ')}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void fetch('/api/phone/power-dialer/developer/api-keys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'revoke', id: k.id }),
                  }).then(() => load())
                }}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Available scopes: {PD_API_SCOPES_CLIENT.join(', ')}</p>
      </Panel>

      <Panel title="Outbound webhooks (M81)">
        <div className="grid max-w-lg gap-2 text-sm">
          <Input value={hookName} onChange={(e) => setHookName(e.target.value)} placeholder="Endpoint name" aria-label="Webhook name" />
          <Input value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} placeholder="https://…" aria-label="Webhook URL" />
          <div className="flex flex-wrap gap-2">
            {POWER_DIALER_WEBHOOK_EVENTS_CLIENT.map((ev) => (
              <label key={ev} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(ev)}
                  onChange={(e) => {
                    setSelectedEvents((prev) =>
                      e.target.checked ? [...prev, ev] : prev.filter((x) => x !== ev),
                    )
                  }}
                />
                {ev}
              </label>
            ))}
          </div>
        </div>
        <Button type="button" size="sm" className="mt-2" onClick={() => void createWebhook()}>Add endpoint</Button>
        {hookSecret && (
          <p className="mt-2 rounded-md border bg-muted/40 p-2 font-mono text-xs break-all">
            Signing secret: {hookSecret}
          </p>
        )}
        <ul className="mt-4 space-y-2 text-sm">
          {endpoints.map((ep) => (
            <li key={ep.id} className="border-b pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{ep.name}</span>
                <span className="text-xs text-muted-foreground">{ep.active ? 'Active' : 'Disabled'}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{ep.url}</p>
              <div className="mt-1 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void fetch('/api/phone/power-dialer/developer/webhooks', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'test', id: ep.id }),
                    }).then((r) => r.json().then((j) => toast.message(j.delivered ? 'Test sent' : 'Test failed')))
                  }}
                >
                  Test send
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void fetch('/api/phone/power-dialer/developer/webhooks', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'toggle', id: ep.id, active: !ep.active }),
                    }).then(() => load())
                  }}
                >
                  {ep.active ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Delivery log">
        {deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deliveries yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th scope="col" className="py-1">Event</th>
                <th scope="col" className="py-1">Status</th>
                <th scope="col" className="py-1">HTTP</th>
                <th scope="col" className="py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="py-1">{d.eventType}</td>
                  <td className="py-1">{d.status}</td>
                  <td className="py-1">{d.httpStatus ?? '—'}</td>
                  <td className="py-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void fetch('/api/phone/power-dialer/developer/webhooks', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'replay', deliveryId: d.id }),
                        }).then(() => {
                          toast.success('Replay queued')
                          load()
                        })
                      }}
                    >
                      Replay
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )

}
