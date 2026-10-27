'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Loader2, Sparkles, Video, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrimaryButton } from '@/components/app/primary-button'

type Tab = 'stock_video' | 'stock_photo' | 'ai_image' | 'ai_video'

type Candidate = { provider: string; providerId: string; thumbUrl?: string; previewUrl?: string }

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
  const [tab, setTab] = useState<Tab>('stock_video')
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [busy, setBusy] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [searching, setSearching] = useState(false)
  const [debouncedPrompt, setDebouncedPrompt] = useState(prompt)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) return
    setPrompt(defaultPrompt)
  }, [open, defaultPrompt])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPrompt(prompt), 350)
    return () => clearTimeout(t)
  }, [prompt])

  useEffect(() => {
    if (!open || (tab !== 'stock_video' && tab !== 'stock_photo')) return
    const type = tab === 'stock_photo' ? 'photo' : 'video'
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setSearching(true)
    void fetch(
      `/api/t2v/drafts/${draftId}/scenes/${sceneId}/media?q=${encodeURIComponent(debouncedPrompt)}&type=${type}`,
      { signal: ac.signal },
    )
      .then((r) => r.json())
      .then((b) => setCandidates(b.data?.candidates ?? []))
      .catch((e) => {
        if (e?.name !== 'AbortError') setCandidates([])
      })
      .finally(() => {
        if (!ac.signal.aborted) setSearching(false)
      })
    return () => ac.abort()
  }, [open, tab, draftId, sceneId, debouncedPrompt])

  if (!open) return null

  const applyStock = async (pick: Candidate) => {
    setBusy(true)
    try {
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
      toast.success('Media applied')
      onQueued?.()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not apply media')
    } finally {
      setBusy(false)
    }
  }

  const runAi = async () => {
    setBusy(true)
    try {
      const action = tab === 'ai_image' ? 'ai_image' : 'ai_video'
      const res = await fetch(`/api/t2v/drafts/${draftId}/scenes/${sceneId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, prompt }),
      })
      const body = await res.json()
      if (res.status === 202) {
        toast.success('Generation queued — scene updates when the worker finishes')
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

  const stockTab = tab === 'stock_video' || tab === 'stock_photo'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-border bg-card p-4 shadow-lg">
        <h2 className="text-lg font-semibold">Replace scene media</h2>
        <div className="mt-3 flex flex-wrap gap-1 rounded-lg border border-border p-1">
          {(
            [
              { id: 'stock_video' as const, label: 'Stock video', icon: Video },
              { id: 'stock_photo' as const, label: 'Photo', icon: ImageIcon },
              { id: 'ai_image' as const, label: 'AI image', icon: Sparkles },
              { id: 'ai_video' as const, label: 'AI video', icon: Sparkles },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              className={`flex flex-1 items-center justify-center gap-1 rounded-md py-2 text-[10px] sm:text-xs ${tab === t.id ? 'bg-muted font-medium' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <t.icon className="size-3.5 shrink-0" />
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Label htmlFor="media-prompt">Search / prompt</Label>
          <Input id="media-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} className="mt-1" />
        </div>
        {stockTab ? (
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            {searching ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Searching…
              </p>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No results — try fewer words or another provider key.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {candidates.slice(0, 12).map((c) => (
                  <button
                    key={`${c.provider}-${c.providerId}`}
                    type="button"
                    className="relative aspect-video overflow-hidden rounded-md border border-border"
                    disabled={busy}
                    onClick={() => void applyStock(c)}
                  >
                    {c.thumbUrl ? (
                      <Image src={c.thumbUrl} alt="" fill className="object-cover" unoptimized />
                    ) : (
                      <span className="text-xs text-muted-foreground">Preview</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          {!stockTab ? (
            <PrimaryButton disabled={busy || prompt.trim().length < 3} onClick={() => void runAi()}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Generate
            </PrimaryButton>
          ) : null}
        </div>
      </div>
    </div>
  )
}
