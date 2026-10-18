'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from '@/components/app/page-primitives'
import { OptionGroup } from '@/components/app/option-group'
import { useWorkspace } from '@/components/providers/workspace-provider'
import type { RoutePolicy } from '@/lib/data'

export function PhoneRoutingEditor() {
  const { routePolicy, updateRoutePolicy } = useWorkspace()
  const [draft, setDraft] = useState<RoutePolicy>(routePolicy)
  const [greeting, setGreeting] = useState("You've reached Harbor & Pine Dental. Please leave your name, number and reason for calling.")
  const dirty =
    draft.duringHours !== routePolicy.duringHours ||
    draft.ringStrategy !== routePolicy.ringStrategy ||
    draft.ringTimeout !== routePolicy.ringTimeout ||
    draft.noAnswer !== routePolicy.noAnswer ||
    draft.afterHours !== routePolicy.afterHours

  const set = <K extends keyof RoutePolicy>(k: K, v: RoutePolicy[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const save = () => {
    updateRoutePolicy(
      { duringHours: draft.duringHours, ringStrategy: draft.ringStrategy, ringTimeout: draft.ringTimeout, noAnswer: draft.noAnswer, afterHours: draft.afterHours },
      'Phone',
    )
    toast.success('Call handling saved', { description: 'AI Receptionist and Missed Call Text Back now reflect this routing.' })
  }

  const aiOff = routePolicy.aiCoverage === 'off'

  return (
    <div className="flex flex-col gap-6">
      <Panel title="During business hours" description="Who rings first when the Main line is called">
        <div className="flex flex-col gap-5">
          <OptionGroup
            label="Ring"
            value={draft.duringHours}
            onChange={(v) => set('duringHours', v)}
            options={[
              { value: 'ring_group', label: 'Front desk ring group', description: 'Maya, Daniel, Priya' },
              { value: 'user', label: 'Specific teammate', description: 'Priya Natarajan' },
              { value: 'ai', label: 'AI Receptionist first', description: 'Ava answers every call', disabled: aiOff },
              { value: 'voicemail', label: 'Straight to voicemail' },
            ]}
          />
          {draft.duringHours === 'ring_group' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <OptionGroup
                label="Ring strategy"
                value={draft.ringStrategy}
                onChange={(v) => set('ringStrategy', v)}
                columns={1}
                options={[
                  { value: 'simultaneous', label: 'Simultaneous', description: 'Everyone rings at once' },
                  { value: 'sequential', label: 'Sequential', description: 'In listed order' },
                ]}
              />
              <div className="flex flex-col gap-2">
                <Label htmlFor="timeout">Ring timeout (seconds)</Label>
                <Input
                  id="timeout"
                  type="number"
                  min={10}
                  max={60}
                  value={draft.ringTimeout}
                  onChange={(e) => set('ringTimeout', Number(e.target.value))}
                  className="w-28 tabular"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">After this, the no-answer fallback takes over.</p>
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Fallbacks">
        <div className="flex flex-col gap-6">
          <OptionGroup
            label="If nobody answers or the line is busy"
            value={draft.noAnswer}
            onChange={(v) => set('noAnswer', v)}
            columns={3}
            options={[
              { value: 'ai', label: 'AI Receptionist', disabled: aiOff },
              { value: 'voicemail', label: 'Voicemail' },
              { value: 'external', label: 'Forward to external' },
            ]}
          />
          <OptionGroup
            label="Outside business hours"
            value={draft.afterHours}
            onChange={(v) => set('afterHours', v)}
            columns={3}
            options={[
              { value: 'ai', label: 'AI Receptionist', disabled: aiOff },
              { value: 'voicemail', label: 'Voicemail' },
              { value: 'external', label: 'Forward to external' },
            ]}
          />
          {aiOff && <p className="text-xs text-muted-foreground">AI coverage is off. Turn it on in AI Receptionist → Call Handling to route calls to Ava.</p>}
        </div>
      </Panel>

      <Panel title="Voicemail greeting">
        <div className="flex flex-col gap-2">
          <Label htmlFor="greeting" className="sr-only">Greeting text</Label>
          <Textarea id="greeting" value={greeting} onChange={(e) => setGreeting(e.target.value)} rows={3} />
          <p className="text-xs text-muted-foreground">Read by text-to-speech. Upload a recording in Settings → Phone.</p>
        </div>
      </Panel>

      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl surface p-3 shadow-sm">
        <span className="text-sm text-muted-foreground">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(routePolicy)}>
            Discard
          </Button>
          <Button disabled={!dirty} onClick={save}>
            Save routing
          </Button>
        </div>
      </div>
    </div>
  )
}
