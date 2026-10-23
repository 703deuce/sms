'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchPowerDialerSettings, patchPowerDialerSettings } from '@/lib/phone-api'
import type { PowerDialerWorkspaceSettings } from '@/lib/products/power-dialer'
import {
  DispositionsLibraryPanel,
  ScriptsLibraryPanel,
  VoicemailDropsLibraryPanel,
} from '@/components/power-dialer/settings-library-panels'
import { PowerDialerComplianceSettingsPanel } from '@/components/power-dialer/compliance-settings-panel'
import { useNumbers } from '@/components/providers/numbers-provider'
import { formatPhone } from '@/lib/format'

export function PowerDialerSettingsContent() {
  const { owned } = useNumbers()
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
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="dialing">Dialing</TabsTrigger>
          <TabsTrigger value="recording">Recording</TabsTrigger>
          <TabsTrigger value="outcomes">Dispositions</TabsTrigger>
          <TabsTrigger value="scripts">Scripts</TabsTrigger>
          <TabsTrigger value="vm-drops">Voicemail drops</TabsTrigger>
          <TabsTrigger value="compliance">VM compliance</TabsTrigger>
          <TabsTrigger value="caller-id">Caller ID</TabsTrigger>
          <TabsTrigger value="screening">Call screening</TabsTrigger>
          <TabsTrigger value="calling-compliance">Calling compliance</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
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
        <TabsContent value="recording" className="mt-6">
          <Panel title="Recording">
            <div className="flex max-w-md flex-col gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.recordingEnabled ?? true}
                  onChange={(e) => setSettings({ ...settings, recordingEnabled: e.target.checked })}
                />
                Enable call recording (workspace default)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.recordingConsentAnnounce ?? false}
                  onChange={(e) =>
                    setSettings({ ...settings, recordingConsentAnnounce: e.target.checked })
                  }
                />
                Announce recording / consent where required
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">Retention (days)</span>
                <Input
                  type="number"
                  min={30}
                  value={settings.recordingRetentionDays ?? 365}
                  onChange={(e) =>
                    setSettings({ ...settings, recordingRetentionDays: Number(e.target.value) })
                  }
                />
              </label>
              <p className="text-xs text-muted-foreground">Retention enforcement uses workspace media policies when available; otherwise stored for future jobs (see ledger).</p>
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="outcomes" className="mt-6">
          <DispositionsLibraryPanel />
        </TabsContent>
        <TabsContent value="scripts" className="mt-6">
          <ScriptsLibraryPanel />
        </TabsContent>
        <TabsContent value="vm-drops" className="mt-6">
          <VoicemailDropsLibraryPanel optIn={Boolean(settings.prerecordedVmOptIn)} />
        </TabsContent>
        <TabsContent value="caller-id" className="mt-6">
          <Panel
            title="Caller ID"
            description="Default outbound number for power dialer when a campaign does not override. Pool assignment is per campaign (sticky per rep — no aggressive rotation)."
          >
            <label className="flex max-w-md flex-col gap-1.5 text-sm">
              <span className="font-medium">Default outbound number</span>
              <select
                className="rounded-md border bg-background px-3 py-2"
                value={settings.defaultCallerIdPhoneNumberId || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultCallerIdPhoneNumberId: e.target.value || null,
                  })
                }
                aria-label="Default caller ID number"
              >
                <option value="">Campaign line default</option>
                {owned.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nickname} ({formatPhone(n.number)})
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 text-xs text-muted-foreground">
              Numbers come from the global{' '}
              <a href="/app/numbers" className="text-primary hover:underline">Numbers</a> inventory. Callback routing for inbound calls to dialer lines uses existing phone routing — verify per-number assignment in Numbers.
            </p>
          </Panel>
        </TabsContent>
        <TabsContent value="screening" className="mt-6">
          <Panel
            title="Call screening"
            description="Detection uses Telnyx AMD / premium screener events when available. Intro playback and bypass are not guaranteed — feature defaults off until verified on real screened devices."
          >
            <div className="flex max-w-lg flex-col gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.callScreeningEnabled ?? false}
                  onChange={(e) => setSettings({ ...settings, callScreeningEnabled: e.target.checked })}
                />
                Enable screening detection (experimental)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.callScreeningNotifyRep ?? true}
                  onChange={(e) => setSettings({ ...settings, callScreeningNotifyRep: e.target.checked })}
                />
                Notify rep when screener detected
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.callScreeningSkipRecognized ?? false}
                  onChange={(e) => setSettings({ ...settings, callScreeningSkipRecognized: e.target.checked })}
                />
                Skip recognized screener (when detection is confident)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.callScreeningRepHandles ?? true}
                  onChange={(e) => setSettings({ ...settings, callScreeningRepHandles: e.target.checked })}
                />
                Rep handles screener when connected
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">Uncertain classification</span>
                <select
                  className="rounded-md border bg-background px-3 py-2"
                  value={settings.callScreeningUncertainBehavior ?? 'rep_handles'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      callScreeningUncertainBehavior: e.target.value as PowerDialerWorkspaceSettings['callScreeningUncertainBehavior'],
                    })
                  }
                >
                  <option value="rep_handles">Rep hears audio immediately</option>
                  <option value="voicemail">Treat as voicemail</option>
                  <option value="hangup">End call</option>
                </select>
              </label>
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="calling-compliance" className="mt-6">
          <PowerDialerComplianceSettingsPanel />
        </TabsContent>
        <TabsContent value="usage" className="mt-6">
          <Panel title="Usage & subscription" description="Minutes come from billable attempt seconds and workspace_limits.powerDialer — not hardcoded prices.">
            <p className="text-sm text-muted-foreground">
              Configure included minutes and overage behavior under workspace billing limits. When overage behavior is set to block, new dial sessions are prevented once included minutes are exhausted.
            </p>
            <label className="mt-4 flex max-w-xs flex-col gap-1.5 text-sm">
              <span className="font-medium">Usage alert threshold (%)</span>
              <Input
                type="number"
                min={50}
                max={100}
                value={settings.usageAlertThresholdPct ?? ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    usageAlertThresholdPct: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </label>
            <label className="mt-3 flex max-w-xs flex-col gap-1.5 text-sm">
              <span className="font-medium">When over included minutes</span>
              <select
                className="rounded-md border bg-background px-3 py-2"
                value={settings.overageBehavior ?? 'warn'}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    overageBehavior: e.target.value as 'block' | 'allow' | 'warn',
                  })
                }
              >
                <option value="warn">Warn only</option>
                <option value="block">Block new sessions</option>
                <option value="allow">Allow (track overage)</option>
              </select>
            </label>
          </Panel>
        </TabsContent>
        <TabsContent value="team" className="mt-6">
          <Panel title="Team & campaign access" description="Reuses workspace membership. Reps only dial campaigns they are assigned to.">
            <p className="text-sm text-muted-foreground">
              Manage members in workspace settings. Campaign assignment is configured per campaign under Members.
            </p>
          </Panel>
        </TabsContent>
        <TabsContent value="compliance" className="mt-6">
          <Panel title="Prerecorded voicemail drops">
            <p className="mb-3 text-sm text-muted-foreground">
              Counsel has not reviewed prerecorded-message rules for your jurisdiction. Do not enable until your administrator confirms compliance.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.prerecordedVmOptIn ?? false}
                onChange={(e) => setSettings({ ...settings, prerecordedVmOptIn: e.target.checked })}
              />
              Admin opt-in: allow voicemail drop uploads and dialer playback
            </label>
            <p className="mt-3 text-xs text-muted-foreground">
              Beep-detection / greeting-end timing is not wired until Telnyx AMD events are certified for power-dialer legs (ledger).
            </p>
          </Panel>
        </TabsContent>
      </Tabs>
    </Page>
  )
}
