'use client'

/**
 * GB-18 pages: Team (named agents), Business brain (shared facts every agent knows) and Goals.
 * Runner contract: agentlab-takeover-kit/docs/GB14_API.md ("GB-18 team"). Design: GB-17 SPEC (OpsPage, Kpi, Panel, Drawer).
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, BookOpen, Check, Loader2, MessageSquare, Pencil, Plus, Target, Trash2, Users } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { displayName, formatWhen } from '@/lib/agent-lab/ops'
import { cn } from '@/lib/utils'
import { AVATARS, HANDOFF_OPEN, agentHref, fmtNum, goalPct, handoffLabel, type BrainEntry, type Goal, type Handoff, type TeamAgent } from '@/lib/agent-lab/team'
import { MODE_LABEL, fromUnix, gbPost, gbUrl, type Mode } from '@/components/agent-lab/ops/gb14'
import { Drawer, Kpi, KpiGrid, Panel, PropList, SearchBox, Segmented, Toolbar } from '@/components/agent-lab/ops/ops-kit'
import { OpsCard, OpsEmpty, OpsError, OpsLoading, OpsPage, Pill } from '@/components/agent-lab/ops/ops-ui'
import { usePolled } from '@/components/agent-lab/ops/use-ops-data'
import { AgentAvatar } from './agent-avatar'
import { CreateAgentDialog } from './create-agent-dialog'
import { teamChanged, useAgents } from './use-team'

const when = (t: number | null | undefined) => (t ? formatWhen(fromUnix(t)) : '—')
const MODES: Mode[] = ['supervised', 'selective', 'full']
const MODELS = [
  { value: '', label: 'Automatic' },
  { value: 'ember', label: 'Ember' },
  { value: 'haiku', label: 'Haiku' },
]
const fieldCls = 'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

function GoalBar({ g }: { g: Goal }) {
  const pct = goalPct(g)
  const tone = g.status === 'achieved' ? 'bg-success' : g.status === 'missed' ? 'bg-destructive' : 'bg-primary'
  return (
    <div className="flex flex-col gap-1">
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${Math.max(2, Math.min(100, pct ?? 0))}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {fmtNum(g.current)} of {fmtNum(g.target)} {g.unit || ''}
        </span>
        <span>{pct == null ? 'No target' : `${pct}%`}</span>
      </div>
    </div>
  )
}

function goalTone(g: Goal) {
  return g.status === 'achieved' ? 'success' : g.status === 'missed' ? 'danger' : g.status === 'active' ? 'info' : 'muted'
}

function daysLeft(deadline?: string | null): string | null {
  if (!deadline) return null
  const d = new Date(`${deadline.slice(0, 10)}T23:59:59`)
  if (Number.isNaN(d.getTime())) return null
  const n = Math.ceil((d.getTime() - Date.now()) / 86_400_000)
  return n < 0 ? `${-n} days past due` : n === 0 ? 'Due today' : `${n} days left`
}

/* ------------------------------------------------------------------------------------------------ Team */

type AgentDetail = TeamAgent & {
  goals: Goal[]
  delegations: Handoff[]
  conversations: string[]
  permissions: { mode: Mode | null; rules: Record<string, string> }[]
}
type SkillRow = { id: string; name: string; description: string; tier: 'agent' | 'global'; overridden?: boolean }
type MemRow = { id: number; type?: string; text: string; created_at?: string | number }

