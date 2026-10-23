'use client'

import Link from 'next/link'
import { CrmOAuthConnectButton } from '@/components/integrations/crm-oauth-connect-button'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { SimpleSelect } from '@/components/app/filters'
import { formatCrmOperations } from '@/lib/phone/integration-op-labels'

type IntegrationDetailData = {
  provider: string
  connected: boolean
  connection: { status: string; lastSyncAt: string | null }
  settings: {
    logCalls: boolean
    logDispositions: boolean
    logNotes: boolean
    createFollowUpTasks: boolean
    listSourceId: string | null
    fieldMappings: Record<string, string>
  }
  importSources: { id: string; label: string }[]
  oauthStartUrl: string
  supportedOperations?: string[]
}

export function IntegrationDetailContent({ provider }: { provider: string }) {
  const [data, setData] = useState<IntegrationDetailData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoadError(null)
    void fetch(`/api/phone/power-dialer/integrations/${provider}`)
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error((j as { error?: string }).error || 'Could not load integration')
        return j.data as IntegrationDetailData
      })
      .then((d) => setData(d))
      .catch((e) => {
        setData(null)
        setLoadError(e instanceof Error ? e.message : 'Could not load integration')
      })
  }, [provider])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!data || !data.connected) return
    const res = await fetch(`/api/phone/power-dialer/integrations/${provider}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data.settings),
    })
    if (!res.ok) {
      toast.error('Save failed')
      return
    }
    toast.success('Integration settings saved')
    load()
  }

  if (loadError) {
    return (
      <Page>
        <PageHeader title={provider} description="CRM integration for Power Dialer." />
        <p className="text-sm text-destructive" role="alert">{loadError}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={load}>Retry</Button>
      </Page>
    )
  }

  if (!data) {
    return <Page><p className="text-sm text-muted-foreground">Loading…</p></Page>
  }

  const disconnected = !data.connected

  return (
    <Page>
      <PageHeader
        title={provider}
        description="Sync contacts and call outcomes with your CRM when connected."
        breadcrumbs={[
          { label: 'Integrations', href: '/app/power-dialer/integrations' },
          { label: provider },
        ]}
        actions={
          disconnected ? (
            <CrmOAuthConnectButton provider={provider}>Connect {provider}</CrmOAuthConnectButton>
          ) : (
            <div className="flex gap-2">
              <CrmOAuthConnectButton provider={provider} variant="outline">Reconnect</CrmOAuthConnectButton>
              <Button size="sm" onClick={() => void save()}>Save</Button>
            </div>
          )
        }
      />
      {disconnected && (
        <Panel title="Not connected">
          <p className="text-sm text-muted-foreground">
            Connect this CRM to configure sync directions and field mappings. Until then, Power Dialer runs without CRM write-back for this provider.
          </p>
          <p className="mt-2 text-sm">
            <Link href="/app/integrations" className="text-primary hover:underline">Workspace integrations</Link>
            {' '}also lists connection status for all providers.
          </p>
        </Panel>
      )}
      <Panel title="Connection">
        <StatusBadge tone={data.connected ? 'success' : 'warning'}>
          {data.connection.status}
        </StatusBadge>
        {data.connection.lastSyncAt && (
          <p className="mt-2 text-xs text-muted-foreground">
            Last sync {new Date(data.connection.lastSyncAt).toLocaleString()}
          </p>
        )}
      </Panel>
      {data.supportedOperations && data.supportedOperations.length > 0 && (
        <Panel title="Supported operations">
          <p className="text-sm text-muted-foreground">{formatCrmOperations(data.supportedOperations)}</p>
        </Panel>
      )}
      <Panel title="Sync directions">
        {disconnected && (
          <p className="mb-3 text-xs text-muted-foreground">Available after you connect.</p>
        )}
        <div className="flex flex-col gap-2 text-sm">
          {(
            [
              ['logCalls', 'Log completed calls'],
              ['logDispositions', 'Log dispositions'],
              ['logNotes', 'Log notes'],
              ['createFollowUpTasks', 'Create follow-up tasks for callbacks'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={disconnected}
                checked={data.settings[key]}
                onChange={(e) =>
                  setData({
                    ...data,
                    settings: { ...data.settings, [key]: e.target.checked },
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </Panel>
      <Panel title="Default import source">
        <SimpleSelect
          label="List or object"
          value={data.settings.listSourceId || data.importSources[0]?.id || ''}
          onChange={(v) => setData({ ...data, settings: { ...data.settings, listSourceId: v } })}
          options={data.importSources.map((s) => ({ value: s.id, label: s.label }))}
          disabled={disconnected}
        />
      </Panel>
      <Panel title="CRM sync (M17 / M76)">
        {disconnected ? (
          <p className="text-sm text-muted-foreground">Connect CRM to run inbound sync and list import.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void fetch(`/api/phone/power-dialer/integrations/${provider}/sync-inbound`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mode: 'contacts' }),
                })
                  .then(async (r) => {
                    const j = await r.json()
                    if (!r.ok) throw new Error((j as { error?: string }).error || 'Sync failed')
                    toast.success(`Inbound sync: ${JSON.stringify(j.data)}`)
                    load()
                  })
                  .catch((e) => toast.error(e instanceof Error ? e.message : 'Sync failed'))
              }}
            >
              Run inbound contact sync
            </Button>
            <Link
              href="/app/power-dialer/integrations/sync-history"
              className="text-sm text-primary hover:underline self-center"
            >
              View sync history &amp; retries
            </Link>
          </div>
        )}
      </Panel>
      <Panel title="Field mappings (contact)">
        {disconnected ? (
          <p className="text-sm text-muted-foreground">
            Map Transovo contact fields to CRM fields after connection. Mappings are disabled while disconnected.
          </p>
        ) : (
          <div className="grid max-w-lg gap-2 text-sm">
            {['phone', 'firstName', 'lastName', 'email', 'company'].map((field) => (
              <label key={field} className="grid grid-cols-2 items-center gap-2">
                <span className="font-medium capitalize">{field.replace(/([A-Z])/g, ' $1')}</span>
                <Input
                  value={data.settings.fieldMappings[field] || ''}
                  onChange={(e) =>
                    setData({
                      ...data,
                      settings: {
                        ...data.settings,
                        fieldMappings: { ...data.settings.fieldMappings, [field]: e.target.value },
                      },
                    })
                  }
                  placeholder="CRM field API name"
                  aria-label={`${field} CRM field`}
                />
              </label>
            ))}
          </div>
        )}
      </Panel>
    </Page>
  )
}
