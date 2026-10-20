'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PhoneForwarded, Plus, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  ForwardingDestinationSelector,
  type ForwardingDestinationSelectorValue,
} from '@/components/phone/forwarding-destination-selector'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import {
  fetchCallForwarding,
  fetchForwardingEntitlements,
  saveAnsweringPolicy,
  createForwardingDestination,
  deleteForwardingDestination,
  patchForwardingDestination,
  testForwardingDestination,
  type ForwardingConfigDto,
  type ForwardingEntitlementsDto,
} from '@/lib/phone-forwarding-api'
import { ForwardingRingGroups } from '@/components/phone/forwarding-ring-groups'
import { AfterHoursForwardPanel } from '@/components/phone/after-hours-forward-panel'

export function CallForwardingWorkspace() {
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<ForwardingConfigDto | null>(null)
  const [phoneNumberId, setPhoneNumberId] = useState<string>('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [destDraft, setDestDraft] = useState<ForwardingDestinationSelectorValue>({
    mode: 'external_phone',
    label: '',
    phoneE164: '',
  })
  const [entitlements, setEntitlements] = useState<ForwardingEntitlementsDto | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    void Promise.all([
      fetchCallForwarding(phoneNumberId || undefined),
      fetchForwardingEntitlements(),
    ])
      .then(([data, ent]) => {
        setConfig(data)
        setEntitlements(ent)
        if (!phoneNumberId && data.numbers[0]?.id) setPhoneNumberId(data.numbers[0].id)
      })
      .catch(() => toast.error('Could not load call forwarding'))
      .finally(() => setLoading(false))
  }, [phoneNumberId])

  useEffect(() => {
    reload()
  }, [reload])

  const policy = useMemo(() => {
    if (!config) return null
    return config.policy ?? config.policies.find((p) => p.phoneNumberId === phoneNumberId) ?? null
  }, [config, phoneNumberId])

  const selectedNumber = config?.numbers.find((n) => n.id === phoneNumberId)

  const togglePaused = () => {
    if (!phoneNumberId) return
    void saveAnsweringPolicy(phoneNumberId, { paused: !policy?.paused })
      .then(() => {
        toast.success(policy?.paused ? 'Forwarding resumed' : 'Forwarding paused')
        reload()
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not update'))
  }

  const addDestination = () => {
    const name = destDraft.label.trim() || 'Forward'
    if (destDraft.mode === 'external_phone' && !destDraft.phoneE164.trim()) {
      toast.error('Enter a phone number')
      return
    }
    if (destDraft.mode === 'workspace_number' && !destDraft.workspacePhoneNumberId) {
      toast.error('Choose a Transovo number')
      return
    }
    void createForwardingDestination({
      name,
      destinationKind: destDraft.mode,
      ...(destDraft.mode === 'external_phone'
        ? { phoneE164: destDraft.phoneE164.trim() }
        : { workspacePhoneNumberId: destDraft.workspacePhoneNumberId }),
      press1Required: true,
      hostedE164: selectedNumber?.e164,
      hostedPhoneNumberId: phoneNumberId || undefined,
    })
      .then(async (row) => {
        toast.success('Destination added')
        setDrawerOpen(false)
        setDestDraft({ mode: 'external_phone', label: '', phoneE164: '' })
        if (phoneNumberId && !policy?.primaryDestinationId) {
          await saveAnsweringPolicy(phoneNumberId, {
            answeringMode: 'forward',
            primaryDestinationId: row.id,
          })
        }
        reload()
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not add destination'))
  }

  if (loading && !config) {
    return <p className="text-sm text-muted-foreground">Loading call forwarding…</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Call Forwarding"
        description="Control where incoming calls ring and what happens when no one answers."
        eyebrow={
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <PhoneForwarded className="size-4" aria-hidden />
            Phone
          </span>
        }
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => reload()}>
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
            <Button type="button" size="sm" onClick={() => setDrawerOpen(true)}>
              <Plus className="size-4" />
              Add forwarding destination
            </Button>
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link href="/app/phone/forwarding/setup">Set up business line</Link>
            </Button>
          </>
        }
      />

      {config && config.numbers.length > 1 && (
        <div className="max-w-md">
          <Label htmlFor="cf-number">Business number</Label>
          <Select value={phoneNumberId} onValueChange={setPhoneNumberId}>
            <SelectTrigger id="cf-number" className="mt-2">
              <SelectValue placeholder="Select number" />
            </SelectTrigger>
            <SelectContent>
              {config.numbers.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.friendlyName ? `${n.friendlyName} · ` : ''}
                  {n.e164}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedNumber && (
        <p className="text-sm text-muted-foreground">
          Active line: <span className="font-mono text-foreground">{selectedNumber.e164}</span>
        </p>
      )}

      {entitlements?.destinations.atLimit && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          You have reached the {entitlements.planLabel} limit of {entitlements.destinations.max} forwarding
          destinations. Remove a destination or upgrade your plan to add more.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <Panel title="Incoming calls" description="Status for the selected business number.">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={policy?.paused ? 'secondary' : 'default'}>
                {policy?.paused ? 'Paused' : policy ? 'Active' : 'Needs setup'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Mode: {policy?.answeringMode?.replace(/_/g, ' ') ?? 'browser (default)'}
              </span>
              {phoneNumberId && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!policy?.paused}
                    onCheckedChange={togglePaused}
                    aria-label="Pause call forwarding"
                  />
                  <span className="text-sm">Forwarding enabled</span>
                </div>
              )}
            </div>
            {phoneNumberId && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void saveAnsweringPolicy(phoneNumberId, { answeringMode: 'forward' })
                      .then(() => {
                        toast.success('Direct forwarding enabled')
                        reload()
                      })
                      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
                  }
                >
                  Forward to phone
                </Button>
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href="/app/phone/auto-attendant">Use auto attendant</Link>
                </Button>
              </div>
            )}
          </Panel>

          <Panel
            title="Forwarding destinations"
            description="External numbers that can receive forwarded business calls."
          >
            {config?.destinations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No destinations yet. Add a cellphone or landline to forward calls.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Press 1</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {config?.destinations.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm">
                        <span className="font-mono">{d.displayNumber || d.phoneE164}</span>
                        {d.destinationKind === 'workspace_number' && (
                          <span className="ml-2 text-xs text-muted-foreground">Transovo number</span>
                        )}
                      </TableCell>
                      <TableCell>{d.press1Required ? 'On' : 'Off'}</TableCell>
                      <TableCell>{d.enabled ? 'Enabled' : 'Disabled'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void testForwardingDestination(d.id, true).then(() => {
                              toast.success('Marked as tested')
                              reload()
                            })
                          }
                        >
                          Test
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void patchForwardingDestination(d.id, { enabled: !d.enabled }).then(
                              () => reload(),
                            )
                          }
                        >
                          {d.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void deleteForwardingDestination(d.id)
                              .then(() => {
                                toast.success('Removed')
                                reload()
                              })
                              .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
                          }
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>

          {config && phoneNumberId && (
            <ForwardingRingGroups config={config} phoneNumberId={phoneNumberId} onSaved={reload} />
          )}

          {phoneNumberId && config && (
            <Panel
              title="After-hours forwarding"
              description="When business hours are closed, forward to an external line or another Transovo number."
            >
              <AfterHoursForwardPanel
                phoneNumberId={phoneNumberId}
                workspaceNumbers={config.numbers}
                onSaved={reload}
              />
            </Panel>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-4">
          <Panel title="Call path" description="High-level flow for this number.">
            <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
              <li>Incoming call to business line</li>
              <li>{policy?.answeringMode === 'auto_attendant' ? 'Phone menu' : 'Direct forward or browser'}</li>
              <li>Destination phone(s)</li>
              <li>Voicemail or fallback if unanswered</li>
            </ol>
          </Panel>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Forwarded (month)" value={String(config?.usage?.forwardedCalls ?? '—')} />
            <Stat label="Bridged min" value={String(config?.usage?.bridgedMinutes ?? '—')} />
          </div>
          <Panel title="Quick actions">
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/app/phone/auto-attendant/new">Create auto attendant</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/app/phone/business-hours">Edit business hours</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/app/phone/voicemail">Voicemail</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/app/phone/calls">See calls</Link>
              </Button>
            </div>
          </Panel>
        </aside>
      </div>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cf-drawer-title"
        >
          <div className="flex h-full w-full max-w-md flex-col gap-4 bg-background p-6 shadow-xl">
            <h2 id="cf-drawer-title" className="text-lg font-semibold">Add forwarding destination</h2>
            <ForwardingDestinationSelector
              workspaceNumbers={config?.numbers ?? []}
              value={destDraft}
              onChange={setDestDraft}
            />
            <p className="text-xs text-muted-foreground">
              Press 1 screening is enabled by default to help prevent personal voicemail from answering business calls.
            </p>
            <div className="mt-auto flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</Button>
              <Button type="button" onClick={addDestination}>Save destination</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