export function TeamPage() {
  const router = useRouter()
  const params = useSearchParams()
  const open = params?.get('agent') ?? null
  const agents = useAgents()
  const handoffs = usePolled<{ items: Handoff[] }>(gbUrl('delegations?limit=30'), 15_000)
  const [creating, setCreating] = useState(false)
  const items = agents.data?.items ?? []
  const hs = handoffs.data?.items ?? []
  const setOpen = (id: string | null) => router.replace(id ? `/app/agent-lab/team?agent=${encodeURIComponent(id)}` : '/app/agent-lab/team', { scroll: false })

  return (
    <OpsPage
      icon={Users}
      title="Team"
      description="Your agents. Each one has its own chat, instructions, memory, skills and goals. They share your connected apps, logins, email, phone number and business brain, and can hand work to each other."
      actions={
        <Button className="gap-2" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New agent
        </Button>
      }
    >
      <KpiGrid>
        <Kpi label="Agents" value={agents.data ? items.length : '—'} icon={Users} />
        <Kpi label="Working now" value={agents.data ? items.filter((a) => a.running).length : '—'} tone="success" />
        <Kpi label="Hand-offs in progress" value={handoffs.data ? hs.filter((h) => HANDOFF_OPEN.has(h.status)).length : '—'} tone="info" />
        <Kpi label="Active goals" value={agents.data ? items.reduce((n, a) => n + (a.goals_active ?? 0), 0) : '—'} icon={Target} />
      </KpiGrid>

      {agents.loading && !agents.data ? (
        <OpsLoading />
      ) : agents.error && !agents.data ? (
        <OpsError message="Your team isn't available right now." onRetry={agents.reload} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <OpsCard key={a.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <AgentAvatar avatar={a.avatar} name={a.name} size="lg" running={a.running} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{a.name}</p>
                    {a.is_default ? <Pill tone="neutral">Default</Pill> : null}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{a.role || 'No role yet'}</p>
                </div>
                <Pill tone={a.running ? 'success' : 'muted'}>{a.running ? 'Working' : 'Idle'}</Pill>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md bg-secondary/60 px-2 py-1.5">
                  <div className="text-sm font-semibold">{a.goals_active ?? 0}</div>
                  <div className="text-muted-foreground">Goals</div>
                </div>
                <div className="rounded-md bg-secondary/60 px-2 py-1.5">
                  <div className="text-sm font-semibold">{a.own_skills ?? 0}</div>
                  <div className="text-muted-foreground">Own skills</div>
                </div>
                <div className="rounded-md bg-secondary/60 px-2 py-1.5">
                  <div className="text-sm font-semibold">{a.handoffs_open ?? 0}</div>
                  <div className="text-muted-foreground">Hand-offs</div>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Active {when(a.last_activity_at)}</span>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setOpen(a.id)}>
                    Settings
                  </Button>
                  <Link href={agentHref(a.id)} className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}>
                    <MessageSquare className="size-3.5" /> Chat
                  </Link>
                </div>
              </div>
            </OpsCard>
          ))}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-foreground"
          >
            <Plus className="size-5" /> Add an agent
            <span className="max-w-60 text-center text-xs">Marketing, sales, research… give it a role and it gets its own chat.</span>
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Hand-offs between agents">
          {hs.length === 0 ? (
            <p className="text-sm text-muted-foreground">When one agent asks another for help, it shows up here and in both chats.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {hs.slice(0, 12).map((h) => (
                <li key={h.id} className="flex items-start gap-3 py-2.5">
                  <div className="flex shrink-0 items-center gap-1 pt-0.5">
                    <AgentAvatar avatar={h.from_avatar} name={h.from_name} size="sm" />
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <AgentAvatar avatar={h.to_avatar} name={h.to_name} size="sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{h.from_name}</span> asked <span className="font-medium">{h.to_name}</span>
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{h.task}</p>
                    {h.result && h.status === 'done' ? <p className="mt-1 line-clamp-2 text-xs">↳ {h.result}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Pill tone={h.status === 'done' ? 'success' : h.status === 'failed' || h.status === 'cancelled' ? 'warning' : 'info'}>{handoffLabel(h)}</Pill>
                    <span className="text-[11px] text-muted-foreground">{when(h.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Shared vs. per agent">
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Shared by every agent</p>
              <ul className="list-inside list-disc text-muted-foreground">
                {(agents.data?.split?.shared ?? []).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">Connect an app once and every agent can use it.</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Each agent has its own</p>
              <ul className="list-inside list-disc text-muted-foreground">
                {(agents.data?.split?.per_agent ?? []).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>
      </div>

      <CreateAgentDialog open={creating} onOpenChange={setCreating} />
      <AgentDrawer id={open} onClose={() => setOpen(null)} onChanged={agents.reload} />
    </OpsPage>
  )
}

function AgentDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const detail = usePolled<AgentDetail>(id ? gbUrl(`agents/${encodeURIComponent(id)}`) : null, 30_000)
  const skills = usePolled<{ agent: SkillRow[]; global: SkillRow[] }>(id ? gbUrl(`agents/${encodeURIComponent(id)}/skills`) : null, 120_000)
  const memory = usePolled<{ agent: MemRow[]; shared: MemRow[]; brain: BrainEntry[] }>(id ? gbUrl(`agents/${encodeURIComponent(id)}/memory`) : null, 120_000)
  const resps = usePolled<{ items: { id: string; name?: string; title?: string; schedule?: string; status?: string }[] }>(
    id ? gbUrl(`responsibilities?agent=${encodeURIComponent(id)}`) : null,
    60_000,
  )
  const a = detail.data
  const [tab, setTab] = useState<'profile' | 'memory' | 'work'>('profile')
  const [form, setForm] = useState({ name: '', role: '', instructions: '', avatar: '', model: '', phone_number: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (a) setForm({ name: a.name, role: a.role ?? '', instructions: a.instructions ?? '', avatar: a.avatar ?? '', model: a.model ?? '', phone_number: a.phone_number ?? '' })
    // reset only when another agent opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id])
  useEffect(() => {
    setTab('profile')
    setMsg(null)
  }, [id])

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      setMsg(ok)
      detail.reload()
      onChanged()
      teamChanged()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  const mode = (a?.permissions?.[0]?.mode ?? null) as Mode | null
  const own = skills.data?.agent ?? []
  const glob = skills.data?.global ?? []
  const items = resps.data?.items ?? []

  return (
    <Drawer
      open={Boolean(id)}
      onOpenChange={(o) => !o && onClose()}
      title={
        a ? (
          <span className="flex items-center gap-2">
            <AgentAvatar avatar={a.avatar} name={a.name} running={a.running} /> {a.name}
          </span>
        ) : (
          'Agent'
        )
      }
      description={a?.role || undefined}
      footer={
        a ? (
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                className="text-destructive"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Remove ${a.name}? Its chat and history stay on record.`)) void run(() => gbPost(`agents/${a.id}/archive`), 'Removed').then(onClose)
                }}
              >
                <Trash2 className="size-4" /> Remove agent
              </Button>
              {!a.is_default ? (
                <Button variant="ghost" disabled={busy} title="Chats, calls and routines not tied to another agent go to the default agent" onClick={() => void run(() => gbPost('team/default', { agent_id: a.id }), 'Default agent changed')}>
                  Make default
                </Button>
              ) : null}
            </div>
            <Link href={agentHref(a.id)} className={cn(buttonVariants(), 'gap-1.5')}>
              <MessageSquare className="size-4" /> Open chat
            </Link>
          </div>
        ) : null
      }
    >
      {!a ? (
        detail.error ? <OpsError message="This agent isn't available." onRetry={detail.reload} /> : <OpsLoading />
      ) : (
        <div className="flex flex-col gap-4">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'profile', label: 'Profile' },
              { value: 'memory', label: 'Memory & skills' },
              { value: 'work', label: 'Goals & work' },
            ]}
          />
          {msg ? <p className="rounded-md bg-secondary px-3 py-2 text-xs">{msg}</p> : null}

          {tab === 'profile' && (
            <div className="flex flex-col gap-4">
              <Field label="Name">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={a.is_default && false} />
              </Field>
              <Field label="Role">
                <Input value={form.role} placeholder="What this agent is responsible for" onChange={(e) => setForm({ ...form, role: e.target.value })} />
              </Field>
              <Field label="Instructions and personality" hint="How it should work and sound. Only this agent sees these.">
                <Textarea rows={5} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
              </Field>
              <Field label="Avatar">
                <div className="flex flex-wrap gap-1.5">
                  {AVATARS.map((x) => (
                    <button
                      key={x}
                      type="button"
                      onClick={() => setForm({ ...form, avatar: x })}
                      className={cn('grid size-9 place-items-center rounded-lg border text-lg', form.avatar === x ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted')}
                    >
                      {x}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Model">
                  <select className={fieldCls} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}>
                    {MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Phone number" hint="Leave empty to share your main number.">
                  <Input value={form.phone_number} placeholder="Shared main number" onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
                </Field>
              </div>
              <Button
                className="self-start"
                disabled={busy || !form.name.trim()}
                onClick={() => void run(() => gbPost(`agents/${a.id}`, form), 'Saved')}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save
              </Button>
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <p className="text-sm font-medium">Autonomy</p>
                <p className="text-xs text-muted-foreground">How much this agent may do on its own with your apps. Default follows your workspace setting on Permissions.</p>
                <div className="inline-flex flex-wrap self-start rounded-lg border border-border bg-card p-0.5">
                  {[null, ...MODES].map((m) => (
                    <button
                      key={m ?? 'default'}
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => gbPost('permissions/set', { scope: 'member', member_id: a.id, mode: m ?? '' }), 'Autonomy updated')}
                      className={cn('rounded-md px-2.5 py-1 text-xs font-medium', mode === m ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
                    >
                      {m ? MODE_LABEL[m] : 'Default'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'memory' && (
            <div className="flex flex-col gap-4">
              <Panel title={`${a.name}'s own skills (${own.length})`}>
                {own.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None yet. Ask {a.name} in chat to save one; it will only be used by {a.name} and wins over a shared skill with the same name.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {own.map((s) => (
                      <li key={s.id} className="text-sm">
                        <span className="font-medium">{displayName(s.name) || s.name}</span>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title={`Shared skills (${glob.length})`}>
                <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                  {glob.map((s) => (
                    <li key={s.id} className={cn('text-sm', s.overridden && 'opacity-60')}>
                      <span className="font-medium">{displayName(s.name) || s.name}</span>
                      {s.overridden ? <span className="ml-2 text-xs text-muted-foreground">replaced by {a.name}&apos;s own</span> : null}
                      <p className="line-clamp-1 text-xs text-muted-foreground">{s.description}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title={`What ${a.name} remembers (${memory.data?.agent.length ?? 0})`}>
                {(memory.data?.agent ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing of its own yet.</p>
                ) : (
                  <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto text-sm">
                    {memory.data!.agent.map((m) => (
                      <li key={m.id}>{m.text}</li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel
                title={`Business brain (${memory.data?.brain.length ?? 0})`}
                action={
                  <Link href="/app/agent-lab/brain" className="text-xs text-primary hover:underline">
                    Edit
                  </Link>
                }
              >
                <p className="mb-2 text-xs text-muted-foreground">Shared facts every agent knows.</p>
                <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto text-sm">
                  {(memory.data?.brain ?? []).slice(0, 20).map((b) => (
                    <li key={b.id}>{b.title ? <span className="font-medium">{b.title}: </span> : null}{b.text}</li>
                  ))}
                </ul>
              </Panel>
            </div>
          )}

          {tab === 'work' && (
            <div className="flex flex-col gap-4">
              <Panel
                title={`Goals (${a.goals.length})`}
                action={
                  <Link href={`/app/agent-lab/goals?agent=${encodeURIComponent(a.id)}`} className="text-xs text-primary hover:underline">
                    Add goal
                  </Link>
                }
              >
                {a.goals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No goals yet.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {a.goals.map((g) => (
                      <li key={g.id} className="flex flex-col gap-1">
                        <span className="text-sm font-medium">{g.title}</span>
                        <GoalBar g={g} />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title={`Responsibilities (${items.length})`}>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Recurring work this agent owns shows up here. Ask it in chat to take something on.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {items.map((r) => (
                      <li key={r.id}>{displayName(r.name || r.title) || r.id}</li>
                    ))}
                  </ul>
                )}
              </Panel>
              <PropList
                items={[
                  { label: 'Chats', value: a.conversations.length },
                  { label: 'Hand-offs', value: a.delegations.length },
                  { label: 'Last active', value: when(a.last_activity_at) },
                ]}
              />
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}

/* ------------------------------------------------------------------------------------------------ Brain */

const CATEGORIES = ['Business', 'Customers', 'Offers & pricing', 'Brand & voice', 'Policies', 'People', 'Other']

export function BrainPage() {
  const brain = usePolled<{ items: BrainEntry[] }>(gbUrl('brain'), 30_000)
  const agents = useAgents()
  const nameOf = (id?: string | null) => agents.data?.items.find((a) => a.id === id)?.name
  const items = brain.data?.items ?? []
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [draft, setDraft] = useState({ title: '', text: '', category: 'Business' })
  const [editing, setEditing] = useState<string | null>(null)
  const [edit, setEdit] = useState({ title: '', text: '', category: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cats = [...new Set(items.map((b) => b.category || 'Other'))]
  const needle = q.trim().toLowerCase()
  const shown = items.filter((b) => (cat === 'all' || (b.category || 'Other') === cat) && (!needle || `${b.title ?? ''} ${b.text}`.toLowerCase().includes(needle)))

  async function act(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      brain.reload()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.')
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <OpsPage
      icon={BookOpen}
      title="Business brain"
      description="Facts about your business that every agent knows: what you sell, prices, hours, policies, brand voice. Add them here, or just tell any agent in chat and it saves them for the whole team."
    >
      <KpiGrid cols={3}>
        <Kpi label="Facts" value={brain.data ? items.length : '—'} icon={BookOpen} />
        <Kpi label="Topics" value={brain.data ? cats.length : '—'} />
        <Kpi label="Last updated" value={items.length ? when(Math.max(...items.map((b) => b.updated_at))) : '—'} />
      </KpiGrid>

      <Panel title="Add a fact">
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
            <Input placeholder="Short title (optional), e.g. Opening hours" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <select className={fieldCls} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <Textarea rows={3} placeholder="e.g. We're open Mon–Sat 8am–6pm. Emergency calls 24/7 at the main number." value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button
            className="self-start"
            disabled={busy || !draft.text.trim()}
            onClick={() => void act(() => gbPost('brain', draft)).then((ok) => ok && setDraft({ title: '', text: '', category: draft.category }))}
          >
            <Plus className="size-4" /> Add to brain
          </Button>
        </div>
      </Panel>

      <Toolbar>
        <Segmented value={cat} onChange={setCat} options={[{ value: 'all', label: 'All', count: items.length }, ...cats.map((c) => ({ value: c, label: c, count: items.filter((b) => (b.category || 'Other') === c).length }))]} />
        <SearchBox value={q} onChange={setQ} placeholder="Search the brain" />
      </Toolbar>

      {brain.loading && !brain.data ? (
        <OpsLoading />
      ) : brain.error && !brain.data ? (
        <OpsError message="The business brain isn't available right now." onRetry={brain.reload} />
      ) : items.length === 0 ? (
        <OpsEmpty icon={BookOpen} title="Nothing here yet" description="Add your first fact above, or tell any agent something like “remember that our service area is Fairfax County”." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((b) => (
            <OpsCard key={b.id} className="flex flex-col gap-2">
              {editing === b.id ? (
                <>
                  <Input value={edit.title} placeholder="Title" onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                  <Textarea rows={4} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} />
                  <select className={fieldCls} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                    {[...new Set([...CATEGORIES, edit.category].filter(Boolean))].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy || !edit.text.trim()} onClick={() => void act(() => gbPost(`brain/${b.id}`, edit)).then((ok) => ok && setEditing(null))}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {b.title ? <p className="font-semibold">{b.title}</p> : null}
                      <p className="text-sm whitespace-pre-wrap">{b.text}</p>
                    </div>
                    <div className="flex shrink-0">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Edit"
                        onClick={() => {
                          setEditing(b.id)
                          setEdit({ title: b.title ?? '', text: b.text, category: b.category ?? 'Other' })
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Delete"
                        onClick={() => window.confirm('Remove this fact from the brain? No agent will know it anymore.') && void act(() => gbPost(`brain/${b.id}/delete`))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Pill tone="neutral">{b.category || 'Other'}</Pill>
                    <span>{b.source_agent ? `Saved by ${nameOf(b.source_agent) ?? 'an agent'} from chat` : 'Added by you'}</span>
                    <span>· {when(b.updated_at)}</span>
                  </div>
                </>
              )}
            </OpsCard>
          ))}
        </div>
      )}
    </OpsPage>
  )
}

/* ------------------------------------------------------------------------------------------------ Goals */

export function GoalsPage() {
  const params = useSearchParams()
  const preset = params?.get('agent') ?? ''
  const goals = usePolled<{ items: Goal[] }>(gbUrl('goals'), 30_000)
  const agents = useAgents()
  const team = agents.data?.items ?? []
  const items = goals.data?.items ?? []
  const [filter, setFilter] = useState<'active' | 'achieved' | 'all'>('active')
  const [creating, setCreating] = useState(Boolean(preset))
  const [form, setForm] = useState({ agent_id: preset, title: '', target: '', unit: '', deadline: '', baseline: '', current: '' })
  const [update, setUpdate] = useState<{ id: string; value: string; note: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const shown = items.filter((g) => filter === 'all' || (filter === 'active' ? g.status === 'active' || g.status === 'paused' : g.status === 'achieved'))
  const num = (s: string) => (s.trim() === '' ? null : Number(s))

  async function act(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      goals.reload()
      teamChanged()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const active = items.filter((g) => g.status === 'active')
  const avg = active.length ? Math.round(active.reduce((n, g) => n + (goalPct(g) ?? 0), 0) / active.length) : null

  return (
    <OpsPage
      icon={Target}
      title="Goals"
      description="Targets you give your agents, with a deadline. Each agent works toward its goals through its responsibilities and reports progress as it goes."
      actions={
        <Button className="gap-2" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New goal
        </Button>
      }
    >
      <KpiGrid>
        <Kpi label="Active" value={goals.data ? active.length : '—'} icon={Target} tone="info" />
        <Kpi label="Achieved" value={goals.data ? items.filter((g) => g.status === 'achieved').length : '—'} tone="success" />
        <Kpi label="Average progress" value={avg == null ? '—' : `${avg}%`} />
        <Kpi label="Agents with goals" value={goals.data ? new Set(active.map((g) => g.agent_id)).size : '—'} icon={Users} />
      </KpiGrid>

      <Toolbar>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active', label: 'In progress', count: items.filter((g) => g.status === 'active' || g.status === 'paused').length },
            { value: 'achieved', label: 'Achieved', count: items.filter((g) => g.status === 'achieved').length },
            { value: 'all', label: 'All', count: items.length },
          ]}
        />
      </Toolbar>

      {goals.loading && !goals.data ? (
        <OpsLoading />
      ) : goals.error && !goals.data ? (
        <OpsError message="Goals aren't available right now." onRetry={goals.reload} />
      ) : shown.length === 0 ? (
        <OpsEmpty
          icon={Target}
          title={items.length ? 'Nothing in this view' : 'No goals yet'}
          description="Give an agent something measurable, like “Get 20 new Google reviews by Jan 31”. You can also just ask it in chat."
          action={
            <Button variant="outline" onClick={() => setCreating(true)}>
              New goal
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((g) => {
            const left = daysLeft(g.deadline)
            const last = g.updates[0]
            return (
              <OpsCard key={g.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{g.title}</p>
                    <Link href={agentHref(g.agent_id)} className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                      <AgentAvatar avatar={g.agent_avatar} name={g.agent_name} size="sm" /> {g.agent_name}
                    </Link>
                  </div>
                  <Pill tone={goalTone(g)}>{displayName(g.status) || g.status}</Pill>
                </div>
                <GoalBar g={g} />
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {g.deadline ? (
                    <span>
                      Due {new Date(`${g.deadline.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      {left && g.status === 'active' ? ` · ${left}` : ''}
                    </span>
                  ) : (
                    <span>No deadline</span>
                  )}
                  {g.responsibility_ids.length ? <span>· {g.responsibility_ids.length} responsibilities</span> : null}
                </div>
                {last ? (
                  <p className="rounded-md bg-secondary/60 px-2.5 py-1.5 text-xs">
                    {last.note || `Progress set to ${fmtNum(last.value)}`} <span className="text-muted-foreground">· {last.by === 'customer' ? 'you' : last.by} · {when(last.at)}</span>
                  </p>
                ) : null}
                {update?.id === g.id ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Input type="number" placeholder={`Now at (${g.unit || 'value'})`} value={update.value} onChange={(e) => setUpdate({ ...update, value: e.target.value })} />
                      <Input placeholder="Note (optional)" value={update.note} onChange={(e) => setUpdate({ ...update, note: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy || update.value.trim() === ''} onClick={() => void act(() => gbPost(`goals/${g.id}`, { current: num(update.value), note: update.note })).then((ok) => ok && setUpdate(null))}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setUpdate(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {g.status === 'active' ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setUpdate({ id: g.id, value: g.current == null ? '' : String(g.current), note: '' })}>
                          Update progress
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(() => gbPost(`goals/${g.id}`, { status: 'achieved' }))}>
                          Mark achieved
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(() => gbPost(`goals/${g.id}`, { status: 'paused' }))}>
                          Pause
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(() => gbPost(`goals/${g.id}`, { status: 'active' }))}>
                        Resume
                      </Button>
                    )}
                    {g.status !== 'archived' ? (
                      <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busy} onClick={() => window.confirm('Archive this goal?') && void act(() => gbPost(`goals/${g.id}`, { status: 'archived' }))}>
                        Archive
                      </Button>
                    ) : null}
                  </div>
                )}
              </OpsCard>
            )
          })}
        </div>
      )}

      <Drawer
        open={creating}
        onOpenChange={setCreating}
        title="New goal"
        description="Something measurable with a target and a deadline. The agent sees it every time it works."
        footer={
          <Button
            disabled={busy || !form.title.trim()}
            onClick={() =>
              void act(() =>
                gbPost('goals', {
                  agent_id: form.agent_id || agents.data?.default_id,
                  title: form.title.trim(),
                  target: num(form.target),
                  unit: form.unit.trim(),
                  deadline: form.deadline,
                  baseline: num(form.baseline),
                  current: num(form.current),
                }),
              ).then((ok) => {
                if (!ok) return
                setCreating(false)
                setForm({ agent_id: form.agent_id, title: '', target: '', unit: '', deadline: '', baseline: '', current: '' })
              })
            }
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Set goal
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Agent">
            <select className={fieldCls} value={form.agent_id || agents.data?.default_id || ''} onChange={(e) => setForm({ ...form, agent_id: e.target.value })}>
              {team.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.avatar ? `${a.avatar} ` : ''}
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Goal">
            <Input placeholder="e.g. Get more Google reviews" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target">
              <Input type="number" placeholder="20" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
            </Field>
            <Field label="Unit">
              <Input placeholder="reviews" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </Field>
            <Field label="Starting from">
              <Input type="number" placeholder="0" value={form.baseline} onChange={(e) => setForm({ ...form, baseline: e.target.value })} />
            </Field>
            <Field label="Now at">
              <Input type="number" placeholder="Same as start" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
            </Field>
          </div>
          <Field label="Deadline">
            <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </Field>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      </Drawer>
    </OpsPage>
  )
}
