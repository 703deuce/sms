'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { BusinessHours } from '@/components/routing/business-hours'
import { BUSINESS, TEAM } from '@/lib/data'
import { fetchPhoneSettings, patchPhoneSettings } from '@/lib/phone-api'

const TABS = [
  { value: 'business', label: 'Business' },
  { value: 'team', label: 'Team' },
  { value: 'billing', label: 'Billing & usage' },
  { value: 'preferences', label: 'Preferences' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'security', label: 'Security' },
] as const

const USAGE = [
  { label: 'Calling minutes', used: 1842, limit: 3000, unit: 'min' },
  { label: 'AI Receptionist minutes', used: 412, limit: 500, unit: 'min' },
  { label: 'SMS segments', used: 638, limit: 1500, unit: 'segments' },
  { label: 'Phone numbers', used: 3, limit: 5, unit: 'numbers' },
]

function Field({ id, label, defaultValue, type = 'text' }: { id: string; label: string; defaultValue: string; type?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} defaultValue={defaultValue} />
    </div>
  )
}

function ToggleRow({
  id,
  label,
  hint,
  defaultChecked,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  hint: string
  defaultChecked?: boolean
  checked?: boolean
  onCheckedChange?: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <Switch
        id={id}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}

function PhonePreferences() {
  const [recordCalls, setRecordCalls] = useState(true)
  const [transcribeVoicemail, setTranscribeVoicemail] = useState(true)
  const [noiseSuppression, setNoiseSuppression] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void fetchPhoneSettings()
      .then((s) => {
        setRecordCalls(s.recordCalls)
        setTranscribeVoicemail(s.transcribeVoicemail)
        setNoiseSuppression(s.noiseSuppression)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const save = async (patch: Record<string, boolean>) => {
    try {
      await patchPhoneSettings(patch)
      toast.success('Phone preferences saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save preferences')
    }
  }

  if (!loaded) return <p className="px-5 py-4 text-sm text-muted-foreground">Loading phone preferences…</p>

  return (
    <>
      <ToggleRow
        id="pref-record"
        label="Record calls"
        hint="Plays a recording disclosure at the start of each call."
        checked={recordCalls}
        onCheckedChange={(v) => {
          setRecordCalls(v)
          void save({ recordCalls: v })
        }}
      />
      <ToggleRow
        id="pref-transcribe"
        label="Transcribe voicemail"
        hint="Voicemails are transcribed and attached to the call."
        checked={transcribeVoicemail}
        onCheckedChange={(v) => {
          setTranscribeVoicemail(v)
          void save({ transcribeVoicemail: v })
        }}
      />
      <ToggleRow
        id="pref-noise"
        label="Noise suppression"
        hint="Filters background noise in the browser dialer."
        checked={noiseSuppression}
        onCheckedChange={(v) => {
          setNoiseSuppression(v)
          void save({ noiseSuppression: v })
        }}
      />
    </>
  )
}

export function SettingsTabs() {
  const router = useRouter()
  const params = useSearchParams()
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab')! : 'business'

  return (
    <Tabs value={tab} onValueChange={(v) => router.replace(`/app/settings?tab=${v}`, { scroll: false })} className="flex flex-col gap-6">
      <div className="overflow-x-auto">
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="business" className="flex flex-col gap-6">
        <Panel title="Business profile" description="Used by the AI Receptionist and in outbound caller ID.">
          <form
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              toast.success('Business profile saved')
            }}
          >
            <Field id="biz-name" label="Business name" defaultValue={BUSINESS.name} />
            <Field id="biz-tz" label="Time zone" defaultValue={BUSINESS.timezoneLabel} />
            <div className="md:col-span-2">
              <Field id="biz-address" label="Address" defaultValue={BUSINESS.address} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Save profile</Button>
            </div>
          </form>
        </Panel>
        <Panel title="Business hours" description="Shared with call routing and the AI Receptionist.">
          <BusinessHours />
        </Panel>
      </TabsContent>

      <TabsContent value="team">
        <Panel
          title="Team & permissions"
          bodyClassName="p-0"
          actions={
            <Button size="sm" onClick={() => toast.success('Invite sent')}>
              <UserPlus />
              Invite
            </Button>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="pr-5">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TEAM.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="pl-5 font-medium">{m.name}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{m.email}</TableCell>
                  <TableCell>{m.role}</TableCell>
                  <TableCell className="pr-5">
                    <StatusBadge tone={m.status === 'active' ? 'success' : 'warning'}>{m.status === 'active' ? 'Active' : 'Invited'}</StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </TabsContent>

      <TabsContent value="billing" className="flex flex-col gap-6">
        <Panel title="Growth plan" description="Renews Nov 1, 2026 · usage resets each billing cycle" actions={<Button size="sm" variant="outline">Manage plan</Button>}>
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {USAGE.map((u) => {
              const ratio = u.used / u.limit
              return (
                <li key={u.label} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{u.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {u.used.toLocaleString()} / {u.limit.toLocaleString()} {u.unit}
                    </span>
                  </div>
                  <Progress value={ratio * 100} aria-label={`${u.label} usage`} />
                  {ratio >= 0.8 && <p className="text-xs text-warning-foreground">{Math.round(ratio * 100)}% used — consider upgrading</p>}
                </li>
              )
            })}
          </ul>
        </Panel>
      </TabsContent>

      <TabsContent value="preferences">
        <Panel title="Phone & audio" bodyClassName="divide-y py-0">
          <PhonePreferences />
        </Panel>
      </TabsContent>

      <TabsContent value="notifications">
        <Panel title="Notify me when" bodyClassName="divide-y py-0">
          <ToggleRow id="n-callback" label="A callback is requested" hint="From AI Receptionist or text-back replies." defaultChecked />
          <ToggleRow id="n-missed" label="A call is missed with no recovery" hint="Nobody answered and text-back was not sent." defaultChecked />
          <ToggleRow id="n-int" label="An integration disconnects" hint="Calendar, CRM or notification channels." defaultChecked />
          <ToggleRow id="n-digest" label="Daily digest" hint="Summary email at 6 PM local time." />
        </Panel>
      </TabsContent>

      <TabsContent value="security">
        <Panel title="Security" bodyClassName="divide-y py-0">
          <ToggleRow id="s-2fa" label="Require two-factor authentication" hint="All team members must enable 2FA to sign in." defaultChecked />
          <ToggleRow id="s-ip" label="Restrict admin access by IP" hint="Only allow settings changes from approved networks." />
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Delete workspace</span>
              <p className="text-sm text-muted-foreground">Releases all numbers and permanently deletes recordings and messages.</p>
            </div>
            <Button variant="destructive" onClick={() => toast.error('Contact the workspace owner to delete this workspace.')}>
              Delete
            </Button>
          </div>
        </Panel>
      </TabsContent>
    </Tabs>
  )
}
