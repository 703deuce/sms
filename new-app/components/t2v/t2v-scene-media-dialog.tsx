'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Sparkles, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrimaryButton } from '@/components/app/primary-button'

type Tab = 'ai_image' | 'ai_video' | 'stock_photo'

export function T2vSceneMediaDialog({
  open,
  onClose,
  draftId,
  sceneId,
  defaultPrompt,
  onQueued,
}: {
  open: boolean
  onClose: () => void
  draftId: string
  sceneId: string
  defaultPrompt: string
  onQueued?: () => void
}) {
  const [tab, setTab] = useState<Tab>('ai_image')
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const run = async () => {
    setBusy(true)
    try {
      if (tab === 'stock_photo') {
        const res = await fetch(
          `/api/t2v/drafts/${draftId}/scenes/${sceneId}/media?q=${encodeURIComponent(prompt)}&type=photo`,
        )
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'search_failed')
        const hits = body.data?.candidates ?? []
        if (!hits.length) {
          toast.message('No photos found — add PEXELS_API_KEY or try another prompt')
          return
        }
        const pick = hits[0]
        const apply = await fetch(`/api/t2v/drafts/${draftId}/scenes/${sceneId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'replace',
            media: { provider: pick.provider, providerId: pick.providerId },
          }),
        })
        const applied = await apply.json()
        if (!apply.ok) throw new Error(applied.error ?? 'apply_failed')
        toast.success('Stock photo applied')
        onQueued?.()
        onClose()
        return
      }
      const action = tab === 'ai_image' ? 'ai_image' : 'ai_video'
      const res = await fetch(`/api/t2v/drafts/${draftId}/scenes/${sceneId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, prompt }),
      })
      const body = await res.json()
      if (res.status === 202) {
        toast.success('Generation queued — refresh when the worker finishes')
        onQueued?.()
        onClose()
        return
      }
      throw new Error(body.error ?? 'request_failed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start generation')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4 shadow-lg">
        <h2 className="text-lg font-semibold">Replace scene media</h2>
        <div className="mt-3 flex gap-1 rounded-lg border border-border p-1">
          {(
            [
              { id: 'ai_image' as const, label: 'AI image', icon: Sparkles },
              { id: 'ai_video' as const, label: 'AI video', icon: Video },
              { id: 'stock_photo' as const, label: 'Stock photo', icon: Sparkles },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              className={`flex flex-1 items-center justify-center gap-1 rounded-md py-2 text-xs ${tab === t.id ? 'bg-muted font-medium' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Label htmlFor="media-prompt">Visual prompt</Label>
          <Input id="media-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} className="mt-1" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <PrimaryButton disabled={busy || prompt.trim().length < 3} onClick={() => void run()}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Continue
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
