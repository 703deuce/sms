'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, BrainCircuit, ChevronRight, ClipboardList, Lock, MessageCircle, Pause, Play, Plus, ShieldCheck, Sparkles, Trash2, UserRound, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SimpleSelect } from '@/components/app/filters'
import { StatusBadge } from '@/components/app/status'
import { useAgent } from '@/components/providers/agent-provider'
import { CAPABILITY_META, GREETING_VARIABLES, renderGreeting, VOICES, type AgentConfig, type Capability, type IntakeField } from '@/lib/agent'
import { Callout } from '@/components/numbers/number-ui'
import { cn } from '@/lib/utils'
import { DemoNote, JumpChips, NotAvailable, Pills, Section, ToggleRow } from './ai-ui'

const STAGE_LABEL: Record<IntakeField['stage'], string> = { start: 'Start of call', before_booking: 'Before booking', before_transfer: 'Before transfer', end: 'End of call' }
const TYPE_LABEL: Record<IntakeField['type'], string> = { text: 'Text', phone: 'Phone', email: 'Email', choice: 'Choice', date: 'Date', zip: 'ZIP' }

export function AgentEditor() {
  const { draft, update } = useAgent()
  const [previewing, setPreviewing] = useState<string | null>(null)
  const id = draft.identity

  const playVoice = async (voice: string) => {
    if (voice === 'greeting') {
      setPreviewing(voice)
      try {
        const res = await fetch('/api/receptionist/voice-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voice: id.voice,
            text: renderGreeting(id.greeting, id.name),
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Preview failed')
        const url = json.data?.audioUrl as string
        if (url) {
          const audio = new Audio(url)
          await audio.play()
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not play preview')
      } finally {
        setPreviewing(null)
      }
      return
    }
    setPreviewing(voice)
    try {
      const res = await fetch('/api/receptionist/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Preview failed')
      const url = json.data?.audioUrl as string
      if (url) {
        const audio = new Audio(url)
        await audio.play()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not play voice preview')
    } finally {
      setPreviewing(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <JumpChips items={[{ id: 'identity', label: 'Identity & voice' }, { id: 'greeting', label: 'Greeting' }, { id: 'style', label: 'Style' }, { id: 'capabilities', label: 'Capabilities' }, { id: 'intake', label: 'Intake & qualification' }, { id: 'instructions', label: 'Instructions' }, { id: 'memory', label: 'Memory & CRM' }]} />

      <Section id="identity" icon={UserRound} title="Identity & voice" description="Who answers, and how she sounds.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2"><Label htmlFor="a-name">Agent name</Label><Input id="a-name" value={id.name} onChange={(e) => update('identity', (i) => ({ ...i, name: e.target.value }))} /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="a-role">Role</Label><Input id="a-role" value={id.role} onChange={(e) => update('identity', (i) => ({ ...i, role: e.target.value }))} /></div>
          <div className="flex flex-col gap-2">
            <Label>Language</Label>
            <SimpleSelect label="Language" value={id.language} onChange={(v) => update('identity', (i) => ({ ...i, language: v }))} options={[{ value: 'en-US', label: 'English (US)' }, { value: 'es-US', label: 'Spanish (US)' }, { value: 'en-es', label: 'English + Spanish' }]} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Voice</span>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {VOICES.map((v) => {
              const sel = id.voice === v.id
              return (
                <div key={v.id} className={cn('flex items-center gap-3 rounded-lg surface p-3 transition-all', sel && 'ring-2 ring-primary')}>
                  <button type="button" aria-label={`Preview ${v.name}`} onClick={() => playVoice(v.id)} className={cn('flex size-9 shrink-0 items-center justify-center rounded-full transition-colors', previewing === v.id ? 'tile-primary' : 'bg-muted text-foreground hover:bg-accent')}>
                    {previewing === v.id ? <Pause className="size-4" /> : <Play className="size-4" />}
                  </button>
                  <button type="button" onClick={() => update('identity', (i) => ({ ...i, voice: v.id }))} aria-pressed={sel} className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="flex items-center gap-2 text-sm font-medium">{v.name}{v.recommended && <StatusBadge tone="info">Recommended</StatusBadge>}</span>
                    <span className="truncate text-xs text-muted-foreground">{v.note}</span>
                  </button>
                </div>
              )
            })}
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">Custom voice ID</summary>
            <div className="flex flex-col gap-1 pt-2">
              <Input aria-label="Custom OpenAI Live voice" placeholder="marin" value={id.customVoiceId} onChange={(e) => update('identity', (i) => ({ ...i, customVoiceId: e.target.value }))} />
              <span>GPT-Live-1 voice id (all 22 built-in voices). Leave blank to use the voice above.</span>
            </div>
          </details>
        </div>
      </Section>

      <Section id="greeting" icon={MessageCircle} title="Greeting" description="Ava&apos;s first words after any connection audio.">
        <div className="flex flex-col gap-2">
          <Label htmlFor="greet">Opening line</Label>
          <Textarea id="greet" rows={3} value={id.greeting} onChange={(e) => update('identity', (i) => ({ ...i, greeting: e.target.value }))} />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Insert</span>
            {GREETING_VARIABLES.map((v) => (
              <button key={v} type="button" onClick={() => update('identity', (i) => ({ ...i, greeting: `${i.greeting} ${v}`.trim() }))} className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground">{v}</button>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
          <Button variant="outline" size="icon-sm" aria-label="Hear greeting" onClick={() => playVoice('greeting')}>{previewing === 'greeting' ? <Pause /> : <Play />}</Button>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted-foreground">Caller hears</span>
            <p className="text-sm leading-relaxed text-pretty">&ldquo;{renderGreeting(id.greeting, id.name)}&rdquo;</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Recording notices and connection audio are set in{' '}
          <Link href="/app/receptionist/call-handling#advanced" className="font-medium text-primary hover:underline">Call handling → Advanced</Link>.
        </p>
      </Section>

      <Section id="style" icon={Wand2} title="Conversation style" description="Pacing and turn-taking.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Pills label="Speaking pace" value={draft.style.pace} onChange={(v) => update('style', (s) => ({ ...s, pace: v }))} options={[{ value: 'slow', label: 'Slower' }, { value: 'normal', label: 'Natural' }, { value: 'fast', label: 'Brisk' }]} />
          <Pills label="Backchannels" value={draft.style.backchannels} onChange={(v) => update('style', (s) => ({ ...s, backchannels: v }))} options={[{ value: 'none', label: 'None' }, { value: 'minimal', label: 'Minimal' }, { value: 'natural', label: 'Natural' }]} />
          <Pills label="Patience before replying" value={draft.style.patience} onChange={(v) => update('style', (s) => ({ ...s, patience: v }))} options={[{ value: 'quick', label: 'Quick' }, { value: 'normal', label: 'Balanced' }, { value: 'patient', label: 'Patient' }]} />
          <Pills label="When interrupted" value={draft.style.interruptions} onChange={(v) => update('style', (s) => ({ ...s, interruptions: v }))} options={[{ value: 'natural', label: 'Finish thought' }, { value: 'yield', label: 'Stop & listen' }]} />
        </div>
      </Section>

      <Section id="capabilities" icon={Sparkles} title="Capabilities" description="What Ava is allowed to do on a call.">
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(CAPABILITY_META) as Capability[]).map((k) => {
            const m = CAPABILITY_META[k]
            const on = draft.capabilities[k]
            const blocked = (k === 'reschedule' || k === 'cancel') && !draft.capabilities.book
            return (
              <div key={k} className={cn('flex flex-col gap-2 rounded-lg surface p-3.5 transition-all', on && !blocked && 'ring-1 ring-primary/40')}>
                <ToggleRow title={m.title} description={m.description} checked={on && !blocked} disabled={blocked || !m.supported} onChange={(v) => update('capabilities', (c) => ({ ...c, [k]: v }))} />
                <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
                  <span>{blocked ? 'Requires booking' : m.depends ? `Uses ${m.depends}` : 'No setup needed'}</span>
                  {m.configure && (
                    m.configure.startsWith('#')
                      ? <a href={m.configure} className="flex items-center gap-0.5 font-medium text-primary hover:underline">Configure<ChevronRight className="size-3" /></a>
                      : <Link href={m.configure} className="flex items-center gap-0.5 font-medium text-primary hover:underline">Configure<ChevronRight className="size-3" /></Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <Callout icon={ShieldCheck} title="Always on">Ava never gives medical, legal or financial advice, never shares other callers&apos; information, and always offers a human when asked. These guardrails can&apos;t be turned off.</Callout>
      </Section>

      <Section id="intake" icon={ClipboardList} title="Intake & qualification" description="What Ava asks, when, and who qualifies.">
        <IntakeEditor />
        {draft.capabilities.qualify ? <QualificationEditor /> : (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            Qualification rules are off. Turn on &ldquo;Qualify callers&rdquo; in Capabilities to use them.
            <Button variant="outline" size="sm" onClick={() => update('capabilities', (c) => ({ ...c, qualify: true }))}>Turn on</Button>
          </div>
        )}
      </Section>

      <Section id="instructions" icon={BrainCircuit} title="Conversation instructions" description="Business-specific guidance in plain language.">
        <Textarea aria-label="Conversation instructions" rows={5} value={draft.instructions} onChange={(e) => update('instructions', e.target.value)} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{draft.instructions.length} / 2,000 characters</span>
          <span>Safety guardrails always override these instructions.</span>
        </div>
      </Section>

      <Section id="memory" icon={Lock} title="Memory & CRM" defaultOpen={false} description="What Ava remembers between calls.">
        <ToggleRow title="Remember returning callers" description="Greets known contacts by name and recalls their last visit. Uses Contacts only." checked={draft.memory} onChange={(v) => update('memory', v)} />
        <ToggleRow title="Write call outcomes to CRM" description="Requires a connected CRM in Integrations." checked={draft.crmWrite} disabled onChange={(v) => update('crmWrite', v)} badge={<NotAvailable label="Connect a CRM" />} action={<Link href="/app/integrations" className="text-xs font-medium text-primary hover:underline">Open Integrations</Link>} />
      </Section>

      <DemoNote />
    </div>
  )
}

function IntakeEditor() {
  const { draft, update } = useAgent()
  const set = (fn: (l: IntakeField[]) => IntakeField[]) => update('intake', fn)
  const move = (i: number, d: -1 | 1) => set((l) => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n })

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Intake fields</span>
      <div className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/8">
        {draft.intake.map((f, i) => (
          <div key={f.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="flex flex-col">
              <Button variant="ghost" size="icon-xs" aria-label={`Move ${f.label} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
              <Button variant="ghost" size="icon-xs" aria-label={`Move ${f.label} down`} disabled={i === draft.intake.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
            </div>
            <div className="flex min-w-40 flex-1 flex-col gap-1">
              {f.locked ? (
                <span className="flex items-center gap-1.5 text-sm font-medium"><Lock className="size-3 text-muted-foreground" aria-hidden />{f.label}</span>
              ) : (
                <Input aria-label="Field label" className="h-8" value={f.label} onChange={(e) => set((l) => l.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))} />
              )}
              <span className="text-xs text-muted-foreground">{TYPE_LABEL[f.type]}{f.options ? ` · ${f.options.length} options` : ''}</span>
            </div>
            <SimpleSelect label={`${f.label} stage`} className="w-40" value={f.stage} onChange={(v) => set((l) => l.map((x) => (x.id === f.id ? { ...x, stage: v } : x)))} options={(Object.keys(STAGE_LABEL) as IntakeField['stage'][]).map((s) => ({ value: s, label: STAGE_LABEL[s] }))} />
            <label className="flex items-center gap-1.5 text-xs font-medium">
              <input type="checkbox" className="accent-[var(--primary)]" checked={f.required} disabled={f.locked && f.required} onChange={(e) => set((l) => l.map((x) => (x.id === f.id ? { ...x, required: e.target.checked } : x)))} />
              Required
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium">
              <input type="checkbox" className="accent-[var(--primary)]" checked={f.qualifies} onChange={(e) => set((l) => l.map((x) => (x.id === f.id ? { ...x, qualifies: e.target.checked } : x)))} />
              Qualifies
            </label>
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${f.label}`} disabled={f.locked} onClick={() => set((l) => l.filter((x) => x.id !== f.id))}><Trash2 /></Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="self-start" onClick={() => set((l) => [...l, { id: `i_${Date.now()}`, label: 'New question', type: 'text', required: false, qualifies: false, stage: 'before_booking' }])}><Plus data-icon="inline-start" />Add field</Button>
    </div>
  )
}

function QualificationEditor() {
  const { draft, update } = useAgent()
  const q = draft.qualification
  const fields = draft.intake.filter((f) => f.qualifies)
  const setQ = (patch: Partial<AgentConfig['qualification']>) => update('qualification', (x) => ({ ...x, ...patch }))

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/30 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Caller qualifies when</span>
        <SimpleSelect label="Match" className="w-24" value={q.match} onChange={(v) => setQ({ match: v })} options={[{ value: 'all', label: 'all' }, { value: 'any', label: 'any' }]} />
        <span className="text-muted-foreground">rules match</span>
      </div>
      {q.rules.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2">
          <SimpleSelect label="Field" className="w-44" value={r.field} onChange={(v) => setQ({ rules: q.rules.map((x) => (x.id === r.id ? { ...x, field: v } : x)) })} options={(fields.length ? fields : draft.intake).map((f) => ({ value: f.label, label: f.label }))} />
          <SimpleSelect label="Operator" className="w-32" value={r.operator} onChange={(v) => setQ({ rules: q.rules.map((x) => (x.id === r.id ? { ...x, operator: v } : x)) })} options={[{ value: 'in', label: 'is in' }, { value: 'not_in', label: 'is not in' }, { value: 'equals', label: 'equals' }]} />
          <Input aria-label="Values" className="min-w-40 flex-1" value={r.values} onChange={(e) => setQ({ rules: q.rules.map((x) => (x.id === r.id ? { ...x, values: e.target.value } : x)) })} />
          <Button variant="ghost" size="icon-sm" aria-label="Remove rule" onClick={() => setQ({ rules: q.rules.filter((x) => x.id !== r.id) })}><Trash2 /></Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={() => setQ({ rules: [...q.rules, { id: `q_${Date.now()}`, field: fields[0]?.label ?? draft.intake[0].label, operator: 'equals', values: '' }] })}><Plus data-icon="inline-start" />Add rule</Button>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">If not qualified</span>
          <SimpleSelect label="Fallback" className="w-44" value={q.fallback} onChange={(v) => setQ({ fallback: v })} options={[{ value: 'callback', label: 'Offer a callback' }, { value: 'transfer', label: 'Transfer to staff' }, { value: 'decline', label: 'Politely decline' }]} />
        </div>
      </div>
      <button type="button" onClick={() => toast('Ava would ask for ZIP, then offer a callback for 60640.')} className="self-start text-xs font-medium text-primary hover:underline">Try a sample caller</button>
    </div>
  )
}
