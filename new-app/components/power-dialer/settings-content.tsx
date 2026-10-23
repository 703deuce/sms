'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
import { PowerDialerTeamSettingsPanel } from '@/components/power-dialer/team-settings-panel'
import { PowerDialerDeveloperSettingsPanel } from '@/components/power-dialer/developer-settings-panel'
import { CadencesSettingsPanel } from '@/components/power-dialer/cadences-settings-panel'
import { useNumbers } from '@/components/providers/numbers-provider'
import { formatPhone } from '@/lib/format'

export function PowerDialerSettingsContent() {
  const { owned } = useNumbers()
  const [settings, setSettings] = useState<PowerDialerWorkspaceSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

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
        description="Workspace defaults for dialing behavior. Campaign settings override these where configured."
        actions={
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        }
      />
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v ?? 'general')}>
        <div className="-mx-1 overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto w-max flex-nowrap">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="dialing">Dialing</TabsTrigger>
            <TabsTrigger value="dispositions">Dispositions</TabsTrigger>
            <TabsTrigger value="cadences">Cadences</TabsTrigger>
            <TabsTrigger value="scripts">Scripts</TabsTrigger>
            <TabsTrigger value="vm-drops">Voicemail Drops</TabsTrigger>
            <TabsTrigger value="screening">Call Screening</TabsTrigger>
            <TabsTrigger value="caller-id">Caller ID</TabsTrigger>
            <TabsTrigger value="recording">Recording</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="developer">API &amp; Webhooks</TabsTrigger>
            <TabsTrigger value="usage">Usage &amp; Subscription</TabsTrigger>
          </TabsList>
        </div>
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
                Require disposition before advancing to the next contact
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">After-call work timeout (seconds)</span>
                <Input
                  type="number"
                  min={0}
                  max={900}
                  value={settings.afterCallWorkTimeoutSec ?? 120}
                  onChange={(e) =>
                    setSettings({ ...settings, afterCallWorkTimeoutSec: Number(e.target.value) })
                  }
                />
                <span className="text-xs text-muted-foreground">
                  Server auto-completes disposition if the rep exceeds this window (0 = disabled).
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.callRatingsEnabled ?? false}
                  onChange={(e) =>
                    setSettings({ ...settings, callRatingsEnabled: e.target.checked })
                  }
                />
                Require 1–5 call rating before next contact
              </label>
            </div>
          </Panel>
          <Panel title="Session convenience (M04)" className="mt-6">
            <div className="grid max-w-md grid-cols-1 gap-4 text-sm">
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">Ring tone</span>
                <select
                  className="rounded-md border bg-background px-3 py-2"
                  value={settings.sessionRingTone ?? 'default'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sessionRingTone: e.target.value as 'default' | 'classic' | 'muted',
                    })
                  }
                >
                  <option value="default">Default</option>
                  <option value="classic">Classic</option>
                  <option value="muted">Muted</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">Display time format</span>
                <select
                  className="rounded-md border bg-background px-3 py-2"
                  value={settings.displayTimeFormat ?? '12h'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      displayTimeFormat: e.target.value as '12h' | '24h',
                    })
                  }
                >
                  <option value="12h">12-hour</option>
                  <option value="24h">24-hour</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.skipDuplicateNumbers ?? true}
                  onChange={(e) =>
                    setSettings({ ...settings, skipDuplicateNumbers: e.target.checked })
                  }
                />
                Skip duplicate phone numbers within a session
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.preventDuplicatePerContact ?? true}
                  onChange={(e) =>
                    setSettings({ ...settings, preventDuplicatePerContact: e.target.checked })
                  }
                />
                Prevent dialing the same contact twice in one session
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.sessionEmailDeliveryEnabled ?? true}
                  onChange={(e) =>
                    setSettings({ ...settings, sessionEmailDeliveryEnabled: e.target.checked })
                  }
                />
                Allow one-touch email from the dialer session
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
              <p className="text-xs text-muted-foreground">
                Power-dialer outbound calls use these workspace defaults unless a campaign overrides recording in the campaign editor.
                Global Phone → recording toggles apply to non–power-dialer calls only and do not silently override dialer policy (P23).
              </p>
              <p className="text-xs text-muted-foreground">
                Retention follows workspace media policies when configured; older recordings may be purged automatically after this period.
              </p>
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="dispositions" className="mt-6">
          <DispositionsLibraryPanel />
        </TabsContent>
        <TabsContent value="cadences" className="mt-6">
          <CadencesSettingsPanel />
        </TabsContent>
        <TabsContent value="scripts" className="mt-6">
          <ScriptsLibraryPanel />
        </TabsContent>
        <TabsContent value="vm-drops" className="mt-6">
          {activeTab === 'vm-drops' && (
            <>
              <Panel title="Compliance opt-in" className="mb-6">
                <p className="mb-3 text-sm text-muted-foreground">
                  Prerecorded voicemail drops may be restricted in your jurisdiction. Enable only after your administrator confirms compliance.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.prerecordedVmOptIn ?? false}
                    onChange={(e) => setSettings({ ...settings, prerecordedVmOptIn: e.target.checked })}
                  />
                  Allow voicemail drop uploads and dialer playback
                </label>
                <p className="mt-3 text-xs text-muted-foreground">
                  Greeting-end detection depends on carrier AMD signals and may not be available on every call.
                </p>
              </Panel>
              <VoicemailDropsLibraryPanel optIn={Boolean(settings.prerecordedVmOptIn)} />
            </>
          )}
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
              <Link href="/app/numbers" className="text-primary hover:underline">Numbers</Link> inventory. Callback routing for inbound calls to dialer lines uses existing phone routing — verify per-number assignment in Numbers.
            </p>
          </Panel>
        </TabsContent>
        <TabsContent value="screening" className="mt-6">
          {activeTab === 'screening' && (
          <Panel
            title="Call screening"
            description="When enabled, Transovo can flag automated call screeners so reps know when a person may not be on the line yet. Results depend on the callee’s carrier and device."
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
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">Screener introduction (truthful)</span>
                <select
                  className="rounded-md border bg-background px-3 py-2"
                  value={settings.screenerIntroMode ?? 'off'}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      screenerIntroMode: e.target.value as PowerDialerWorkspaceSettings['screenerIntroMode'],
                    })
                  }
                >
                  <option value="off">Off</option>
                  <option value="tts">Speak configured text (TTS)</option>
                  <option value="recorded">Play recorded URL</option>
                </select>
              </label>
              {settings.screenerIntroMode === 'tts' && (
                <label className="flex flex-col gap-1.5">
                  <span className="font-medium">Introduction text</span>
                  <Input
                    value={settings.screenerIntroText ?? ''}
                    onChange={(e) => setSettings({ ...settings, screenerIntroText: e.target.value })}
                  />
                </label>
              )}
              {settings.screenerIntroMode === 'recorded' && (
                <label className="flex flex-col gap-1.5">
                  <span className="font-medium">Recorded audio URL</span>
                  <Input
                    value={settings.screenerIntroAudioUrl ?? ''}
                    onChange={(e) => setSettings({ ...settings, screenerIntroAudioUrl: e.target.value })}
                  />
                </label>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.beepAutoDropEnabled ?? false}
                  onChange={(e) => setSettings({ ...settings, beepAutoDropEnabled: e.target.checked })}
                />
                Auto-drop voicemail after AMD greeting end (requires prerecorded opt-in)
              </label>
              <p className="text-xs text-muted-foreground">
                Telnyx signals: machine_end_beep (preferred), machine_end_silence, machine_end_other. Default off.
              </p>
            </div>
          </Panel>
          )}
        </TabsContent>
        <TabsContent value="compliance" className="mt-6">
          <PowerDialerComplianceSettingsPanel />
        </TabsContent>
        <TabsContent value="usage" className="mt-6">
          <Panel title="Usage & subscription" description="Billable minutes are calculated from connected talk time on power-dialer attempts and your workspace subscription limits.">
            <p className="text-sm text-muted-foreground">
              Included minutes and overage rules come from your Transovo subscription. When you choose to block overage, new dial sessions stop after included minutes are used up.
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
          <PowerDialerTeamSettingsPanel />
        </TabsContent>
        <TabsContent value="developer" className="mt-6">
          <PowerDialerDeveloperSettingsPanel />
        </TabsContent>
      </Tabs>
    </Page>
  )
}
