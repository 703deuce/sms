'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Pencil, Plus, Route, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SimpleSelect } from '@/components/app/filters'
import { Panel } from '@/components/app/page-primitives'
import { useAgent } from '@/components/providers/agent-provider'
import type { AgentConfig, ConversationalRoute } from '@/lib/agent'
import { fetchCallForwarding, type ForwardingConfigDto, type ForwardingDestinationDto } from '@/lib/phone-forwarding-api'
import { formatPhone } from '@/lib/format'
import { Section } from './ai-ui'

function newRouteId() {
  return `cr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

type DestinationPick = {
  kind: 'forwarding_destination'
  id: string
  label: string
  phoneE164: string
}

/** Individual Phone forwarding destinations only — ring groups require LiveKit↔Phone bridge (not v1). */
function buildDestinationOptions(config: ForwardingConfigDto | null): DestinationPick[] {
  if (!config) return []
  const out: DestinationPick[] = []
  for (const d of config.destinations.filter((x) => x.enabled)) {
    out.push({
      kind: 'forwarding_destination',
      id: d.id,
      label: d.name,
      phoneE164: d.phoneE164,
    })
  }
  return out
}

function destinationLabel(route: ConversationalRoute, options: DestinationPick[]): string {
  const hit = options.find((o) => o.id === route.destinationRef && o.kind === route.destinationKind)
  if (hit) return hit.label
  return route.destinationLabel || route.destinationRef || '—'
}

export function ConversationalRoutingEditor() {
  const { draft, update } = useAgent()
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<ForwardingConfigDto | null>(null)
  const [editRoute, setEditRoute] = useState<ConversationalRoute | null>(null)

  const destinationOptions = useMemo(() => buildDestinationOptions(config), [config])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCallForwarding()
      setConfig(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const routing = draft.conversationalRouting
  const routes = draft.conversationalRoutes ?? []

  const setRoutes = (next: ConversationalRoute[]) => {
    update('conversationalRoutes', next)
  }

  const openNew = () => {
    setEditRoute({
      id: newRouteId(),
      name: '',
      intentDescription: '',
      examples: [],
      destinationRef: '',
      destinationKind: 'forwarding_destination',
      enabled: true,
      confirmBeforeTransfer: false,
    })
  }

  const saveRoute = (route: ConversationalRoute) => {
    const idx = routes.findIndex((r) => r.id === route.id)
    const next = idx >= 0 ? routes.map((r) => (r.id === route.id ? route : r)) : [...routes, route]
    setRoutes(next)
    setEditRoute(null)
  }

  const removeRoute = (id: string) => {
    setRoutes(routes.filter((r) => r.id !== id))
  }

  const defaultOptions = destinationOptions.map((o) => ({
    value: `${o.kind}:${o.id}`,
    label: o.label,
  }))

  const pickDefault = (value: string) => {
    const [kind, id] = value.split(':')
    update('conversationalRouting', (r) => ({ ...r, defaultDestinationRef: id }))
  }

  const defaultValue = routing.defaultDestinationRef
    ? destinationOptions.find((o) => o.id === routing.defaultDestinationRef)
    : null

  return (
    <div className="flex flex-col gap-6">
      <Section
        id="default-handling"
        icon={Route}
        title="Default handling"
        description="Individual Phone forwarding destinations only. Ring groups are not supported as IVR transfer targets until multi-leg routing is certified."
      >
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading Phone destinations…
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="default-dest">Default destination</Label>
              <SimpleSelect
                id="default-dest"
                value={
                  defaultValue ? `${defaultValue.kind}:${defaultValue.id}` : ''
                }
                onChange={pickDefault}
                options={[{ value: '', label: 'Select destination…' }, ...defaultOptions]}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>When no route matches</Label>
                <SimpleSelect
                  value={routing.whenNoRuleMatches}
                  onChange={(v) =>
                    update('conversationalRouting', (r) => ({ ...r, whenNoRuleMatches: v }))
                  }
                  options={[
                    { value: 'message', label: 'Take a message' },
                    { value: 'default', label: 'Use default destination' },
                    { value: 'end', label: 'End call politely' },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>When transfer fails</Label>
                <SimpleSelect
                  value={routing.whenTransferFails}
                  onChange={(v) =>
                    update('conversationalRouting', (r) => ({ ...r, whenTransferFails: v }))
                  }
                  options={[
                    { value: 'message', label: 'Take a message' },
                    { value: 'default', label: 'Return to conversational menu' },
                    { value: 'end', label: 'End call politely' },
                  ]}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Business hours and forwarding rules live in{' '}
              <Link href="/app/phone/call-handling" className="font-medium text-primary hover:underline">
                Phone → Call Handling
              </Link>
              .
            </p>
          </div>
        )}
      </Section>

      <Panel
        title="Conversation routing rules"
        description="Describe when each route should be used in plain language. The agent interprets intent — not exact keywords."
        actions={
          <Button size="sm" onClick={openNew} disabled={loading}>
            <Plus data-icon="inline-start" />
            Add route
          </Button>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">Route</th>
                <th scope="col" className="px-4 py-3 font-medium">Caller intent</th>
                <th scope="col" className="px-4 py-3 font-medium">Destination</th>
                <th scope="col" className="px-4 py-3 font-medium">On</th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {routes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No routes yet. Add a route when callers should reach different departments or numbers.
                  </td>
                </tr>
              )}
              {routes.map((route) => (
                <tr key={route.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{route.name || 'Untitled'}</td>
                  <td className="max-w-xs px-4 py-3 text-muted-foreground">
                    <span className="line-clamp-2">{route.intentDescription || '—'}</span>
                  </td>
                  <td className="px-4 py-3">{destinationLabel(route, destinationOptions)}</td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={route.enabled}
                      onCheckedChange={(on) =>
                        setRoutes(routes.map((r) => (r.id === route.id ? { ...r, enabled: on } : r)))
                      }
                      aria-label={`Enable route ${route.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditRoute(route)} aria-label="Edit route">
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeRoute(route.id)}
                        aria-label="Remove route"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <RouteDrawer
        open={Boolean(editRoute)}
        route={editRoute}
        destinations={destinationOptions}
        onClose={() => setEditRoute(null)}
        onSave={saveRoute}
      />
    </div>
  )
}

