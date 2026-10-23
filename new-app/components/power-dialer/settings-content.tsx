'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchPowerDialerSettings, patchPowerDialerSettings } from '@/lib/phone-api'
import type { PowerDialerWorkspaceSettings } from '@/lib/products/power-dialer'

export function PowerDialerSettingsContent() {
  const [settings, setSettings] = useState<PowerDialerWorkspaceSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void fetchPowerDialerSettings().then(setSettings).catch(() => toast.error('Could not load settings'))
  }, [])

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const next = await patchPowerDialerSettings(settings)
      setSettings(next)
      toast.success('Settings saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!settings) {
    return (
      <Page>
        <PageHeader title="Settings" description="Power Dialer defaults for this workspace." />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader
        title="Settings"
        description="Workspace defaults for dialing behavior. Campaign-level rules will override these when configured (Phase 2+)."
        actions={
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        }
      />
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="dialing">Dialing</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-6">
          <Panel title="General">
            <div className="flex max-w-md flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Default timezone</span>
                <Input
                  value={settings.defaultTimezone ?? ''}
                  onChange={(e) => setSettings({ ...settings, defaultTimezone: e.target.value })}
                />
              </label>
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="dialing" className="mt-6">
          <Panel title="Dialing defaults">
            <div className="grid max-w-md grid-cols-1 gap-4">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Ring timeout (seconds)</span>
                <Input
                  type="number"
                  min={10}
                  max={120}
                  value={settings.defaultRingTimeoutSec ?? 30}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultRingTimeoutSec: Number(e.target.value) })
                  }
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Post-call interval (seconds)</span>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={settings.defaultPostCallIntervalSec ?? 5}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultPostCallIntervalSec: Number(e.target.value) })
                  }
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Default max attempts per contact</span>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={settings.defaultMaxAttempts ?? 3}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultMaxAttempts: Number(e.target.value) })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.requireDispositionBeforeNext ?? true}
                  onChange={(e) =>
                    setSettings({ ...settings, requireDispositionBeforeNext: e.target.checked })
                  }
                />
                Require disposition before next call (UI enforced; auto-dial in Phase 2)
              </label>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </Page>
  )
}
