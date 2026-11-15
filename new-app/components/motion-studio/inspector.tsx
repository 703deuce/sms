'use client'

import { useEffect, useState } from 'react'
import { MousePointerClick, RefreshCw, Rows3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MS_DIRECTIONS, MS_LABELS } from '@/lib/motion-studio/config'
import { formatShortClock, parseShortClock } from '@/lib/motion-studio/format'
import type { MsProject, MsScene, MsScenePatch } from '@/lib/motion-studio/types'
import { InlineError, TimingNote, timingsAreEstimated } from './motion-studio-shared'

const CAMERA_OPTIONS = ['Push in / orbit', 'Slow push-in', 'Pull out', 'Drift and settle', 'Locked off', 'Camera enters photo']
const fieldCls =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

function Row({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function styleOptions(project: MsProject, scene: MsScene): string[] {
  const base = MS_DIRECTIONS.find((d) => d.value === project.settings.visualDirection)?.label ?? 'Cinematic documentary'
  const opts = [`${base} · story variant`, `${base} · data variant`, `${base} · archival variant`, `${base} · high-contrast variant`]
  return opts.includes(scene.style) ? opts : [scene.style, ...opts]
}

/** INSPECTOR (concept §3 right panel): contextual to the selected scene type. */
export function Inspector({
  project,
  scene,
  busy,
  onPatch,
  onRegenerate,
  onEditTimeline,
}: {
  project: MsProject
  scene: MsScene | null
  busy: string | null
  onPatch: (sceneId: string, patch: MsScenePatch) => void
  onRegenerate: (sceneId: string) => void
  onEditTimeline: (sceneId: string) => void
}) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [text, setText] = useState('')
  const [timingError, setTimingError] = useState<string | null>(null)
  useEffect(() => {
    if (!scene) return
    setStart(formatShortClock(scene.startMs))
    setEnd(formatShortClock(scene.endMs))
    setText(scene.text)
    setTimingError(null)
  }, [scene])

  if (!scene) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center" data-testid="ms-inspector-empty">
        <MousePointerClick className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{MS_LABELS.selectHint}</p>
      </div>
    )
  }
  const disabled = busy != null || scene.status === 'rendering'
  const commitTiming = () => {
    const s = parseShortClock(start)
    const e = parseShortClock(end)
    if (s == null || e == null) return setTimingError('Use m:ss, for example 2:12.')
    if (e - s < 1000) return setTimingError('End must be at least one second after start.')
    setTimingError(null)
    if (s !== scene.startMs || e !== scene.endMs) onPatch(scene.id, { startMs: s, endMs: e })
  }
  return (
    <div className="flex flex-col gap-4" data-testid="ms-inspector" data-kind={scene.kind}>
      {scene.status === 'failed' ? (
        <div data-testid="ms-inspector-scene-error">
          <InlineError
            message={scene.error || 'This scene failed to render. Regenerate it to try again.'}
            action={<Button size="xs" variant="outline" onClick={() => onRegenerate(scene.id)} disabled={busy != null}>Regenerate</Button>}
          />
        </div>
      ) : null}
      <section className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">{MS_LABELS.sceneGraphics}</p>
        <p className="text-sm font-semibold" data-testid="ms-inspector-graphic">{scene.graphicName}</p>
        <p className="text-xs text-muted-foreground">{scene.tags.join(' • ')} · v{scene.version}</p>
      </section>

      <Row label={MS_LABELS.timing}>
        <div className="flex items-center gap-2">
          <Input aria-label="Start time" value={start} onChange={(e) => setStart(e.target.value)} onBlur={commitTiming} onKeyDown={(e) => e.key === 'Enter' && commitTiming()} className="h-8 font-mono tabular-nums" disabled={disabled} />
          <span className="text-muted-foreground">–</span>
          <Input aria-label="End time" value={end} onChange={(e) => setEnd(e.target.value)} onBlur={commitTiming} onKeyDown={(e) => e.key === 'Enter' && commitTiming()} className="h-8 font-mono tabular-nums" disabled={disabled} />
        </div>
        {timingError ? <p className="text-xs text-destructive" role="alert">{timingError}</p> : null}
        {timingsAreEstimated(project) ? <TimingNote /> : null}
      </Row>

      <Row label={MS_LABELS.style} htmlFor="ms-insp-style">
        <select id="ms-insp-style" className={fieldCls} value={scene.style} disabled={disabled} onChange={(e) => onPatch(scene.id, { style: e.target.value })}>
          {styleOptions(project, scene).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Row>

      <Row label={MS_LABELS.cameraMovement} htmlFor="ms-insp-camera">
        <select id="ms-insp-camera" className={fieldCls} value={scene.camera} disabled={disabled} onChange={(e) => onPatch(scene.id, { camera: e.target.value })}>
          {(CAMERA_OPTIONS.includes(scene.camera) ? CAMERA_OPTIONS : [scene.camera, ...CAMERA_OPTIONS]).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Row>

      <Row label={MS_LABELS.text} htmlFor="ms-insp-text">
        <Input id="ms-insp-text" value={text} placeholder="On-screen text" disabled={disabled} onChange={(e) => setText(e.target.value)} onBlur={() => text !== scene.text && onPatch(scene.id, { text })} onKeyDown={(e) => e.key === 'Enter' && text !== scene.text && onPatch(scene.id, { text })} className="h-8" />
      </Row>

      <TypeControls scene={scene} disabled={disabled} onPatch={onPatch} />

      <div className="flex flex-col gap-2 border-t border-border/70 pt-3">
        <Button size="sm" onClick={() => onRegenerate(scene.id)} disabled={disabled} data-testid="ms-regenerate">
          <RefreshCw className="size-3.5" aria-hidden />
          {scene.status === 'rendering' ? 'Rendering…' : scene.status === 'failed' ? 'Regenerate scene' : MS_LABELS.regenerate}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onEditTimeline(scene.id)} data-testid="ms-edit-timeline">
          <Rows3 className="size-3.5" aria-hidden />
          {MS_LABELS.editTimeline}
        </Button>
        <p className="text-xs text-muted-foreground">Only this scene re-renders. Code-rendered revisions are included.</p>
      </div>
    </div>
  )
}

