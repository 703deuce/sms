'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PrimaryButton } from '@/components/app/primary-button'
import type { T2vTemplateCategory, T2vTemplateListItem } from '@/lib/t2v/m9-contracts'
import type { T2vAspect } from '@/lib/t2v/types'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const CATEGORIES: Array<T2vTemplateCategory | 'all'> = [
  'all',
  'explainer',
  'listicle',
  'promo',
  'news',
  'tutorial',
  'quote',
  'story',
]

const ASPECTS: Array<T2vAspect | 'all'> = ['all', '16:9', '9:16', '1:1', '4:5']

export function T2vTemplatesGallery({ draftId }: { draftId?: string }) {
  const [templates, setTemplates] = useState<T2vTemplateListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<T2vTemplateCategory | 'all'>('all')
  const [aspect, setAspect] = useState<T2vAspect | 'all'>('all')
  const [q, setQ] = useState('')
  const [preview, setPreview] = useState<T2vTemplateListItem | null>(null)
  const [applying, setApplying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category !== 'all') params.set('category', category)
      if (aspect !== 'all') params.set('aspect', aspect)
      const res = await fetch(`/api/t2v/templates?${params}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'load_failed')
      setTemplates(body.data?.templates ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load templates')
    } finally {
      setLoading(false)
    }
  }, [category, aspect])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return templates
    return templates.filter((t) => t.name.toLowerCase().includes(needle))
  }, [templates, q])

  const useTemplate = async (id: string) => {
    if (draftId) {
      setApplying(true)
      try {
        const res = await fetch(`/api/t2v/templates/${id}/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftId }),
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'apply_failed')
        toast.success('Template style applied (script unchanged)')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not apply template')
      } finally {
        setApplying(false)
      }
      return
    }
    window.location.href = `/app/clips/video/new?template=${id}`
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold">Video templates</h1>
        <p className="text-sm text-muted-foreground">Apply look, music and transitions — your script stays as-is.</p>
      </header>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={cn('rounded-full border px-3 py-1 text-xs capitalize', category === c && 'border-primary bg-primary/10')}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {ASPECTS.map((a) => (
          <button
            key={a}
            type="button"
            className={cn('rounded-md border px-2 py-1 text-xs', aspect === a && 'border-primary')}
            onClick={() => setAspect(a)}
          >
            {a}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <article key={t.id} className="overflow-hidden rounded-xl border border-border">
              <button type="button" className="block w-full text-left" onClick={() => setPreview(t)}>
                <div className="aspect-video bg-muted">
                  {t.thumbUrl ? <img src={t.thumbUrl} alt="" className="size-full object-cover" /> : null}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">{t.category} · {t.aspect}</p>
                </div>
              </button>
            </article>
          ))}
        </div>
      )}
      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-card p-4 shadow-lg">
            <h2 className="text-lg font-semibold">{preview.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{preview.description}</p>
            {preview.previewUrl ? (
              <video
                className="mt-3 w-full rounded-lg border border-border"
                src={preview.previewUrl}
                controls
                playsInline
                preload="metadata"
                poster={preview.thumbUrl ?? undefined}
              />
            ) : preview.thumbUrl ? (
              <img src={preview.thumbUrl} alt="" className="mt-3 w-full rounded-lg border border-border object-cover" />
            ) : null}
            {preview.sampleScript ? (
              <p className="mt-3 rounded-lg bg-muted p-3 text-sm">{preview.sampleScript}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton disabled={applying} onClick={() => void useTemplate(preview.id)}>
                {applying ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Use template
              </PrimaryButton>
              <Button type="button" variant="outline" onClick={() => setPreview(null)}>Close</Button>
              {!draftId ? (
                <Link href={`/app/clips/video/new?template=${preview.id}`} className="text-sm text-primary">
                  Start new video
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
