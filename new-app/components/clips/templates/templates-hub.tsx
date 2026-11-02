'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PrimaryButton } from '@/components/app/primary-button'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import { CatalogTplThumb } from '@/lib/clips/templates/catalog-thumb'
import { T2vTemplatesGallery } from '@/components/t2v/t2v-templates-gallery'
import { BRAND_STARTERS } from '@/lib/clips/brand-starters'
import { captionFontStack } from '@/lib/clips/caption-fonts'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { captionPresetPatch } from '@/lib/clips/editor/starter-templates'
import { buildTemplateCatalog, type CatalogItem, type CatalogTab } from '@/lib/clips/templates/catalog'
import { PageContainer, PageHeader, Panel, SectionTitle, CardGrid } from '@/components/app/page-primitives'
import { BetaBadge, Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type HubTab = CatalogTab | 'ai-video'

type LayoutPackRow = { id: string; name: string; aspect: string; updatedAt: string }

const TABS: { id: HubTab; label: string }[] = [
  { id: 'layouts', label: 'Layouts' },
  { id: 'captions', label: 'Captions' },
  { id: 'looks', label: 'Looks' },
  { id: 'brand', label: 'Brand' },
  { id: 'ai-video', label: 'AI Video' },
]

const PREVIEW_BOUNDS = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 60_000 }