/** Per-type control groups (ST-UX-054): chart, photograph, video clip. */
function TypeControls({ scene, disabled, onPatch }: { scene: MsScene; disabled: boolean; onPatch: (sceneId: string, patch: MsScenePatch) => void }) {
  const set = (key: string, value: string | number | boolean) => onPatch(scene.id, { params: { [key]: value } })
  if (scene.kind === 'chart') {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-border p-3" data-testid="ms-controls-chart">
        <p className="text-xs font-medium">Chart</p>
        <Row label="Highlight" htmlFor="ms-chart-hl">
          <select id="ms-chart-hl" className={fieldCls} disabled={disabled} defaultValue="peak" onChange={(e) => set('highlight', e.target.value)}>
            <option value="peak">Peak value</option>
            <option value="trend">Overall trend</option>
            <option value="none">None</option>
          </select>
        </Row>
        <Row label="Label size" htmlFor="ms-chart-ls">
          <input id="ms-chart-ls" type="range" min={80} max={160} step={10} defaultValue={100} disabled={disabled} onChange={(e) => set('labelScale', Number(e.target.value))} className="accent-[var(--primary)]" />
        </Row>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" defaultChecked disabled={disabled} onChange={(e) => set('wordSync', e.target.checked)} className="accent-[var(--primary)]" />
          Sync the key figure to the narration
        </label>
      </section>
    )
  }
  if (scene.kind === 'photo') {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-border p-3" data-testid="ms-controls-photo">
        <p className="text-xs font-medium">Photograph</p>
        <Row label="Crop" htmlFor="ms-photo-crop">
          <select id="ms-photo-crop" className={fieldCls} disabled={disabled} defaultValue="fill" onChange={(e) => set('crop', e.target.value)}>
            <option value="fill">Fill frame</option>
            <option value="fit">Fit with surface</option>
            <option value="subject">Center on subject</option>
          </select>
        </Row>
        <Row label="Depth" htmlFor="ms-photo-depth">
          <input id="ms-photo-depth" type="range" min={0} max={100} defaultValue={40} disabled={disabled} onChange={(e) => set('depth', Number(e.target.value))} className="accent-[var(--primary)]" />
        </Row>
        <Row label="Animation" htmlFor="ms-photo-anim">
          <select id="ms-photo-anim" className={fieldCls} disabled={disabled} defaultValue="parallax" onChange={(e) => set('animation', e.target.value)}>
            <option value="parallax">Layered parallax</option>
            <option value="push">Slow push</option>
            <option value="still">Still</option>
          </select>
        </Row>
      </section>
    )
  }
  if (scene.kind === 'clip') {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-border p-3" data-testid="ms-controls-clip">
        <p className="text-xs font-medium">Video clip</p>
        {scene.handoff ? (
          <ol className="grid grid-cols-3 gap-1 text-center text-xs">
            <li className="rounded-md bg-lane-ai/15 px-1 py-1.5"><span className="block font-medium">1. Approach</span><span className="text-muted-foreground">Camera enters photo</span></li>
            <li className="rounded-md bg-lane-broll/15 px-1 py-1.5"><span className="block font-medium">2. Play footage</span><span className="text-muted-foreground">Original video excerpt</span></li>
            <li className="rounded-md bg-lane-ai/15 px-1 py-1.5"><span className="block font-medium">3. Return</span><span className="text-muted-foreground">Camera resumes journey</span></li>
          </ol>
        ) : null}
        <Row label="Trim (proposed to the Footage Editor)" htmlFor="ms-clip-trim">
          <input id="ms-clip-trim" type="range" min={2} max={30} defaultValue={Math.round((scene.handoff?.footageMs ?? 8000) / 1000)} disabled={disabled} onChange={(e) => set('footageSec', Number(e.target.value))} className="accent-[var(--primary)]" />
        </Row>
        <Row label="Sound" htmlFor="ms-clip-sound">
          <select id="ms-clip-sound" className={fieldCls} disabled={disabled} defaultValue="duck" onChange={(e) => set('sound', e.target.value)}>
            <option value="original">Original audio</option>
            <option value="duck">Original under narration</option>
            <option value="mute">Muted</option>
          </select>
        </Row>
        <Row label="Exit" htmlFor="ms-clip-exit">
          <select id="ms-clip-exit" className={fieldCls} disabled={disabled} defaultValue={scene.handoff?.exit ?? 'return'} onChange={(e) => set('exit', e.target.value)}>
            <option value="return">Return into the world</option>
            <option value="cut">Ordinary cut</option>
          </select>
        </Row>
      </section>
    )
  }
  return null
}
