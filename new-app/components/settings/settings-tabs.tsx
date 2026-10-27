'use client'

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
import { BUSINESS, TEAM } from '@/lib/data'
import { featuresAllUnlocked } from '@/lib/billing/entitlements'
import { T2vVoicesSettings } from '@/components/t2v/t2v-voices-settings'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'

const TABS = [
  { value: 'business', label: 'Business' },
  { value: 'team', label: 'Team' },
  { value: 'billing', label: 'Billing & usage' },
  ...(isT2vFeatureEnabled() ? [{ value: 'voices' as const, label: 'Voices' }] : []),
  { value: 'preferences', label: 'Preferences' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'security', label: 'Security' },
] as const

const USAGE = [
  { label: 'Source minutes processed', used: 0, limit: 300, unit: 'min' },
  { label: 'Clips exported', used: 0, limit: 100, unit: 'clips' },
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
}: {
  id: string
  label: string
  hint: string
  defaultChecked?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} defaultChecked={defaultChecked} />
    </div>
  )
}

export function SettingsTabs() {
  const router = useRouter()
  const params = useSearchParams()
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab')! : 'business'
  const testMode = featuresAllUnlocked()

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
        <Panel title="Business profile" description="Shown on exports and team invites.">
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
                    <StatusBadge tone={m.status === 'active' ? 'success' : 'warning'}>
                      {m.status === 'active' ? 'Active' : 'Invited'}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </TabsContent>

      {isT2vFeatureEnabled() ? (
        <TabsContent value="voices">
          <T2vVoicesSettings />
        </TabsContent>
      ) : null}

      <TabsContent value="billing" className="flex flex-col gap-6">
        <Panel
          title={testMode ? 'Test mode' : 'Plan'}
          description={testMode ? 'All features unlocked — billing enforcement ships in M16.' : 'Usage and credits'}
          actions={<Button size="sm" variant="outline">Manage plan</Button>}
        >
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {USAGE.map((u) => {
              const ratio = u.limit ? u.used / u.limit : 0
              return (
                <li key={u.label} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{u.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {u.used.toLocaleString()} / {u.limit.toLocaleString()} {u.unit}
                    </span>
                  </div>
                  <Progress value={ratio * 100} aria-label={`${u.label} usage`} />
                </li>
              )
            })}
          </ul>
        </Panel>
      </TabsContent>

      <TabsContent value="preferences">
        <Panel title="Clips defaults" bodyClassName="divide-y py-0">
          <ToggleRow id="pref-captions" label="Captions on by default" hint="New projects start with animated captions enabled." defaultChecked />
          <ToggleRow id="pref-follow" label="Speaker-follow layout" hint="Default 9:16 crop follows the active speaker." defaultChecked />
        </Panel>
      </TabsContent>

      <TabsContent value="notifications">
        <Panel title="Email notifications" bodyClassName="divide-y py-0">
          <ToggleRow id="n-ready" label="Clips are ready" hint="When processing finishes for a project." defaultChecked />
          <ToggleRow id="n-fail" label="Processing failed" hint="When a project fails and credits are refunded." defaultChecked />
          <ToggleRow id="n-digest" label="Weekly digest" hint="Summary of clips created and exported." />
        </Panel>
      </TabsContent>

      <TabsContent value="security">
        <Panel title="Security" bodyClassName="divide-y py-0">
          <ToggleRow id="s-2fa" label="Require two-factor authentication" hint="All team members must enable 2FA to sign in." />
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Delete workspace</span>
              <p className="text-sm text-muted-foreground">Permanently deletes projects, uploads and exports.</p>
            </div>
            <Button variant="destructive" onClick={() => toast.error('Contact support to delete this workspace.')}>
              Delete
            </Button>
          </div>
        </Panel>
      </TabsContent>
    </Tabs>
  )
}
