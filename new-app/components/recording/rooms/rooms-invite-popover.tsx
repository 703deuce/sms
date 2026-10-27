'use client'

import { useCallback, useState } from 'react'
import { Copy, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type InviteRole = 'guest' | 'producer'

export function RoomsInvitePopover({
  sessionId,
  disabled,
}: {
  sessionId: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<InviteRole>('guest')
  const [link, setLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchLink = useCallback(async (inviteRole: InviteRole = role) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/recording/sessions/${sessionId}/invites`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: inviteRole }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Could not create invite')
        return
      }
      const token = json.data?.inviteToken as string
      const url = `${window.location.origin}/app/rooms/join?token=${encodeURIComponent(token)}&role=${role}`
      setLink(url)
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [role, sessionId])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next && !link) void fetchLink(role)
    if (!next) setLink(null)
  }

  async function copyLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    toast.success('Copied')
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="h-8 text-[13px]" disabled={disabled}>
            Invite
          </Button>
        }
      />
      <PopoverContent className="w-[360px] p-4" align="end">
        <p className="text-sm font-semibold">Invite to room</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Share a link so others can join with the role you choose.
        </p>
        <div className="mt-3 flex gap-2">
          {(['guest', 'producer'] as InviteRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRole(r)
                setLink(null)
                void fetchLink(r)
              }}
              className={cn(
                'h-8 flex-1 rounded-lg border text-[13px] capitalize',
                role === r ? 'border-primary bg-accent' : 'border-border',
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <Link2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
            {loading ? 'Generating…' : link ?? '—'}
          </span>
        </div>
        <Button className="mt-3 h-9 w-full gap-2" disabled={!link || loading} onClick={() => void copyLink()}>
          <Copy className="size-4" />
          Copy link
        </Button>
      </PopoverContent>
    </Popover>
  )
}
