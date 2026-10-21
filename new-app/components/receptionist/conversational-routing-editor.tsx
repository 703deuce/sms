'use client'

import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SimpleSelect } from '@/components/app/filters'
import { Panel } from '@/components/app/page-primitives'
import { useAgent } from '@/components/providers/agent-provider'
import type { ConversationalRoute } from '@/lib/agent'
import { formatPhone } from '@/lib/format'
import {
  CONVERSATIONAL_ROUTE_EXAMPLE,
  tryNormalizePhoneInput,
} from '@/lib/receptionist/conversational-route-helpers'
import {
  createForwardingDestination,
  patchForwardingDestination,
} from '@/lib/phone-forwarding-api'

function newRouteId() {
  return `cr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function emptyRoute(): ConversationalRoute {
  return {
    id: newRouteId(),
    name: '',
    description: '',
    intentDescription: '',
    examples: [],
    destinationRef: '',
    destinationKind: 'forwarding_destination',
    enabled: true,
    confirmBeforeTransfer: false,
  }
}

async function syncPhoneDestination(route: ConversationalRoute): Promise<ConversationalRoute> {
  const phone = route.destinationPhoneE164?.trim()
  if (!phone) throw new Error('Phone number is required.')

  const body = {
    name: route.name.trim() || 'Transfer destination',
    destinationKind: 'external_phone',
    phoneE164: phone,
    enabled: true,
  }

  if (
    route.destinationRef &&
    route.destinationKind === 'forwarding_destination'
  ) {
    await patchForwardingDestination(route.destinationRef, body)
    return {
      ...route,
      destinationLabel: route.name.trim(),
      destinationPhoneE164: phone,
    }
  }

  const created = await createForwardingDestination(body)
  return {
    ...route,
    destinationRef: created.id,
    destinationKind: 'forwarding_destination',
    destinationLabel: created.name,
    destinationPhoneE164: created.phoneE164,
  }
}

export function ConversationalRoutingEditor() {
  const { draft, update } = useAgent()
  const routes = draft.conversationalRoutes ?? []
  const routing = draft.conversationalRouting
  const [editRoute, setEditRoute] = useState<ConversationalRoute | null>(null)
  const [saving, setSaving] = useState(false)

  const setRoutes = (next: ConversationalRoute[]) => {
    update('conversationalRoutes', next)
    if (next.length > 0 && !draft.capabilities.transfer) {
      update('capabilities', (c) => ({ ...c, transfer: true }))
    }
  }

  const removeRoute = (id: string) => {
    setRoutes(routes.filter((r) => r.id !== id))
  }

  const persistRoute = async (route: ConversationalRoute) => {
    setSaving(true)
    try {
      const synced = await syncPhoneDestination(route)
      const idx = routes.findIndex((r) => r.id === synced.id)
      const next =
        idx >= 0 ? routes.map((r) => (r.id === synced.id ? synced : r)) : [...routes, synced]
      setRoutes(next)
      setEditRoute(null)
      toast.success('Transfer destination saved to draft')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save phone destination')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="Transfer destinations"
        description="Configure who your conversational menu can connect callers to. Each destination is one place: name, number, who they are, and when the AI should transfer."
        actions={
          <Button size="sm" onClick={() => setEditRoute(emptyRoute())}>
            <Plus data-icon="inline-start" />
            Add transfer destination
          </Button>
        }
        bodyClassName="p-0"
      >
        {routes.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            <p>No transfer destinations yet.</p>
            <p className="mt-2">
              Add Sales, Billing, Service, or individual staff numbers. The AI uses your descriptions to choose the
              right route — callers do not need exact keywords.
            </p>
            <Button className="mt-4" variant="outline" size="sm" onClick={() => setEditRoute(emptyRoute())}>
              <Plus data-icon="inline-start" />
              Add transfer destination
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {routes.map((route) => (
              <li key={route.id} className="flex flex-col gap-3 px-4 py-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{route.name || 'Untitled'}</h3>
                    {!route.enabled && (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">Disabled</span>
                    )}
                  </div>
                  {route.description?.trim() ? (
                    <p className="text-sm text-muted-foreground">{route.description}</p>
                  ) : null}
                  {route.destinationPhoneE164 ? (
                    <p className="text-sm font-medium tabular-nums">{formatPhone(route.destinationPhoneE164)}</p>
                  ) : (
                    <p className="text-sm text-destructive">Phone number missing — edit to fix.</p>
                  )}
                  <div className="rounded-lg border bg-muted/30 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">When to transfer</p>
                    <p className="mt-1 text-sm">{route.intentDescription || '—'}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={route.enabled}
                    onCheckedChange={(on) =>
                      setRoutes(routes.map((r) => (r.id === route.id ? { ...r, enabled: on } : r)))
                    }
                    aria-label={`Enable ${route.name || 'destination'}`}
                  />
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditRoute(route)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeRoute(route.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Fallback behavior"
        description="What happens when no destination matches or a transfer does not connect. Publish from the bar above to apply routing changes to live calls."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="when-no-match">When no destination matches</Label>
            <SimpleSelect
              id="when-no-match"
              value={routing.whenNoRuleMatches}
              onChange={(v) => update('conversationalRouting', (r) => ({ ...r, whenNoRuleMatches: v }))}
              options={[
                { value: 'message', label: 'Take a message' },
                { value: 'default', label: 'Try default destination (if configured)' },
                { value: 'end', label: 'End call politely' },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="when-transfer-fails">When transfer fails</Label>
            <SimpleSelect
              id="when-transfer-fails"
              value={routing.whenTransferFails}
              onChange={(v) => update('conversationalRouting', (r) => ({ ...r, whenTransferFails: v }))}
              options={[
                { value: 'message', label: 'Take a message' },
                { value: 'default', label: 'Return to conversational menu' },
                { value: 'end', label: 'End call politely' },
              ]}
            />
          </div>
        </div>
      </Panel>

      <DestinationDrawer
        open={Boolean(editRoute)}
        route={editRoute}
        saving={saving}
        onClose={() => !saving && setEditRoute(null)}
        onSave={(route) => void persistRoute(route)}
      />
    </div>
  )
}

function DestinationDrawer({
  open,
  route,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  route: ConversationalRoute | null
  saving: boolean
  onClose: () => void
  onSave: (r: ConversationalRoute) => void
}) {
  const [local, setLocal] = useState<ConversationalRoute | null>(route)
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)

  useEffect(() => {
    setLocal(route)
    setPhoneInput(route?.destinationPhoneE164 ? formatPhone(route.destinationPhoneE164) : '')
    setPhoneError(null)
  }, [route])

  if (!local) return null

  const applyExample = () => {
    setLocal({
      ...local,
      name: CONVERSATIONAL_ROUTE_EXAMPLE.name,
      description: CONVERSATIONAL_ROUTE_EXAMPLE.description,
      intentDescription: CONVERSATIONAL_ROUTE_EXAMPLE.intentDescription,
      destinationPhoneE164: CONVERSATIONAL_ROUTE_EXAMPLE.destinationPhoneE164,
    })
    setPhoneInput(formatPhone(CONVERSATIONAL_ROUTE_EXAMPLE.destinationPhoneE164))
    setPhoneError(null)
    toast.message('Example filled — illustrative only until you save')
  }

  const commitPhone = (): string | null => {
    const normalized = tryNormalizePhoneInput(phoneInput)
    if (!normalized.ok) {
      setPhoneError(normalized.message)
      return null
    }
    setPhoneError(null)
    setLocal({ ...local, destinationPhoneE164: normalized.e164 })
    return normalized.e164
  }

  const canSave =
    local.name.trim().length > 0 &&
    local.description.trim().length > 0 &&
    local.intentDescription.trim().length > 0 &&
    (local.destinationPhoneE164?.trim() || tryNormalizePhoneInput(phoneInput).ok)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[540px]">
        <SheetHeader>
          <SheetTitle>{routesHasName(local) ? 'Edit transfer destination' : 'Add transfer destination'}</SheetTitle>
          <SheetDescription>
            Use everyday language. The AI interprets caller intent — exact keywords are not required.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dest-name">Destination name</Label>
            <Input
              id="dest-name"
              value={local.name}
              onChange={(e) => setLocal({ ...local, name: e.target.value })}
              placeholder="Sales Department"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dest-phone">Transfer phone number</Label>
            <Input
              id="dest-phone"
              type="tel"
              inputMode="tel"
              value={phoneInput}
              onChange={(e) => {
                setPhoneInput(e.target.value)
                setPhoneError(null)
              }}
              onBlur={() => {
                const e164 = commitPhone()
                if (e164) setPhoneInput(formatPhone(e164))
              }}
              placeholder="(571) 555-0134"
              aria-invalid={phoneError ? true : undefined}
              aria-describedby={phoneError ? 'dest-phone-error' : undefined}
            />
            {phoneError ? (
              <p id="dest-phone-error" className="text-sm text-destructive" role="alert">
                {phoneError}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Cell or landline that should ring when this route is selected.</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dest-description">Description</Label>
            <Textarea
              id="dest-description"
              rows={3}
              value={local.description}
              onChange={(e) => setLocal({ ...local, description: e.target.value })}
              placeholder="Who this person or department is and what they handle."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dest-when">When should the AI transfer here?</Label>
            <Textarea
              id="dest-when"
              rows={4}
              value={local.intentDescription}
              onChange={(e) => setLocal({ ...local, intentDescription: e.target.value })}
              placeholder="When someone wants a quote, asks about pricing, or asks to speak with Sales."
            />
          </div>
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={applyExample}>
            Copy example configuration
          </Button>
          <p className="text-xs text-muted-foreground">Example only — does not save until you click Save destination.</p>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Destination enabled</p>
              <p className="text-xs text-muted-foreground">Disabled destinations are ignored on live calls after publish.</p>
            </div>
            <Switch
              checked={local.enabled}
              onCheckedChange={(on) => setLocal({ ...local, enabled: on })}
              aria-label="Destination enabled"
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={!canSave || saving}
            onClick={() => {
              const e164 = commitPhone()
              if (!e164) return
              onSave({ ...local, destinationPhoneE164: e164 })
            }}
          >
            {saving ? 'Saving…' : 'Save destination'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function routesHasName(route: ConversationalRoute): boolean {
  return Boolean(route.name?.trim())
}