function RouteDrawer({
  open,
  route,
  destinations,
  onClose,
  onSave,
}: {
  open: boolean
  route: ConversationalRoute | null
  destinations: DestinationPick[]
  onClose: () => void
  onSave: (r: ConversationalRoute) => void
}) {
  const [local, setLocal] = useState<ConversationalRoute | null>(route)

  useEffect(() => {
    setLocal(route)
  }, [route])

  if (!local) return null

  const destKey = local.destinationRef
    ? `${local.destinationKind}:${local.destinationRef}`
    : ''

  const applyDestination = (value: string) => {
    const [kind, id] = value.split(':') as [ConversationalRoute['destinationKind'], string]
    const pick = destinations.find((d) => d.kind === kind && d.id === id)
    setLocal({
      ...local,
      destinationKind: kind,
      destinationRef: id,
      destinationPhoneE164: pick?.phoneE164,
      destinationLabel: pick?.label,
    })
  }

  const examplesText = (local.examples ?? []).join('\n')

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{local.name ? 'Edit route' : 'Add route'}</SheetTitle>
          <SheetDescription>
            Semantic guidance for the agent. Callers do not need to use exact words.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="route-name">Route name</Label>
            <Input
              id="route-name"
              value={local.name}
              onChange={(e) => setLocal({ ...local, name: e.target.value })}
              placeholder="Service Department"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="route-intent">When to use this route</Label>
            <Textarea
              id="route-intent"
              rows={4}
              value={local.intentDescription}
              onChange={(e) => setLocal({ ...local, intentDescription: e.target.value })}
              placeholder="Callers who need an existing job checked, want repairs, or need a technician."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="route-examples">Example phrases (optional)</Label>
            <Textarea
              id="route-examples"
              rows={4}
              value={examplesText}
              onChange={(e) =>
                setLocal({
                  ...local,
                  examples: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder={'I need someone to fix my water heater.\nMy technician has not arrived.'}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="route-dest">Destination</Label>
            <SimpleSelect
              id="route-dest"
              value={destKey}
              onChange={applyDestination}
              options={[
                { value: '', label: 'Select Phone destination…' },
                ...destinations.map((d) => ({
                  value: `${d.kind}:${d.id}`,
                  label: `${d.label} · ${formatPhone(d.phoneE164)}`,
                })),
              ]}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Confirm before transferring</p>
              <p className="text-xs text-muted-foreground">Ask the caller briefly before connecting.</p>
            </div>
            <Switch
              checked={local.confirmBeforeTransfer}
              onCheckedChange={(on) => setLocal({ ...local, confirmBeforeTransfer: on })}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Route enabled</p>
            </div>
            <Switch checked={local.enabled} onCheckedChange={(on) => setLocal({ ...local, enabled: on })} />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              if (!local.name.trim() || !local.destinationPhoneE164?.trim()) return
              onSave(local)
            }}
            disabled={!local.name.trim() || !local.destinationPhoneE164?.trim()}
          >
            Save route
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
