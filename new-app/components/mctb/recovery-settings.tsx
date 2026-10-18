'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from '@/components/app/page-primitives'
import { SimpleSelect } from '@/components/app/filters'
import { SettingRow } from '@/components/app/option-group'
import { StatusBadge } from '@/components/app/status'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { BUSINESS, NUMBERS } from '@/lib/data'
import { formatPhone } from '@/lib/format'

const STOP_FOOTER = ' Reply STOP to opt out.'

export function RecoverySettings() {
  const { routePolicy, updateRoutePolicy } = useWorkspace()
  const [prompt, setPrompt] = useState(`Sorry we missed you. Press 1 and ${BUSINESS.name} will text you right away. Message and data rates may apply.`)
  const [template, setTemplate] = useState(`Hi, it's ${BUSINESS.name} — sorry we missed your call! Reply here or book online: hp.dental/book.`)
  const [lines, setLines] = useState(() => new Set(NUMBERS.filter((n) => n.products.includes('mctb')).map((n) => n.id)))
  const [repeatWindow, setRepeatWindow] = useState<'1h' | '24h' | '7d'>('24h')
  const [quiet, setQuiet] = useState(true)
  const [skipKnown, setSkipKnown] = useState(false)
  const [dirty, setDirty] = useState(false)

  const full = template + STOP_FOOTER
  const segments = Math.ceil(full.length / 160)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Panel>
          <SettingRow
            title="Missed Call Text Back"
            description="Runs only after the routing chain ends with no answer from a person or Ava."
            control={
              <Switch
                checked={routePolicy.mctbEnabled}
                onCheckedChange={(v) => {
                  updateRoutePolicy({ mctbEnabled: v }, 'Missed Call Text Back')
                }}
                aria-label="Enable Missed Call Text Back"
              />
            }
          />
        </Panel>

        <fieldset disabled={!routePolicy.mctbEnabled} className="flex flex-col gap-6 disabled:opacity-60">
          <Panel title="Consent prompt" description="Played to the caller. Texts are sent only if they press 1.">
            <Label htmlFor="prompt" className="sr-only">Consent prompt</Label>
            <Textarea id="prompt" rows={3} value={prompt} onChange={(e) => (setPrompt(e.target.value), setDirty(true))} />
          </Panel>

          <Panel title="Text message">
            <div className="flex flex-col gap-2">
              <Label htmlFor="template" className="sr-only">Message template</Label>
              <Textarea id="template" rows={3} value={template} onChange={(e) => (setTemplate(e.target.value), setDirty(true))} />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>“Reply STOP to opt out.” is appended automatically.</span>
                <span className="tabular-nums">
                  {full.length} chars · {segments} segment{segments > 1 ? 's' : ''}
                </span>
              </div>
              <div className="mt-2 max-w-sm self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">{full}</div>
            </div>
          </Panel>

          <Panel title="Lines" description="Recovery texts send from the number the caller dialed">
            <ul className="flex flex-col gap-3">
              {NUMBERS.map((n) => {
                const disabled = !n.sms || n.status === 'disconnected'
                return (
                  <li key={n.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`line-${n.id}`}
                      checked={lines.has(n.id)}
                      disabled={disabled}
                      onCheckedChange={(v) => {
                        setLines((s) => {
                          const next = new Set(s)
                          if (v) next.add(n.id)
                          else next.delete(n.id)
                          return next
                        })
                        setDirty(true)
                      }}
                    />
                    <Label htmlFor={`line-${n.id}`} className="flex flex-1 flex-col items-start gap-0.5 font-normal">
                      <span className="text-sm font-medium">{n.label}</span>
                      <span className="text-xs text-muted-foreground">{formatPhone(n.number)}</span>
                    </Label>
                    {!n.sms && <StatusBadge tone="muted">SMS unavailable</StatusBadge>}
                    {n.status === 'pending_verification' && <StatusBadge tone="warning">Verify forwarding</StatusBadge>}
                  </li>
                )
              })}
            </ul>
          </Panel>

          <Panel title="Suppression">
            <div className="divide-y">
              <SettingRow
                title="Don't re-text the same caller within"
                control={
                  <SimpleSelect
                    label="Repeat window"
                    value={repeatWindow}
                    onChange={(v) => (setRepeatWindow(v), setDirty(true))}
                    options={[
                      { value: '1h', label: '1 hour' },
                      { value: '24h', label: '24 hours' },
                      { value: '7d', label: '7 days' },
                    ]}
                    className="w-32"
                  />
                }
              />
              <SettingRow
                title="Quiet hours (9 PM – 8 AM)"
                description="Texts queue and send at 8 AM the caller's local time."
                control={<Switch checked={quiet} onCheckedChange={(v) => (setQuiet(v), setDirty(true))} aria-label="Quiet hours" />}
              />
              <SettingRow
                title="Skip existing customers"
                description="Only text unknown numbers and leads."
                control={<Switch checked={skipKnown} onCheckedChange={(v) => (setSkipKnown(v), setDirty(true))} aria-label="Skip existing customers" />}
              />
            </div>
          </Panel>
        </fieldset>

        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl surface p-3 shadow-sm">
          <span className="text-sm text-muted-foreground">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
          <Button disabled={!dirty} onClick={() => (setDirty(false), toast.success('Recovery settings saved'))}>
            Save
          </Button>
        </div>
      </div>

      <aside className="flex flex-col gap-6">
        <Panel title="Messaging compliance" actions={<StatusBadge tone="success">Approved</StatusBadge>}>
          <div className="flex gap-3 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <p className="leading-relaxed text-muted-foreground">
              A2P 10DLC brand and campaign registered for {BUSINESS.name}. Opt-outs are honored across all lines automatically.
            </p>
          </div>
        </Panel>
        <Panel title="How it works">
          <ol className="flex list-decimal flex-col gap-2 pl-4 text-sm leading-relaxed text-muted-foreground">
            <li>Call rings your team, then Ava (if on).</li>
            <li>If nobody answers, the caller hears the consent prompt.</li>
            <li>Pressing 1 records consent and sends the text.</li>
            <li>Replies land in Conversations and the Inbox.</li>
          </ol>
        </Panel>
      </aside>
    </div>
  )
}
