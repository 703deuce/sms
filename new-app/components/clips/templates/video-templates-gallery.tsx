'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FIRST_PARTY_VIDEO_TEMPLATES } from '@/lib/clips/real-video-templates/releases'
import { filterVideoTemplates } from '@/lib/clips/real-video-templates/gallery'
import { SubmitCommunityTemplateDialog, type CommunitySubmitTemplate } from '@/components/clips/templates/submit-community-template-dialog'
import { ReportCommunityTemplateDialog } from '@/components/clips/templates/report-community-template-dialog'
import { AnimatedTemplateCardPreview, RenderedTemplateCardPreview } from '@/components/clips/templates/video-templates-gallery-previews'
import { VideoTemplateGalleryDetailDialog } from '@/components/clips/templates/video-template-gallery-detail-dialog'
import type { VideoTemplateRelease } from '@/lib/clips/real-video-templates/gallery'

type Scope = 'first-party' | 'community' | 'mine'
type UserTemplateListItem = {
  id:string;title:string;description:string;currentRevision:number;updatedAt:string
  revisions:Array<{revision:number;definition:{slots?:Array<{id:string;ordinal:number;label?:string;media:string;minDurationMs:number;target?:{kind:string}}>;
    textFields?:Array<{id:string;label?:string;exampleText?:string}>;previewRange?:{startMs:number;endMs:number};snapshot?:{aspect?:string;clipStartMs?:number;clipEndMs?:number}};
    assetManifest?:{decorative?:Array<{key:string;kind:string}>;musicPolicy?:'keep'|'replace'|'mute'}}>
  publications?:Array<{id:string;state:string;revisionId:string;revision:{revision:number};createdAt:string;
    submittedAt:string|null;publishedAt:string|null;rejectedAt:string|null;hiddenAt:string|null;withdrawnAt:string|null}>
}
type CommunityTemplateListItem = {
  id:string;title:string;description:string;creatorName:string;category:string;tags:string[];
  aspect:string;clipCount:number;durationMs:number;licenseTerms:string;publishedAt:string|null;
  publicPreview?:{range?:{startMs:number;endMs:number};slots?:Array<unknown>;text?:Array<unknown>}
}
type DraftTemplateProject = {id:string;title:string;releaseId:string;status:string;updatedAt:string}
const COMMUNITY_CATEGORIES = ['gaming','podcast','social','business','education','lifestyle','other'] as const
const MAX_PAGE_SIZE = 24
const STORAGE_KEY = 'transovo.videoTemplates.favorites.v1'

