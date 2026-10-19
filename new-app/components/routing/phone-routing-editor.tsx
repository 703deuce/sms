'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from '@/components/app/page-primitives'
import { OptionGroup } from '@/components/app/option-group'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { fetchRouting } from '@/lib/phone-api'
import type { RoutePolicy } from '@/lib/data'

export function PhoneRoutingEditor() {
  const { routePolicy, updateRoutePolicy } = useWorkspace()
  const [draft, setDraft] = useState<RoutePolicy>(routePolicy)
  const [greeting, setGreeting] = useState('')
  const [greetingLoaded, setGreetingLoaded] = useState(false)

  useEffect(() => {
    setDraft(routePolicy)
  }, [routePolicy])

  useEffect(() => {
    void fetchRouting()
      .then((data) => {
        if (data.greetingText) setGreeting(data.greetingText)
        else setGreeting('Please leave your name, number, and reason for calling after the tone.')
        setGreetingLoaded(true)
      })
      .catch(() => setGreetingLoaded(true))
  }, [])

  const dirty =
    draft.duringHours !== routePolicy.duringHours ||
    draft.ringStrategy !== routePolicy.ringStrategy ||
    draft.ringTimeout !== routePolicy.ringTimeout ||
    draft.noAnswer !== routePolicy.noAnswer ||
    draft.afterHours !== routePolicy.afterHours ||
    draft.externalForwardE164 !== routePolicy.externalForwardE164

  const set = <K extends keyof RoutePolicy>(k: K, v: RoutePolicy[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const save = () => {
    void (async () => {
      const patch = {
        duringHours: draft.duringHours,
        ringStrategy: draft.ringStrategy,
        ringTimeout: draft.ringTimeout,
        noAnswer: draft.noAnswer,
        afterHours: draft.afterHours,
        externalForwardE164: draft.externalForwardE164,
      }
      await updateRoutePolicy(patch, 'Phone')
      const { saveRouting } = await import('@/lib/phone-api')
      await saveRouting({
        policy: patch,
        greetingText: greeting,
      })
      toast.success('Call handling saved', { description: 'Routing, voicemail greeting, and external forward are live.' })
    })().catch((e) => toast.error(e instanceof Error ? e.message : 'Could not save'))
  }

  const aiOff = routePolicy.aiCoverage === 'off'
  const needsExternal = draft.noAnswer === 'external' || draft.afterHours === 'external'

  return (
    <div className="flex flex-col gap-6">
      <Panel title="During business hours" description="Who rings first when the Main line is called">
        <div className="flex flex-col gap-5">
          <OptionGroup
            label="Ring"
            value={draft.duringHours}
            onChange={(v) => set('duringHours', v)}
            options={[
              { value: 'ring_group', label: 'Browser softphone', description: 'Ring signed-in agents in the browser' },
              { value: 'user', label: 'Specific teammate', description: 'Single assigned user' },
              { value: 'ai', label: 'AI Receptionist first', description: 'Ava answers every call', disabled: aiOff },
              { value: 'voicemail', label: 'Straight to voicemail' },
              { value: 'external', label: 'Forward externally', description: 'Send to another number immediately' },
            ]}
          />
          {(draft.duringHours === 'ring_group' || draft.duringHours === 'user') && (
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
                  max={120}
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
          {needsExternal && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="external-forward">External forward number (E.164)</Label>
              <Input
                id="external-forward"
                value={draft.externalForwardE164}
                onChange={(e) => set('externalForwardE164', e.target.value)}
                placeholder="+13125550100"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Used when routing selects forward externally or no-answer fallback is external.</p>
            </div>
          )}
          {aiOff && <p className="text-xs text-muted-foreground">AI coverage is off. Turn it on in AI Receptionist → Call Handling to route calls to Ava.</p>}
        </div>
      </Panel>

      <Panel title="Voicemail greeting">
        <div className="flex flex-col gap-2">
          <Label htmlFor="greeting" className="sr-only">Greeting text</Label>
          <Textarea
            id="greeting"
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            rows={3}
            disabled={!greetingLoaded}
          />
          <p className="text-xs text-muted-foreground">Read by text-to-speech when callers are sent to voicemail.</p>
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
