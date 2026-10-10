'use client'

import type { RemindersApiConfig } from '@/features/appointments/kimi/reminders/map-reminders'
import { patchReminderPreferences } from '@/features/appointments/kimi/reminders/map-reminders'
import { Panel } from '@/newui-transplant/components/app/kit'
import { Input } from '@/newui-transplant/components/ui/input'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { Button } from '@/newui-transplant/components/ui/button'
import { createId } from '@/lib/supabase/id'
import type { ReminderServiceRule } from '@/lib/appointments/types'

type Props = {
  config: RemindersApiConfig
  onChange: (next: RemindersApiConfig) => void
}

export function ArSchedulingPreferencesPanel({ config, onChange }: Props) {
  const prefs = config.reminderPreferences || {}
  const rules = prefs.serviceReminderRules || []
  const customFields = prefs.customMergeFields || {}

  const patchPrefs = (patch: Partial<typeof prefs>) => {
    onChange(patchReminderPreferences(config, patch))
  }

  return (
    <div className="space-y-4">
      <Panel title="Scheduling rules" description="Lead time and send-time behavior honored by discovery and dispatch.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Minimum lead time (minutes)</span>
            <Input
              type="number"
              min={0}
              className="h-10"
              value={prefs.minimumLeadTimeMinutes ?? 15}
              onChange={(e) =>
                patchPrefs({ minimumLeadTimeMinutes: Math.max(0, Number(e.target.value) || 0) })
              }
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Do not schedule timed reminders when the appointment starts sooner than this.
            </span>
          </label>
          <SimpleSelect
            label="Default recipient channel"
            value={prefs.defaultNotificationChannel || 'both'}
            onChange={(v) =>
              patchPrefs({
                defaultNotificationChannel: v as 'sms' | 'email' | 'both',
              })
            }
            options={[
              { value: 'both', label: 'SMS and email (per step)' },
              { value: 'sms', label: 'SMS only' },
              { value: 'email', label: 'Email only' },
            ]}
          />
          <SimpleSelect
            label="Template locale tag"
            value={prefs.templateLocale || 'en'}
            onChange={(v) => patchPrefs({ templateLocale: v })}
            options={[
              { value: 'en', label: 'English (en)' },
              { value: 'es', label: 'Spanish (es)' },
              { value: 'fr', label: 'French (fr)' },
            ]}
          />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={prefs.skipConfirmationOnHistoricalImport === true}
            onChange={(e) => patchPrefs({ skipConfirmationOnHistoricalImport: e.target.checked })}
          />
          Skip immediate confirmation for calendar events that started more than 24 hours ago on first import
        </label>
      </Panel>

      <Panel title="Custom merge fields" description="Optional keys merged into templates (appointment metadata overrides defaults).">
        <Textarea
          className="min-h-[100px] font-mono text-xs"
          value={Object.entries(customFields)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n')}
          onChange={(e) => {
            const next: Record<string, string> = {}
            for (const line of e.target.value.split('\n')) {
              const trimmed = line.trim()
              if (!trimmed || !trimmed.includes('=')) continue
              const [k, ...rest] = trimmed.split('=')
              next[k.trim()] = rest.join('=').trim()
            }
            patchPrefs({ customMergeFields: next })
          }}
          placeholder="parking_note=Use rear entrance"
        />
      </Panel>

      <Panel title="Appointment-type rules" description="Match service name text; disable steps or override channel.">
        <ul className="space-y-3">
          {rules.map((rule) => (
            <li key={rule.id} className="rounded-lg border p-3 text-sm space-y-2">
              <Input
                value={rule.serviceNameContains}
                onChange={(e) => {
                  const next = rules.map((r) =>
                    r.id === rule.id ? { ...r, serviceNameContains: e.target.value } : r,
                  )
                  patchPrefs({ serviceReminderRules: next })
                }}
                placeholder="Service contains…"
              />
              <Input
                value={(rule.disabledStepKeys || []).join(', ')}
                onChange={(e) => {
                  const keys = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                  const next = rules.map((r) =>
                    r.id === rule.id ? { ...r, disabledStepKeys: keys } : r,
                  )
                  patchPrefs({ serviceReminderRules: next })
                }}
                placeholder="Disabled steps: reminder2h, confirmation"
              />
              <SimpleSelect
                label="Channel override (optional)"
                value={rule.channelOverride || ''}
                onChange={(v) => {
                  const next = rules.map((r) =>
                    r.id === rule.id
                      ? { ...r, channelOverride: v ? (v as ReminderServiceRule['channelOverride']) : undefined }
                      : r,
                  )
                  patchPrefs({ serviceReminderRules: next })
                }}
                options={[
                  { value: '', label: 'No override' },
                  { value: 'sms', label: 'SMS' },
                  { value: 'email', label: 'Email' },
                ]}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  patchPrefs({ serviceReminderRules: rules.filter((r) => r.id !== rule.id) })
                }
              >
                Remove rule
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            const next: ReminderServiceRule[] = [
              ...rules,
              { id: createId(), serviceNameContains: '', disabledStepKeys: [] },
            ]
            patchPrefs({ serviceReminderRules: next })
          }}
        >
          Add rule
        </Button>
      </Panel>
    </div>
  )
}
