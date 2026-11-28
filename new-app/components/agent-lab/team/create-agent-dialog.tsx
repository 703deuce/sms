'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { gbPost } from '@/components/agent-lab/ops/gb14'
import { AVATARS, agentHref, type TeamAgent } from '@/lib/agent-lab/team'
import { cn } from '@/lib/utils'
import { teamChanged } from './use-team'

const IDEAS = [
  { name: 'Marketing', role: 'Runs marketing: Google Business Profile posts, reviews, social and local SEO.', avatar: '📣' },
  { name: 'Sales', role: 'Follows up with leads, books appointments and keeps the CRM up to date.', avatar: '💼' },
  { name: 'Research', role: 'Finds facts, competitors and market data, always with sources.', avatar: '🔎' },
  { name: 'Operations', role: 'Keeps schedules, invoices and day-to-day admin moving.', avatar: '🗓️' },
]

/** Create a named agent (name, role, how it works, avatar). It opens in its own chat right away. */
export function CreateAgentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [instructions, setInstructions] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[1])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    if (!name.trim()) return setError('Give your agent a name.')
    setBusy(true)
    setError(null)
    try {
      const a = await gbPost<TeamAgent>('agents', { name: name.trim(), role: role.trim(), instructions: instructions.trim(), avatar })
      teamChanged()
      onOpenChange(false)
      setName('')
      setRole('')
      setInstructions('')
      router.push(agentHref(a.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the agent')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create an agent</DialogTitle>
          <DialogDescription>
            A teammate with its own chat, memory, skills and goals. It shares your connected apps, logins, email and business brain.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {IDEAS.map((i) => (
              <button
                key={i.name}
                type="button"
                onClick={() => {
                  setName(i.name)
                  setRole(i.role)
                  setAvatar(i.avatar)
                }}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground/20 hover:text-foreground"
              >
                {i.avatar} {i.name}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing" maxLength={60} autoFocus />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Role</span>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="What this agent is responsible for" maxLength={300} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">How it works <span className="font-normal text-muted-foreground">(optional)</span></span>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Personality, tone, rules it should always follow"
              className="min-h-20"
              maxLength={4000}
            />
          </label>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Avatar</span>
            <div className="flex flex-wrap gap-1.5">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-label={`Avatar ${a}`}
                  aria-pressed={avatar === a}
                  onClick={() => setAvatar(a)}
                  className={cn(
                    'grid size-9 place-items-center rounded-lg border text-lg transition-colors',
                    avatar === a ? 'border-primary bg-primary/10' : 'border-border hover:border-foreground/20',
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void create()} disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : null} Create agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
