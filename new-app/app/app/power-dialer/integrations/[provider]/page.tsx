'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { SimpleSelect } from '@/components/app/filters'

export default function IntegrationDetailPage() {
  const params = useParams()
  const provider = String(params.provider || '')
  const [data, setData] = useState<{
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
  } | null>(null)

  const load = useCallback(() => {
    void fetch(`/api/phone/power-dialer/integrations/${provider}`)
      .then((r) => r.json())
      .then((j) => setData(j.data))
  }, [provider])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!data) return
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

  if (!data) {
    return <Page><p className="text-sm text-muted-foreground">Loading…</p></Page>
  }

  return (
    <Page>
      <PageHeader
        title={provider}
        description="Power Dialer CRM sync directions and field mappings."
        breadcrumbs={[
          { label: 'Integrations', href: '/app/power-dialer/integrations' },
          { label: provider },
        ]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={data.oauthStartUrl}>Reconnect</Link>
            </Button>
            <Button size="sm" onClick={() => void save()}>Save</Button>
          </div>
        }
      />
      <Panel title="Connection">
        <StatusBadge tone={data.connection.status === 'connected' ? 'success' : 'warning'}>
          {data.connection.status}
        </StatusBadge>
        {data.connection.lastSyncAt && (
          <p className="mt-2 text-xs text-muted-foreground">Last sync {new Date(data.connection.lastSyncAt).toLocaleString()}</p>
        )}
      </Panel>
      <Panel title="Sync directions">
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
          value={data.settings.listSourceId || data.importSources[0]?.id || ''}
          onChange={(v) => setData({ ...data, settings: { ...data.settings, listSourceId: v } })}
          options={data.importSources.map((s) => ({ value: s.id, label: s.label }))}
        />
      </Panel>
      <Panel title="Field mappings (contact)">
        <div className="grid max-w-lg gap-2 text-sm">
          {['phone', 'firstName', 'lastName', 'email', 'company'].map((field) => (
            <label key={field} className="grid grid-cols-2 gap-2 items-center">
              <span>{field}</span>
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
              />
            </label>
          ))}
        </div>
      </Panel>
    </Page>
  )
}