export function TemplatesHub({
  initialTab,
  sub,
  returnTo,
  aiVideo,
}: {
  initialTab: HubTab
  sub?: 'mine'
  returnTo?: string
  aiVideo: boolean
}) {
  const router = useRouter()
  const myRef = useRef<HTMLElement>(null)
  const [tab, setTab] = useState<HubTab>(initialTab)

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])
  const [packs, setPacks] = useState<LayoutPackRow[]>([])
  const [packsLoading, setPacksLoading] = useState(false)

  const catalog = useMemo(() => buildTemplateCatalog(), [])
  const visible = useMemo(() => {
    if (tab === 'ai-video') return []
    return catalog.filter((c) => c.tab === tab)
  }, [catalog, tab])

  const setTabReplace = useCallback(
    (next: HubTab) => {
      setTab(next)
      const q = new URLSearchParams()
      q.set('tab', next)
      if (sub === 'mine' && next === 'layouts') q.set('sub', 'mine')
      if (returnTo) q.set('returnTo', returnTo)
      router.replace(`/app/clips/templates?${q.toString()}`)
    },
    [router, returnTo, sub],
  )

  const loadPacks = useCallback(async () => {
    setPacksLoading(true)
    try {
      const res = await fetch('/api/clips/layout-packs')
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'load_failed')
      setPacks(body.data?.items ?? [])
    } catch {
      toast.error('Could not load layout packs')
    } finally {
      setPacksLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'layouts') void loadPacks()
  }, [tab, loadPacks])

  useEffect(() => {
    if (sub === 'mine' && tab === 'layouts') {
      myRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [sub, tab])

  const useItem = (item: CatalogItem) => {
    if (item.disabled) {
      toast.message(item.disabled)
      return
    }
    const token = `${item.kind}:${item.id}`
    if (item.kind === 'brand_starter') {
      const starter = BRAND_STARTERS.find((s) => s.id === item.id)
      if (!starter) return
      void (async () => {
        try {
          const res = await fetch('/api/clips/brand/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: starter.name, settings: starter.settings, ...starter.columns }),
          })
          const body = await res.json()
          if (!res.ok) throw new Error(body.error ?? 'save_failed')
          toast.success('Added to Brand templates')
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Could not save brand template')
        }
      })()
      return
    }
    if (returnTo) {
      const sep = returnTo.includes('?') ? '&' : '?'
      router.push(`${returnTo}${sep}apply=${encodeURIComponent(token)}`)
      return
    }
    try {
      localStorage.setItem('transovo.pendingApply', token)
    } catch {
      /* ignore */
    }
    router.push('/app/clips/new')
  }

  const deletePack = async (id: string) => {
    try {
      const res = await fetch(`/api/clips/layout-packs/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete_failed')
      setPacks((prev) => prev.filter((p) => p.id !== id))
      toast.success('Layout pack deleted')
    } catch {
      toast.error('Could not delete pack')
    }
  }

  const tabs = aiVideo ? TABS : TABS.filter((t) => t.id !== 'ai-video')

  return (
    <PageContainer>
      <PageHeader title="Templates" description="Layouts, captions, looks, brand starters, and AI video styles." />

      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium capitalize',
              tab === t.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
            )}
            onClick={() => setTabReplace(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ai-video' ? (
        <T2vTemplatesGallery embedded />
      ) : (
        <>
          {tab === 'layouts' ? (
            <section ref={myRef} className="space-y-3 rounded-xl border border-border p-4" data-testid="my-layouts">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">My layouts</h2>
                {packsLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
              </div>
              {packs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Save a layout from the editor Templates panel.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {packs.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.aspect}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => {
                            const token = `layout_pack:${p.id}`
                            if (returnTo) {
                              const sep = returnTo.includes('?') ? '&' : '?'
                              router.push(`${returnTo}${sep}apply=${encodeURIComponent(token)}`)
                            } else {
                              try {
                                localStorage.setItem('transovo.pendingApply', token)
                              } catch {
                                /* ignore */
                              }
                              router.push('/app/clips/new')
                            }
                          }}
                        >
                          Use
                        </Button>
                        <Button size="sm" variant="ghost" type="button" aria-label="Delete" onClick={() => void deletePack(p.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((item) => (
              <article
                key={`${item.kind}:${item.id}`}
                data-testid="tpl-item"
                data-kind={item.kind}
                className="flex flex-col overflow-hidden rounded-xl border border-border bg-card"
              >
                <TplThumb item={item} />
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight">{item.name}</p>
                    {item.badge === 'Beta' ? (
                      <BetaBadge />
                    ) : item.badge ? (
                      <Badge variant="secondary">{item.badge}</Badge>
                    ) : null}
                  </div>
                  {item.disabled ? (
                    <Button variant="secondary" size="sm" className="mt-auto w-full" disabled title={item.disabled}>
                      Coming soon
                    </Button>
                  ) : (
                    <PrimaryButton size="sm" className="mt-auto w-full" onClick={() => useItem(item)}>
                      Use
                    </PrimaryButton>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {!returnTo ? (
        <p className="text-center text-xs text-muted-foreground">
          Open from the editor to apply directly, or{' '}
          <Link href="/app/clips/new" className="text-primary underline-offset-2 hover:underline">
            start a new clip
          </Link>
          .
        </p>
      ) : null}
    </PageContainer>
  )
}

function TplThumb({ item }: { item: CatalogItem }) {
  if (item.kind === 'layout' || item.kind === 'layout_template' || item.kind === 'multicam') {
    return <CatalogTplThumb item={item} />
  }
  if (item.kind === 'caption') {
    let edits: ClipEditsV2 = defaultEdits(PREVIEW_BOUNDS)
    edits = captionPresetPatch(edits, item.id)
    return (
      <div className="relative aspect-[9/16] max-h-44 w-full overflow-hidden bg-black">
        <CaptionOverlay
          words={[{ w: 'Sample line', s: 0, e: 2, spk: 0 }]}
          edits={edits}
          currentTimeSec={0.5}
          boxHeightPx={320}
          outputDurationSec={3}
        />
      </div>
    )
  }
  if (item.kind === 'brand_starter') {
    const palette = (item.mock.palette as string[] | undefined) ?? ['#111827', '#38bdf8']
    return (
      <div className="flex aspect-[9/16] max-h-44 w-full flex-col justify-end gap-2 bg-gradient-to-br from-zinc-900 to-zinc-700 p-3">
        <div className="flex gap-1">
          {palette.slice(0, 5).map((c) => (
            <span key={c} className="size-5 rounded-full border border-white/20" style={{ background: c }} />
          ))}
        </div>
        <p className="text-xs font-bold text-white" style={{ fontFamily: captionFontStack('Inter') }}>
          Brand starter
        </p>
      </div>
    )
  }
  const mode = String(item.mock.mode ?? item.mock.templateId ?? item.id).replace(/_/g, ' ')
  return (
    <div className="flex aspect-[9/16] max-h-44 w-full items-end bg-gradient-to-br from-slate-800 via-slate-900 to-black p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/90">{mode}</p>
    </div>
  )
}