export function VideoTemplatesGallery() {
  const [scope, setScope] = useState<Scope>('first-party')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [aspect, setAspect] = useState('')
  const [slots, setSlots] = useState('')
  const [duration, setDuration] = useState('')
  const [page, setPage] = useState(1)
  const [favorites, setFavorites] = useState<string[]>([])
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [sound, setSound] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<DraftTemplateProject[]>([])
  const [mine, setMine] = useState<UserTemplateListItem[]>([])
  const [minePages, setMinePages] = useState(1)
  const [mineTotal, setMineTotal] = useState(0)
  const [mineError, setMineError] = useState<string | null>(null)
  const [mineRefresh, setMineRefresh] = useState(0)
  const [mineFilter, setMineFilter] = useState('')
  const [community, setCommunity] = useState<CommunityTemplateListItem[]>([])
  const [communityPages, setCommunityPages] = useState(1)
  const [communityTotal, setCommunityTotal] = useState(0)
  const [communityError, setCommunityError] = useState<string | null>(null)
  const [submitTemplate, setSubmitTemplate] = useState<CommunitySubmitTemplate | null>(null)
  const [reportTemplate, setReportTemplate] = useState<{id:string;title:string}|null>(null)
  const [communityNotice, setCommunityNotice] = useState<string | null>(null)
  const [detailTemplate, setDetailTemplate] = useState<VideoTemplateRelease | null>(null)

  useEffect(() => {
    if (scope !== 'mine') return
    let live = true
    const qs = new URLSearchParams({ page: String(page) })
    if (query.trim()) qs.set('q', query.trim())
    if (mineFilter) qs.set('state', mineFilter)
    Promise.all([
      fetch('/api/clips/user-templates?' + qs.toString(), { cache: 'no-store' }).then(async response => {
        const body = await response.json() as { data?: { items:UserTemplateListItem[];pages:number;total:number }; error?: string }
        if (!response.ok || !body.data) throw new Error(body.error ?? 'Could not load My templates')
        return body.data
      }),
      fetch('/api/clips/video-templates/drafts', { cache: 'no-store' }).then(async response => {
        const body = await response.json() as { data?: { items:DraftTemplateProject[] }; error?: string }
        if (!response.ok || !body.data) throw new Error(body.error ?? 'Could not load template projects')
        return body.data.items
      }),
    ]).then(([saved, projectDrafts]) => {
      if (!live) return
      setMine(saved.items);setMinePages(saved.pages);setMineTotal(saved.total);setDrafts(projectDrafts);setMineError(null)
    }).catch(error => { if (live) setMineError(error instanceof Error ? error.message : 'Load failed') })
    return () => { live = false }
  }, [scope, query, page, mineRefresh, mineFilter])

  useEffect(() => {
    if (scope !== 'community') return
    let live = true
    const qs = new URLSearchParams({ page: String(page) })
    if (query.trim()) qs.set('q', query.trim())
    if (category) qs.set('category', category)
    if (aspect) qs.set('aspect', aspect)
    if (slots) qs.set('minClips', slots)
    if (duration) qs.set('maxDurationMs', String(Number(duration) * 1000))
    fetch('/api/clips/video-templates/community?' + qs.toString(), { cache: 'no-store' })
      .then(async response => {
        const body = await response.json() as { data?: { items:CommunityTemplateListItem[];pages:number;total:number }; error?: string }
        if (!response.ok || !body.data) throw new Error(body.error ?? 'Could not load community templates')
        if (live) { setCommunity(body.data.items);setCommunityPages(body.data.pages);setCommunityTotal(body.data.total);setCommunityError(null) }
      })
      .catch(error => { if (live) setCommunityError(error instanceof Error ? error.message : 'Load failed') })
    return () => { live = false }
  }, [scope, query, category, aspect, slots, duration, page])
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
      if (Array.isArray(saved)) setFavorites(saved.filter((x): x is string => typeof x === 'string').slice(0, 3000))
    } catch { /* corrupt preference does not affect gallery */ }
  }, [])
  const toggleFavorite = (id: string) => {
    setFavorites(previous => {
      const next = previous.includes(id) ? previous.filter(x => x !== id) : [...previous, id]
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* storage optional */ }
      return next
    })
  }
  const categories = useMemo(() => [...new Set(FIRST_PARTY_VIDEO_TEMPLATES.map(x => x.category))].sort(), [])
  const result = useMemo(() => filterVideoTemplates(
    onlyFavorites ? FIRST_PARTY_VIDEO_TEMPLATES.filter(x => favorites.includes(x.id)) : FIRST_PARTY_VIDEO_TEMPLATES,
    { query, category, aspect, minSlots: slots ? Number(slots) : undefined,
      maxDurationSeconds: duration ? Number(duration) : undefined },
    page, MAX_PAGE_SIZE,
  ), [query, category, aspect, slots, duration, page, onlyFavorites, favorites])
  const groups = useMemo(() => {
    const output: Array<{ id: string; title: string; items: typeof result.items }> = []
    for (const item of result.items) {
      const last = output[output.length - 1]
      if (last?.id === item.family.familyId) last.items.push(item)
      else output.push({ id: item.family.familyId, title: item.family.title, items: [item] })
    }
    return output
  }, [result.items])
  const changeFilters = (setter: (s: string) => void, value: string) => { setter(value); setPage(1) }
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6" data-testid="video-template-gallery">
      <header className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-widest text-primary">Clip Studio</div>
        <h1 className="text-3xl font-semibold tracking-tight">Video templates</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Ready-made video sequences with defined clip and photo slots, timed cuts, text, graphics and music.
          Preview templates are usable immediately; certification remains visible as a separate status badge.
        </p>
        <Link href="/app/clips/templates?tab=layouts" className="inline-block text-sm text-primary underline-offset-4 hover:underline">
          Browse Layouts and caption styles
        </Link>
      </header>
      <div role="tablist" aria-label="Template source" className="flex flex-wrap gap-2">
        {([['first-party', 'Video templates'], ['community', 'Community'], ['mine', 'My templates']] as const).map(([id, label]) =>
          <button key={id} type="button" role="tab" aria-selected={scope === id}
            className={`rounded-full border px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${scope === id ? 'border-primary bg-primary/10' : 'border-border'}`}
            onClick={() => { setScope(id); setPage(1) }}>{label}</button>)}
      </div>
      {scope === 'first-party' ? <>
        <section aria-label="Filter video templates" className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-xs font-medium">Search
            <input type="search" value={query} onChange={e => changeFilters(setQuery, e.target.value)}
              placeholder="Search styles and families" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
          </label>
          <label className="space-y-1 text-xs font-medium">Category
            <select value={category} onChange={e => changeFilters(setCategory, e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="">All categories</option>{categories.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium">Aspect
            <select value={aspect} onChange={e => changeFilters(setAspect, e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="">All aspects</option><option value="9:16">Vertical 9:16</option><option value="16:9">Wide 16:9</option><option value="1:1">Square 1:1</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium">Minimum slots
            <select value={slots} onChange={e => changeFilters(setSlots, e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="">Any</option><option value="3">3+</option><option value="10">10+</option><option value="20">20+</option><option value="30">30+</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium">Maximum length
            <select value={duration} onChange={e => changeFilters(setDuration, e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="">Any</option><option value="15">15 seconds</option><option value="30">30 seconds</option><option value="60">60 seconds</option><option value="120">2 minutes</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-5">
            <input type="checkbox" checked={onlyFavorites} onChange={e => { setOnlyFavorites(e.target.checked); setPage(1) }} />
            Favorites only
          </label>
        </section>
        <p className="text-sm text-muted-foreground" role="status">
          {result.total} templates · {result.items.filter(item=>item.certificationStatus !== 'certified').length} Preview on this page ·
          {' '}{FIRST_PARTY_VIDEO_TEMPLATES.filter(item=>item.certificationStatus === 'certified').length} Certified
        </p>
        {result.items.length ? <div className="space-y-7">
          {groups.map(group => <section key={group.id} className="space-y-3" aria-label={group.title + ' variants'}>
            <h2 className="text-lg font-semibold">{group.title} <span className="ml-2 text-xs font-normal text-muted-foreground">{group.items.length} on this page</span></h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {group.items.map(item => <article key={item.id} className="group overflow-hidden rounded-2xl border bg-card shadow-sm" data-testid="video-template-card">
            <button type="button" className="block w-full text-left" onClick={() => setDetailTemplate(item as VideoTemplateRelease)}
              aria-label={'Open details for ' + item.title}>
            {item.certificationStatus === 'certified' && item.demoPath
              ? <video controls playsInline preload="none" muted={sound !== item.id} poster={item.demoPosterPath}
                  src={item.demoPath} onMouseEnter={event => {
                    if (event.currentTarget.muted) void event.currentTarget.play().catch(() => {})
                  }}
                  onMouseLeave={event => {
                    event.currentTarget.pause()
                    try { event.currentTarget.currentTime = 0 } catch { /* not seekable yet */ }
                  }} className="aspect-video w-full bg-black object-cover"
                  aria-label={`Preview ${item.title}`} />
              : item.previewMedia
                ? <RenderedTemplateCardPreview item={item as VideoTemplateRelease} />
                : <AnimatedTemplateCardPreview item={item as VideoTemplateRelease} />}
            </button>
            <div className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{item.title}</h2>
                <button type="button" aria-pressed={favorites.includes(item.id)}
                  aria-label={favorites.includes(item.id) ? 'Remove favorite' : 'Add favorite'}
                  onClick={() => toggleFavorite(item.id)} className="rounded-md border px-2 py-1 text-xs">{favorites.includes(item.id) ? 'Saved' : 'Save'}</button>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">{item.category}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">{item.family.aspects[0]}</span>
              </div>
              <p className="text-xs text-muted-foreground">{item.family.slots.length} slots · {(item.family.totalFrames / item.family.fps).toFixed(1).replace(/\.0$/, '')}s</p>
              <p className="text-xs text-muted-foreground">
                {item.family.slots.filter(slot => slot.media === 'video').length} video · {' '}
                {item.family.slots.filter(slot => slot.media === 'image').length} photos · {' '}
                {item.family.slots.filter(slot => slot.media === 'either').length} flexible
              </p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
              <details className="rounded-lg border border-border/70 p-2 text-xs">
                <summary className="cursor-pointer font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                  Exact slot lengths and editable fields
                </summary>
                <ol className="mt-2 space-y-1">
                  {item.family.slots.map(slot => <li key={slot.id}>
                    Slot {slot.ordinal}: {slot.media === 'either' ? 'photo or video' : slot.media} ·
                    {' '}{(slot.durationFrames / item.family.fps).toFixed(2)}s output
                  </li>)}
                </ol>
                <p className="mt-2 text-muted-foreground">
                  Editable text: {item.family.texts.length
                    ? item.family.texts.map(text => text.id).join(', ') : 'none'}
                  {item.family.graphics?.length
                    ? ' · Authored graphics: ' + item.family.graphics.length : ''}
                </p>
              </details>
              <p className="text-xs text-muted-foreground">Rights: {item.rights}</p>
              <p className="text-xs text-muted-foreground">
                {item.design.musicPolicy === 'none' ? 'No music track' : 'Licensed or user-owned music only'}
                {' · '}Editable: slot media, text, colors, source trim and audio
              </p>
              {!!item.requiredCapabilities.length && <p className="text-xs text-muted-foreground">
                Requires {item.requiredCapabilities.join(', ')}
              </p>}
              {item.certificationStatus === 'certified' && item.demoPath ? <button type="button" onClick={() => setSound(sound === item.id ? null : item.id)}
                className="rounded-lg border px-3 py-2 text-xs">{sound === item.id ? 'Mute demo' : 'Enable demo sound'}</button> : null}
              <Link href={'/app/clips/video-templates/' + encodeURIComponent(item.id)}
                className="block rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground"
                aria-label="Use template">
                Use template
              </Link>
            </div>
          </article>)}
            </div>
          </section>)}
        </div> : <div className="rounded-2xl border border-dashed p-10 text-center">
          <h2 className="font-medium">No templates match</h2>
          <p className="mt-2 text-sm text-muted-foreground">Try clearing some filters.</p>
        </div>}
        {result.pages > 1 && <nav aria-label="Gallery pages" className="flex items-center justify-center gap-3">
          <button type="button" disabled={result.page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded-lg border px-3 py-2 disabled:opacity-50">Previous</button>
          <span className="text-sm">Page {result.page} of {result.pages}</span>
          <button type="button" disabled={result.page === result.pages} onClick={() => setPage(p => Math.min(result.pages, p + 1))} className="rounded-lg border px-3 py-2 disabled:opacity-50">Next</button>
        </nav>}
      </> : scope === 'mine' ? <section role="tabpanel" aria-label="My templates" className="space-y-5">
        <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
          <label className="block space-y-1 text-xs font-medium">Search My templates
            <input type="search" value={query} onChange={e => changeFilters(setQuery, e.target.value)}
              placeholder="Search saved templates" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
          </label>
          <label className="block space-y-1 text-xs font-medium">Publication state
            <select value={mineFilter} onChange={e=>{setMineFilter(e.target.value);setPage(1)}}
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="">All private templates</option>
              <option value="never-submitted">Never submitted</option>
              <option value="pending">Pending review</option>
              <option value="published">Published</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
        </section>
        {mineError && <p role="alert" className="rounded-xl border p-4 text-sm text-destructive">{mineError}</p>}
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Saved from your edits</h2>
          <span className="text-xs text-muted-foreground">{mineTotal} private template{mineTotal===1?'':'s'}</span></div>
        {mine.length === 0 && !mineError && <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No saved private templates match. Open any clip editor and choose Save as template.
        </p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map(item => {
            const def=item.revisions[0]?.definition
            const slotCount=def?.slots?.length??0
            return <article key={item.id} className="space-y-3 rounded-2xl border bg-card p-4">
              <div><h3 className="font-semibold">{item.title}</h3>
                <p className="text-xs text-muted-foreground">Revision {item.currentRevision} · {def?.snapshot?.aspect??'video'} · {slotCount} slot{slotCount===1?'':'s'} · Updated {new Date(item.updatedAt).toLocaleString()}</p></div>
              {item.description?<p className="text-sm">{item.description}</p>:null}
              <div className="flex h-12 overflow-hidden rounded-lg border bg-muted/20">
                {(def?.slots??[]).map(slot=><span key={slot.id} className="grid min-w-12 flex-1 place-items-center border-r px-1 text-[10px] last:border-r-0">
                  {slot.ordinal}. {slot.media}
                </span>)}
                {!slotCount?<span className="grid flex-1 place-items-center text-[10px] text-muted-foreground">Private fixed-media template</span>:null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={'/app/clips/user-templates/'+encodeURIComponent(item.id)}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Use template</Link>
                {(() => {
                  const currentPublished=item.publications?.find(p=>p.state==='published'&&p.revision.revision===item.currentRevision)
                  const pending=item.publications?.find(p=>p.state==='submitted')
                  const published=item.publications?.find(p=>p.state==='published')
                  if(pending)return <span className="rounded-lg border px-3 py-2 text-xs">Revision {pending.revision.revision} pending review</span>
                  if(currentPublished)return <span className="rounded-lg border border-emerald-500/40 px-3 py-2 text-xs">Published</span>
                  return <button type="button" className="rounded-lg border px-3 py-2 text-xs"
                    onClick={() => {
                      const latest=item.revisions[0]
                      if(!latest)return
                      setSubmitTemplate({
                        id:item.id,title:item.title,description:item.description,currentRevision:item.currentRevision,
                        revisions:[{
                          revision:latest.revision,
                          definition:{
                            slots:(latest.definition.slots??[]).map(x=>({
                              id:x.id,ordinal:x.ordinal,label:x.label??('Slot '+x.ordinal),media:x.media,
                              target:x.target??{kind:'unknown'},
                            })),
                            textFields:(latest.definition.textFields??[]).map(x=>({
                              id:x.id,label:x.label??x.id,exampleText:x.exampleText??'',
                            })),
                            previewRange:latest.definition.previewRange??{startMs:0,endMs:1},
                            snapshot:{
                              aspect:latest.definition.snapshot?.aspect??'9:16',
                              clipStartMs:latest.definition.snapshot?.clipStartMs??0,
                              clipEndMs:latest.definition.snapshot?.clipEndMs??1,
                            },
                          },
                          assetManifest:{
                            decorative:latest.assetManifest?.decorative??[],
                            musicPolicy:latest.assetManifest?.musicPolicy??'mute',
                          },
                        }],
                      })
                    }}>
                    {published?'Submit revision '+item.currentRevision:'Submit to Community'}
                  </button>
                })()}
                <button type="button" className="rounded-lg border px-3 py-2 text-xs" onClick={() => {
                  void fetch('/api/clips/user-templates/'+encodeURIComponent(item.id)+'/duplicate',{method:'POST'})
                    .then(async r=>{if(!r.ok){const b=await r.json() as {error?:string};throw new Error(b.error??'Duplicate failed')}setMineRefresh(x=>x+1)})
                    .catch(e=>setMineError(e instanceof Error?e.message:'Duplicate failed'))
                }}>Duplicate</button>
                <button type="button" className="rounded-lg border px-3 py-2 text-xs" onClick={() => {
                  const nextTitle=window.prompt('Template title',item.title)?.trim()
                  if(!nextTitle)return
                  const nextDescription=window.prompt('Template description',item.description) 
                  if(nextDescription===null)return
                  void fetch('/api/clips/user-templates/'+encodeURIComponent(item.id),{method:'PATCH',headers:{'content-type':'application/json'},
                    body:JSON.stringify({title:nextTitle,description:nextDescription})})
                    .then(async r=>{if(!r.ok){const b=await r.json() as {error?:string};throw new Error(b.error??'Metadata update failed')}setMineRefresh(x=>x+1)})
                    .catch(e=>setMineError(e instanceof Error?e.message:'Metadata update failed'))
                }}>Edit metadata</button>
                {item.publications?.find(p=>p.state==='submitted'||p.state==='published') ? <button type="button"
                  className="rounded-lg border px-3 py-2 text-xs" onClick={() => {
                    const pub=item.publications?.find(p=>p.state==='submitted'||p.state==='published')
                    if(!pub||!window.confirm('Withdraw this publication from future community discovery? Existing private copies are not deleted.'))return
                    void fetch('/api/clips/video-templates/community/'+encodeURIComponent(pub.id)+'/withdraw',{method:'POST'})
                      .then(async r=>{if(!r.ok){const b=await r.json() as {error?:string};throw new Error(b.error??'Withdraw failed')}setMineRefresh(x=>x+1)})
                      .catch(e=>setMineError(e instanceof Error?e.message:'Withdraw failed'))
                  }}>Withdraw public version</button> : null}
                <button type="button" className="rounded-lg border px-3 py-2 text-xs text-destructive" onClick={() => {
                  if(!window.confirm('Remove this template from My templates? Existing projects are not deleted.'))return
                  void fetch('/api/clips/user-templates/'+encodeURIComponent(item.id),{method:'DELETE'})
                    .then(async r=>{if(!r.ok){const b=await r.json() as {error?:string};throw new Error(b.error??'Delete failed')}setMineRefresh(x=>x+1)})
                    .catch(e=>setMineError(e instanceof Error?e.message:'Delete failed'))
                }}>Remove</button>
              </div>
              <p className="text-[11px] text-muted-foreground">Private by default. Saving never publishes this definition or its source assets.</p>
            </article>
          })}
        </div>
        {minePages>1?<nav aria-label="My templates pages" className="flex items-center justify-center gap-3">
          <button type="button" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-lg border px-3 py-2 disabled:opacity-50">Previous</button>
          <span className="text-sm">Page {page} of {minePages}</span>
          <button type="button" disabled={page===minePages} onClick={()=>setPage(p=>Math.min(minePages,p+1))} className="rounded-lg border px-3 py-2 disabled:opacity-50">Next</button>
        </nav>:null}
        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer font-semibold">Standalone first-party template projects ({drafts.length})</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {drafts.map(item => {
              const available=FIRST_PARTY_VIDEO_TEMPLATES.some(release=>release.id===item.releaseId)
              return <article key={item.id} className="space-y-2 rounded-xl border p-3">
                <h3 className="font-medium">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.status} · Updated {new Date(item.updatedAt).toLocaleString()}</p>
                {available?<Link href={'/app/clips/video-templates/'+encodeURIComponent(item.releaseId)+'?draft='+encodeURIComponent(item.id)}
                  className="inline-block rounded-lg border px-3 py-2 text-xs">Resume project</Link>:
                  <p className="text-xs text-muted-foreground">Original release unavailable; project retained.</p>}
              </article>
            })}
          </div>
        </details>
      </section> : <section role="tabpanel" aria-label="Community templates" className="space-y-5">
        <section aria-label="Filter community templates" className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-xs font-medium">Search
            <input type="search" value={query} onChange={e=>changeFilters(setQuery,e.target.value)} placeholder="Search community"
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
          </label>
          <label className="space-y-1 text-xs font-medium">Category
            <select value={category} onChange={e=>changeFilters(setCategory,e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="">All categories</option>{COMMUNITY_CATEGORIES.map(x=><option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium">Aspect
            <select value={aspect} onChange={e=>changeFilters(setAspect,e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="">All aspects</option><option value="9:16">Vertical 9:16</option><option value="16:9">Wide 16:9</option><option value="1:1">Square 1:1</option><option value="4:5">Portrait 4:5</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium">Minimum clips
            <select value={slots} onChange={e=>changeFilters(setSlots,e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="">Any</option><option value="1">1+</option><option value="3">3+</option><option value="10">10+</option><option value="20">20+</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium">Maximum length
            <select value={duration} onChange={e=>changeFilters(setDuration,e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
              <option value="">Any</option><option value="15">15 seconds</option><option value="30">30 seconds</option><option value="60">60 seconds</option><option value="120">2 minutes</option>
            </select>
          </label>
        </section>
        {communityError?<p role="alert" className="rounded-xl border p-4 text-sm text-destructive">{communityError}</p>:null}
        {communityNotice?<p role="status" className="rounded-xl border p-4 text-sm text-muted-foreground">{communityNotice}</p>:null}
        <p className="text-sm text-muted-foreground" role="status">{communityTotal} approved community template{communityTotal===1?'':'s'}</p>
        {!community.length&&!communityError?<div className="rounded-2xl border border-dashed p-10 text-center">
          <h2 className="font-semibold">No approved community templates match</h2>
          <p className="mt-2 text-sm text-muted-foreground">Private and pending submissions never appear here.</p>
        </div>:null}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {community.map(item=><article key={item.id} className="overflow-hidden rounded-2xl border bg-card">
            <div className="grid aspect-video place-items-center bg-muted/30 p-4">
              <div className="w-full max-w-xs space-y-2 text-center">
                <div className="text-2xl font-semibold">{item.aspect}</div>
                <div className="flex justify-center gap-1">{Array.from({length:Math.min(item.clipCount,12)},(_,i)=><span key={i} className="h-2 flex-1 rounded-full bg-foreground/20" />)}</div>
                <div className="text-xs text-muted-foreground">{item.clipCount} editable clip{item.clipCount===1?'':'s'} · {(item.durationMs/1000).toFixed(1)}s</div>
              </div>
            </div>
            <div className="space-y-2 p-4">
              <h2 className="font-semibold">{item.title}</h2>
              <p className="text-xs text-muted-foreground">By {item.creatorName} · {item.category}</p>
              <p className="line-clamp-3 text-sm">{item.description}</p>
              {item.tags.length?<div className="flex flex-wrap gap-1">{item.tags.map(tag=><span key={tag} className="rounded-full border px-2 py-0.5 text-[10px]">{tag}</span>)}</div>:null}
              <p className="text-[11px] text-muted-foreground">{item.licenseTerms}</p>
              <div className="flex gap-2">
                <Link href={'/app/clips/community-templates/'+encodeURIComponent(item.id)}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground">Preview & use template</Link>
                <button type="button" className="rounded-lg border px-3 py-2 text-xs"
                  onClick={()=>setReportTemplate({id:item.id,title:item.title})}>Report</button>
              </div>
            </div>
          </article>)}
        </div>
        {communityPages>1?<nav aria-label="Community template pages" className="flex items-center justify-center gap-3">
          <button type="button" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-lg border px-3 py-2 disabled:opacity-50">Previous</button>
          <span className="text-sm">Page {page} of {communityPages}</span>
          <button type="button" disabled={page===communityPages} onClick={()=>setPage(p=>Math.min(communityPages,p+1))} className="rounded-lg border px-3 py-2 disabled:opacity-50">Next</button>
        </nav>:null}
      </section>}
      <SubmitCommunityTemplateDialog template={submitTemplate} onClose={()=>setSubmitTemplate(null)}
        onSubmitted={()=>{setMineRefresh(x=>x+1);setSubmitTemplate(null)}} />
      <ReportCommunityTemplateDialog publicationId={reportTemplate?.id??null} title={reportTemplate?.title??''}
        onClose={()=>setReportTemplate(null)}
        onReported={()=>{setCommunityNotice('Report submitted for moderator review.');setReportTemplate(null)}} />
      <VideoTemplateGalleryDetailDialog item={detailTemplate} onClose={() => setDetailTemplate(null)} />
    </main>
  )
}
