'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Link2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { clipsFetch } from '@/lib/clips-api'

type AccessData = {
  collaborators: { userId: string; name: string; email: string; role: string }[]
  linkAccess: string
  shareUrl: string | null
  canCopyLink: boolean
}

export function ScriptProjectAccessModal({
  open,
  onClose,
  compositionId,
}: {
  open: boolean
  onClose: () => void
  compositionId: string
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'VIEW' | 'COMMENT' | 'EDIT'>('EDIT')
  const [data, setData] = useState<AccessData | null>(null)
  const [linkAccess, setLinkAccess] = useState('INVITE_ONLY')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await clipsFetch<AccessData>(`/api/clips/compositions/${compositionId}/share`)
    setData(res)
    setLinkAccess(res.linkAccess)
  }, [compositionId])

  useEffect(() => {
    if (open) void load().catch(() => toast.error('Could not load sharing'))
  }, [open, load])

  if (!open) return null

  const invite = async () => {
    if (!email.trim()) return
    setBusy(true)
    try {
      const res = await clipsFetch<AccessData>(`/api/clips/compositions/${compositionId}/share`, {
        method: 'PATCH',
        body: JSON.stringify({ inviteEmail: email.trim(), inviteRole: role }),
      })
      setData(res)
      setEmail('')
      toast.success('Invited to project')
    } catch {
      toast.error('Could not invite — check email is a workspace member')
    } finally {
      setBusy(false)
    }
  }

  const saveLinkAccess = async (value: string) => {
    setLinkAccess(value)
    try {
      const res = await clipsFetch<AccessData>(`/api/clips/compositions/${compositionId}/share`, {
        method: 'PATCH',
        body: JSON.stringify({ linkAccess: value }),
      })
      setData(res)
    } catch {
      toast.error('Could not update link access')
    }
  }

  const copyLink = () => {
    if (!data?.shareUrl) return
    void navigator.clipboard.writeText(data.shareUrl)
    toast.success('Link copied')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal data-testid="project-access-modal">
      <div className="w-full max-w-[448px] rounded-xl border border-border bg-popover p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Project access</h2>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            className="h-10 flex-1"
            placeholder="Enter email address…"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger className="h-10 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EDIT">Can edit</SelectItem>
              <SelectItem value="COMMENT">Can comment</SelectItem>
              <SelectItem value="VIEW">Can view</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" className="h-10" disabled={busy} onClick={() => void invite()}>
            Invite to project
          </Button>
        </div>
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          {data?.collaborators.map((c) => (
            <div key={c.userId} className="flex h-12 items-center justify-between text-sm">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.email}</p>
              </div>
              <span className="text-xs text-muted-foreground">{c.role.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
          <Link2 className="size-4 shrink-0 text-muted-foreground" />
          <Label className="sr-only">Link access</Label>
          <Select value={linkAccess} onValueChange={(v) => v && void saveLinkAccess(v)}>
            <SelectTrigger className="h-9 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INVITE_ONLY">Project access required</SelectItem>
              <SelectItem value="LINK_VIEW">Anyone with the link can view</SelectItem>
              <SelectItem value="LINK_COMMENT">Anyone with the link can comment</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="sm" disabled={!data?.shareUrl} onClick={copyLink}>
            <Copy className="mr-1 size-4" />
            Copy link
          </Button>
        </div>
      </div>
    </div>
  )
}
