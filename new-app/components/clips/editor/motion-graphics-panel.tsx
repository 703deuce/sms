'use client'

import { useEffect, useRef, useState } from 'react'
import { canonicalEditsJson, type ClipEditsV2 } from '@/lib/clips/edits'
import { MotionModeSchema, MotionPlanSchema, StyleProfileSchema, type StyleProfile, type MotionPlan } from '@/lib/clips/motion-graphics/contract'
import { addTextBackedMotionPlan, removeTextBackedMotionGraphics } from '@/lib/clips/motion-graphics/text-adapter'

type Style = 'minimal' | 'narrative' | 'gaming' | 'tech'
const PRESETS: { id: Style; label: string }[] = [
  { id: 'minimal', label: 'Minimal Professional' },
  { id: 'narrative', label: 'Narrative Motion' },
  { id: 'gaming', label: 'Gaming Highlights' },
  { id: 'tech', label: 'Tech Motion' },
]

export function MotionGraphicsPanel(props: {
  clipId: string
  edits: ClipEditsV2
  onEdits: (next: ClipEditsV2) => void
}) {
  const [style, setStyle] = useState<Style>('narrative')
  const [mode, setMode] = useState<MotionPlan['mode']>('single_source_story')
  const [profiles, setProfiles] = useState<StyleProfile[]>([])
  const [profileId, setProfileId] = useState('')
  const [renameProfileName, setRenameProfileName] = useState('')
  const [managingProfile, setManagingProfile] = useState(false)
  const [newStyleName, setNewStyleName] = useState('')
  const [savingStyle, setSavingStyle] = useState(false)
  const [referenceFiles, setReferenceFiles] = useState<File[]>([])
  const [referenceVideo, setReferenceVideo] = useState<File | null>(null)
  const [referenceAuthorized, setReferenceAuthorized] = useState(false)
  const [analyzingReferences, setAnalyzingReferences] = useState(false)
  const [analyzedStyle, setAnalyzedStyle] = useState<StyleProfile | null>(null)
  const [instruction, setInstruction] = useState('')
  const [plan, setPlan] = useState<MotionPlan | null>(null)
  const [excludedGraphicIds, setExcludedGraphicIds] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [revisionInstruction, setRevisionInstruction] = useState('')
  const [revising, setRevising] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sourceVersion, setSourceVersion] = useState<number | null>(null)
  const draftSnapshot = useRef<string | null>(null)
  useEffect(() => {
    let live = true
    void fetch('/api/clips/motion-styles').then(r => r.ok ? r.json() : Promise.reject()).then((v: { data?: unknown[] }) => {
      if (!live) return
      setProfiles((v.data ?? []).flatMap(item => {
        const parsed = StyleProfileSchema.safeParse(item)
        return parsed.success ? [parsed.data] : []
      }))
    }).catch(() => { if (live) setProfiles([]) })
    return () => { live = false }
  }, [])
  const aiItems = props.edits.textItems?.filter(i => i.id.startsWith('mg_')) ?? []

  async function generate() {
    setGenerating(true); setError(''); setNotice(''); setPlan(null); setExcludedGraphicIds([])
    const snapshot = canonicalEditsJson(props.edits)
    try {
      const res = await fetch('/api/clips/clips/' + encodeURIComponent(props.clipId) + '/motion-graphics/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style, mode, instruction, ...(profileId ? { profileId } : {}) }),
      })
      const body: unknown = await res.json()
      if (!res.ok) {
        const issue = (body as { error?: string })?.error
        throw new Error(issue || 'Motion graphics generation failed')
      }
      const data = (body as { data?: { plan?: unknown; basedOnEditsSaveVersion?: number } }).data
      const parsed = MotionPlanSchema.safeParse(data?.plan)
      if (!parsed.success) throw new Error('Agent returned an invalid motion graphics plan')
      setSourceVersion(data?.basedOnEditsSaveVersion ?? null)
      draftSnapshot.current = snapshot
      setPlan(parsed.data)
      setNotice(parsed.data.graphics.length
        ? 'Review these suggestions and apply them to editable Text layers.'
        : 'No useful graphic additions found for this clip.')
    } catch (e) {
      setError((e as Error).message || 'Unable to generate graphics')
    } finally {
      setGenerating(false)
    }
  }

  async function analyzeReferences() {
    if ((!referenceFiles.length && !referenceVideo) || !referenceAuthorized) return
    setAnalyzingReferences(true); setError('')
    try {
      let images: { mimeType: string; base64: string; frameTimeMs?: number }[]
      if (referenceVideo) {
        // Decode and sample reference video locally; do not upload the original video.
        const url = URL.createObjectURL(referenceVideo)
        const video = document.createElement('video')
        try {
          video.muted = true; video.preload = 'auto'; video.src = url
          await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve()
            video.onerror = () => reject(new Error('Cannot decode reference video'))
            video.load()
          })
          if (!Number.isFinite(video.duration) || video.duration <= 0)
            throw new Error('Reference video duration is invalid')
          const canvas = document.createElement('canvas')
          const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight))
          canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
          canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Could not sample reference video')
          images = []
          for (const fraction of [.15, .5, .85]) {
            const at = Math.min(Math.max(.02, video.duration * fraction), Math.max(.02, video.duration - .01))
            await new Promise<void>((resolve, reject) => {
              video.onseeked = () => resolve()
              video.onerror = () => reject(new Error('Reference seek failed'))
              video.currentTime = at
            })
            context.drawImage(video, 0, 0, canvas.width, canvas.height)
            images.push({
              mimeType: 'image/jpeg',
              base64: canvas.toDataURL('image/jpeg', .72).split(',')[1] ?? '',
              frameTimeMs: Math.round(at * 1000),
            })
          }
        } finally {
          video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url)
        }
      } else {
        images = await Promise.all(referenceFiles.map(async file => {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
            reader.onerror = () => reject(new Error('Could not read screenshot'))
            reader.readAsDataURL(file)
          })
          return { mimeType: file.type, base64 }
        }))
      }
      const res = await fetch('/api/clips/motion-styles/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorized: true, images, instructions: instruction }),
      })
      const payload: unknown = await res.json()
      const parsed = StyleProfileSchema.safeParse((payload as { data?: { profile?: unknown } }).data?.profile)
      if (!res.ok || !parsed.success) throw new Error('Unable to analyze these screenshots')
      setAnalyzedStyle(parsed.data); setNewStyleName(parsed.data.name)
      setNotice('Reference palette and typography analyzed. Give the style a name and save it.')
    } catch (e) { setError((e as Error).message) }
    finally { setAnalyzingReferences(false) }
  }

  async function renameSelectedProfile() {
    const profile = profiles.find(p => p.id === profileId)
    if (!profile || !renameProfileName.trim() || managingProfile) return
    setManagingProfile(true); setError('')
    try {
      const { id: _id, ...existing } = profile
      const response = await fetch('/api/clips/motion-styles/' + encodeURIComponent(profile.id), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...existing, name: renameProfileName.trim() }),
      })
      const body: unknown = await response.json()
      const parsed = StyleProfileSchema.safeParse((body as { data?: unknown }).data)
      if (!response.ok || !parsed.success) throw new Error('Could not rename the saved style')
      setProfiles(current => current.map(p => p.id === profile.id ? parsed.data : p))
      setRenameProfileName('')
      setNotice('Saved style renamed.')
    } catch (err) { setError((err as Error).message) }
    finally { setManagingProfile(false) }
  }

  async function deleteSelectedProfile() {
    const profile = profiles.find(p => p.id === profileId)
    if (!profile || managingProfile || !window.confirm('Delete saved style "' + profile.name + '"? Existing graphics will not change.')) return
    setManagingProfile(true); setError('')
    try {
      const response = await fetch('/api/clips/motion-styles/' + encodeURIComponent(profile.id), { method: 'DELETE' })
      if (!response.ok) throw new Error('Could not delete saved style')
      setProfiles(current => current.filter(p => p.id !== profile.id))
      setProfileId(''); setRenameProfileName('')
      setNotice('Saved style deleted; graphics already applied to clips remain unchanged.')
    } catch (err) { setError((err as Error).message) }
    finally { setManagingProfile(false) }
  }

  async function createStyle() {
    if (!newStyleName.trim()) return
    setSavingStyle(true); setError('')
    const palette = style === 'gaming' ? ['#FFFFFF', '#FACC15'] :
      style === 'tech' ? ['#FFFFFF', '#34D399'] :
      style === 'narrative' ? ['#FFFFFF', '#22D3EE'] : ['#FFFFFF', '#4ADE80']
    const font = style === 'gaming' ? 'Bangers' : style === 'tech' ? 'Anton' : 'Montserrat'
    try {
      const res = await fetch('/api/clips/motion-styles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 1, name: newStyleName.trim(),
          brandColors: analyzedStyle?.brandColors ?? palette,
          fontFamilies: analyzedStyle?.fontFamilies ?? [font],
          templateIds: analyzedStyle?.templateIds ?? ['kinetic_type', 'lower_third', 'callout'],
          motionDensity: analyzedStyle?.motionDensity ?? (style === 'minimal' ? 'minimal' : style === 'gaming' ? 'dynamic' : 'balanced'),
          references: [], instructions: analyzedStyle?.instructions ?? instruction }),
      })
      const body: unknown = await res.json()
      const parsed = StyleProfileSchema.safeParse((body as { data?: unknown }).data)
      if (!res.ok || !parsed.success) throw new Error('Could not save style profile')
      setProfiles(prev => [parsed.data, ...prev])
      setProfileId(parsed.data.id); setNewStyleName(''); setAnalyzedStyle(null)
      setNotice('Saved workspace style profile. It can be selected in other clips.')
    } catch (e) { setError((e as Error).message) }
    finally { setSavingStyle(false) }
  }

  async function reviseSelected() {
    const candidate = plan ?? props.edits.motionPlan
    if (!candidate || !revisionInstruction.trim()) return
    setRevising(true); setError('')
    try {
      const res = await fetch('/api/clips/clips/' + encodeURIComponent(props.clipId) + '/motion-graphics/revise', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: candidate, instruction: revisionInstruction }),
      })
      const data: unknown = await res.json()
      const result = MotionPlanSchema.safeParse((data as { data?: { plan?: unknown } }).data?.plan)
      if (!res.ok || !result.success) throw new Error('Could not revise the selected graphic')
      if (!plan) draftSnapshot.current = canonicalEditsJson(props.edits)
      setExcludedGraphicIds([])
      setPlan(result.data); setNotice('Review your targeted revision, then Apply to editable timeline.')
      setRevisionInstruction('')
    } catch (e) { setError((e as Error).message) }
    finally { setRevising(false) }
  }

  async function apply() {
    if (!plan || applying) return
    if (draftSnapshot.current !== canonicalEditsJson(props.edits)) {
      setError('Timeline changed since this motion draft was created. Generate a new plan to protect your edits.')
      return
    }
    setApplying(true)
    try {
      if (sourceVersion != null) {
        const response = await fetch('/api/clips/clips/' + encodeURIComponent(props.clipId), { cache: 'no-store' })
        if (!response.ok) throw new Error('Unable to verify current saved editor version')
        const body: unknown = await response.json()
        const current = (body as { data?: { clip?: { editsSaveVersion?: number } } }).data?.clip?.editsSaveVersion
        if (current == null || current !== sourceVersion)
          throw new Error('Another edit was saved after this draft. Generate again to avoid replacing newer work.')
        if (draftSnapshot.current !== canonicalEditsJson(props.edits))
          throw new Error('Timeline changed during verification. Generate a new plan.')
      }
    const selectedPlan = { ...plan, graphics: plan.graphics.filter(g => !excludedGraphicIds.includes(g.id)) }
    const old = props.edits.motionPlan
    const baseEdits = old ? removeTextBackedMotionGraphics(props.edits, old.graphics.map(g => g.id)) : props.edits
    const result = addTextBackedMotionPlan(baseEdits, selectedPlan)
    if (!result.ok) { setError(result.code + ': ' + result.detail); return }
    props.onEdits({ ...result.edits, motionPlan: selectedPlan })
    setNotice('Applied as editable Text layers. Export uses the existing text animation renderer.')
    setError(''); setPlan(null); setExcludedGraphicIds([]); setSourceVersion(null); draftSnapshot.current = null
    } catch (err) { setError((err as Error).message || 'Could not apply graphics') }
    finally { setApplying(false) }
  }

  function clearGenerated() {
    const ids = props.edits.motionPlan?.graphics.map(g => g.id) ?? []
    props.onEdits({ ...removeTextBackedMotionGraphics(props.edits, ids), motionPlan: undefined })
    setNotice('Removed generated motion text; your other editor content is unchanged.')
    setPlan(null); setExcludedGraphicIds([]); setError(''); draftSnapshot.current = null
  }

  return (
    <section className="space-y-4 p-3" data-testid="motion-graphics-panel" aria-label="AI Motion Graphics">
      <div>
        <h3 className="text-sm font-semibold">AI Motion Graphics</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Generate transcript-grounded, editable animated text using the existing preview and export engine.
          This first renderer supports text, highlights, and lower thirds — not charts or presenter masking.
        </p>
      </div>
      <label className="block space-y-1 text-xs">
        <span>Editing mode</span>
        <select className="w-full rounded border bg-background p-2 text-sm" value={mode}
          onChange={e => { const parsed = MotionModeSchema.safeParse(e.target.value); if (parsed.success) setMode(parsed.data) }}>
          <option value="single_source_story">Single-source Story</option>
          <option value="multi_source_story">Multi-source Story</option>
          <option value="clean_take">Clean Take</option>
          <option value="streamer_continuous">Streamer Continuous</option>
          <option value="streamer_story_clip">Streamer Story Clip</option>
          <option value="streamer_long_form">Streamer Long-form</option>
        </select>
      </label>
      <label className="block space-y-1 text-xs">
        <span>Motion style</span>
        <select className="w-full rounded border bg-background p-2 text-sm" value={style}
          onChange={e => setStyle(e.target.value as Style)}>
          {PRESETS.map(p => <option value={p.id} key={p.id}>{p.label}</option>)}
        </select>
      </label>
      <label className="block space-y-1 text-xs">
        <span>Saved Style Profile</span>
        <select className="w-full rounded border bg-background p-2 text-sm" value={profileId}
          onChange={e => setProfileId(e.target.value)}>
          <option value="">Use the preset above</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      {profileId ? (
        <div className="space-y-2 rounded border p-2">
          <label className="block text-xs" htmlFor="motion-profile-rename">Rename selected style</label>
          <input id="motion-profile-rename" className="w-full rounded border bg-background p-2 text-sm"
            placeholder={profiles.find(p => p.id === profileId)?.name || 'Style name'}
            maxLength={100} value={renameProfileName} onChange={e => setRenameProfileName(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="rounded border px-2 py-1 text-xs disabled:opacity-50"
              disabled={!renameProfileName.trim() || managingProfile} onClick={() => void renameSelectedProfile()}>Rename</button>
            <button type="button" className="rounded border px-2 py-1 text-xs disabled:opacity-50"
              disabled={managingProfile} onClick={() => void deleteSelectedProfile()}>Delete saved style</button>
          </div>
        </div>
      ) : null}
      <div className="space-y-2 rounded border p-2">
        <p className="text-xs font-semibold">Analyze reference screenshots</p>
        <p className="text-xs text-muted-foreground">Up to three JPEG/PNG screenshots (2 MB each), or an authorized video (up to 150 MB). Extract original color, typography, and approximate motion styling.</p>
        <input type="file" accept="image/jpeg,image/png" multiple className="w-full text-xs"
          onChange={e => {
            const chosen = Array.from(e.target.files ?? []).slice(0, 3)
            setReferenceFiles(chosen); setReferenceVideo(null); setAnalyzedStyle(null); setReferenceAuthorized(false)
          }} />
        <p className="text-xs text-muted-foreground">Or choose one authorized MP4/WebM reference video. Three frames are sampled locally; the video itself is not uploaded.</p>
        <input type="file" accept="video/mp4,video/webm" className="w-full text-xs"
          onChange={e => {
            const selected = e.target.files?.[0] ?? null
            setReferenceVideo(selected); setReferenceFiles([]); setAnalyzedStyle(null); setReferenceAuthorized(false)
          }} />
        <label className="flex gap-2 text-xs items-start">
          <input type="checkbox" checked={referenceAuthorized} onChange={e => setReferenceAuthorized(e.target.checked)} />
          <span>I have permission to use these reference images for style analysis.</span>
        </label>
        <button type="button" className="rounded border px-3 py-2 text-xs disabled:opacity-50"
          disabled={(!referenceFiles.length && !referenceVideo) || !referenceAuthorized || analyzingReferences || referenceFiles.some(f => f.size > 2_000_000 || !['image/jpeg','image/png'].includes(f.type)) || Boolean(referenceVideo && (referenceVideo.size > 150_000_000 || !['video/mp4', 'video/webm'].includes(referenceVideo.type)))}
          onClick={() => void analyzeReferences()}>{analyzingReferences ? 'Analyzing…' : 'Analyze screenshots'}</button>
        {analyzedStyle ? <p className="text-xs">Suggested: {analyzedStyle.name} · {analyzedStyle.brandColors.join(', ')} · {analyzedStyle.fontFamilies.join(', ')}</p> : null}
      </div>
      <div className="space-y-1">
        <label className="text-xs" htmlFor="motion-new-style">Save current preset as a reusable profile</label>
        <div className="flex gap-2">
          <input id="motion-new-style" className="min-w-0 flex-1 rounded border bg-background p-2 text-sm"
            value={newStyleName} maxLength={100} placeholder="My creator style"
            onChange={e => setNewStyleName(e.target.value)} />
          <button type="button" className="rounded border px-2 text-xs" disabled={!newStyleName.trim() || savingStyle}
            onClick={() => void createStyle()}>{savingStyle ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <label className="block space-y-1 text-xs">
        <span>Additional creative direction (optional)</span>
        <textarea className="min-h-20 w-full rounded border bg-background p-2 text-sm"
          value={instruction} maxLength={1000} onChange={e => setInstruction(e.target.value)}
          placeholder="Keep effects minimal; emphasize the payoff only." />
      </label>
      <button className="w-full rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
        disabled={generating} onClick={() => void generate()} type="button">
        {generating ? 'Planning motion graphics…' : 'AI Generate Motion Graphics'}
      </button>
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
      {notice ? <p className="text-xs" role="status">{notice}</p> : null}
      {(plan || props.edits.motionPlan) ? (
        <div className="space-y-2 rounded border p-2">
          <p className="text-xs font-semibold">Refine a graphic with natural language</p>
          <textarea className="w-full rounded border bg-background p-2 text-xs" rows={2}
            placeholder="Make the score callout smaller; change it to green; remove it"
            maxLength={1000} value={revisionInstruction}
            onChange={e => setRevisionInstruction(e.target.value)} />
          <button type="button" className="rounded border px-3 py-2 text-xs disabled:opacity-50"
            disabled={!revisionInstruction.trim() || revising} onClick={() => void reviseSelected()}>
            {revising ? 'Revising…' : 'Revise one graphic'}
          </button>
        </div>
      ) : null}
      {plan ? (
        <div className="space-y-2 rounded border p-2">
          <p className="text-xs font-semibold">Review {plan.graphics.length} proposed graphics</p>
          <p className="text-xs text-muted-foreground">Select which graphics to add; rejected suggestions will not be rendered or saved.</p>
          {!plan.graphics.length ? <p className="text-xs">Applying this plan removes previously generated graphics without changing manual layers.</p> : null}
          <ul className="max-h-60 space-y-1 overflow-auto">
            {plan.graphics.map(g => (
              <li key={g.id} className="rounded bg-muted/50 p-2 text-xs">
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={!excludedGraphicIds.includes(g.id)}
                    onChange={e => setExcludedGraphicIds(current => e.target.checked
                      ? current.filter(id => id !== g.id) : [...current, g.id])} />
                  <span><strong>{g.text || g.steps?.join(' → ') || g.bars?.map(b => b.label + ': ' + b.value).join(', ') || g.templateId}</strong>
                    {' · '}{(g.startMs / 1000).toFixed(1)}–{(g.endMs / 1000).toFixed(1)}s</span>
                </label>
                <div className="text-muted-foreground">{g.rationale}</div>
              </li>
            ))}
          </ul>
          {sourceVersion != null ? <p className="text-xs text-muted-foreground">
            Generated from saved edit version {sourceVersion}. Review if you've edited the timeline since then.
          </p> : null}
          <button type="button" onClick={() => void apply()} disabled={applying}
            className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50">
            {applying ? 'Checking latest edits…' : 'Apply to editable timeline'}
          </button>
        </div>
      ) : null}
      {aiItems.length ? (
        <div className="space-y-2">
          <p className="text-xs">{aiItems.length} generated text/shape layers in this clip.</p>
          <button type="button" className="rounded border px-3 py-2 text-xs" onClick={clearGenerated}>
            Remove generated graphics
          </button>
        </div>
      ) : null}
    </section>
  )
}
