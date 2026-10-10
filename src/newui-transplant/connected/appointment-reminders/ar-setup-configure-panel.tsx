'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Panel } from '@/newui-transplant/components/app/kit'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { Input } from '@/newui-transplant/components/ui/input'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { Button } from '@/newui-transplant/components/ui/button'
import { INDUSTRY_LABELS } from '@/lib/appointment-reminders/template-library/types'
import { renderReminderTemplatePreview } from '@/lib/appointment-reminders/template-library/preview-vars'

export function ArSetupConfigurePanel({ onSaved }: { onSaved?: () => void }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [businessName, setBusinessName] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [industry, setIndustry] = useState('general')
  const [tone, setTone] = useState('friendly')
  const [timing, setTiming] = useState('standard_48h_3h')
  const [channel, setChannel] = useState<'sms' | 'email' | 'both'>('both')
  const [previewSms, setPreviewSms] = useState('')
  const [industries, setIndustries] = useState<Array<{ id: string; label: string }>>([])

  useEffect(() => {
    void fetch('/api/appointment-reminders/settings')
      .then((r) => r.json())
      .then((json) => {
        const data = json.data
        if (json.workspace?.name) setBusinessName(data.businessDisplayName || json.workspace.name)
        setBusinessPhone(data.businessPhone || data.reminderEmailBranding?.contactPhone || '')
        setBusinessAddress(data.businessAddress || '')
        if (data.reminderPreferences?.templateIndustry) setIndustry(data.reminderPreferences.templateIndustry)
        if (data.reminderPreferences?.communicationTone) setTone(data.reminderPreferences.communicationTone)
        if (data.reminderPreferences?.defaultNotificationChannel) {
          setChannel(data.reminderPreferences.defaultNotificationChannel)
        }
      })
      .finally(() => setLoading(false))
    void fetch('/api/appointment-reminders/templates/library')
      .then((r) => r.json())
      .then((json) => {
        const list = (json.data?.industries || []) as Array<{ id: string; label: string }>
        setIndustries(list.map((i) => ({ id: i.id, label: i.label })))
      })
  }, [])

  const loadPreview = useCallback(async () => {
    const res = await fetch(
      `/api/appointment-reminders/templates/library?industry=${encodeURIComponent(industry)}&messageType=advance_reminder&channel=sms`,
    )
    const json = await res.json()
    if (!res.ok) return
    const body = json.data?.body || ''
    setPreviewSms(
      renderReminderTemplatePreview(body, {
        business_name: businessName || 'Your business',
        business_phone: businessPhone || '(555) 555-0100',
        location: businessAddress || '123 Main St',
        first_name: 'Alex',
        appointment_date: 'Tuesday, March 12',
        appointment_time: '2:30 PM',
      }),
    )
  }, [businessAddress, businessName, businessPhone, industry])

  useEffect(() => {
    void loadPreview()
  }, [loadPreview])

  const industryOptions = useMemo(
    () =>
      industries.length > 0
        ? industries.map((i) => ({ value: i.id, label: i.label }))
        : Object.entries(INDUSTRY_LABELS).map(([value, label]) => ({ value, label })),
    [industries],
  )

  const saveAll = async () => {
    setSaving(true)
    setError('')
    try {
      const settingsRes = await fetch('/api/appointment-reminders/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessDisplayName: businessName,
          businessPhone,
          businessAddress,
          reminderPreferences: {
            templateIndustry: industry,
            communicationTone: tone as 'formal' | 'casual' | 'warm' | 'friendly',
            defaultNotificationChannel: channel,
          },
          reminderEmailBranding: { contactPhone: businessPhone },
        }),
      })
      if (!settingsRes.ok) {
        const json = await settingsRes.json()
        throw new Error(json.error || 'Could not save business profile')
      }
      const presetRes = await fetch('/api/appointment-reminders/settings/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry, tone, timing, apply: true }),
      })
      const presetJson = await presetRes.json()
      if (!presetRes.ok) throw new Error(presetJson.error || 'Could not apply reminder pack')
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading configuration…
      </p>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Panel title="Business">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Business name</span>
              <Input className="h-10" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Phone</span>
              <Input className="h-10" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Address</span>
              <Textarea className="min-h-[72px]" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
            </label>
          </div>
        </Panel>
        <Panel title="Industry & tone">
          <div className="grid gap-3 sm:grid-cols-2">
            <SimpleSelect label="Industry" value={industry} onChange={setIndustry} options={industryOptions} />
            <SimpleSelect
              label="Tone"
              value={tone}
              onChange={setTone}
              options={[
                { value: 'formal', label: 'Formal' },
                { value: 'casual', label: 'Casual' },
                { value: 'warm', label: 'Warm' },
                { value: 'friendly', label: 'Friendly' },
              ]}
            />
          </div>
        </Panel>
        <Panel title="Reminder schedule">
          <SimpleSelect
            label="Schedule preset"
            value={timing}
            onChange={setTiming}
            options={[
              { value: 'simple_24h', label: 'Simple' },
              { value: 'standard_48h_3h', label: 'Standard' },
              { value: 'confirmation_focused', label: 'Confirmation-focused' },
              { value: 'long_lead', label: 'Long-lead' },
            ]}
          />
          <SimpleSelect
            className="mt-3"
            label="Channels"
            value={channel}
            onChange={(v) => setChannel(v as 'sms' | 'email' | 'both')}
            options={[
              { value: 'both', label: 'SMS and email' },
              { value: 'sms', label: 'SMS only' },
              { value: 'email', label: 'Email only' },
            ]}
          />
        </Panel>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <Button type="button" onClick={() => void saveAll()} disabled={saving}>
          {saving ? 'Saving…' : 'Save configuration'}
        </Button>
      </div>
      <div className="lg:col-span-2">
        <Panel title="Preview" description="Example SMS from your selected industry pack.">
          <p className="whitespace-pre-wrap rounded-lg border bg-muted/25 p-4 text-sm leading-relaxed">{previewSms || '…'}</p>
        </Panel>
      </div>
    </div>
  )
}
