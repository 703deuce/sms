'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  AudioLines,
  BookOpen,
  Clapperboard,
  Download,
  Film,
  FolderOpen,
  Layers,
  Loader2,
  Pencil,
  Rows3,
  Shapes,
  Sparkles,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { StatusBadge } from '@/components/app/status'
import { ProcessingStepRail } from '@/components/clips/processing-step-rail'
import { cn } from '@/lib/utils'
import { getMotionStudioClient } from '@/lib/motion-studio'
import { newIdempotencyKey, assetKindForFile, type MotionStudioClient } from '@/lib/motion-studio/client'
import { MOTION_STUDIO_NAME, MOTION_STUDIO_ROUTE, MS_LABELS, MS_PROJECT_SECTIONS, MS_STAGES, type MsProjectSection } from '@/lib/motion-studio/config'
import { formatClock } from '@/lib/motion-studio/format'
import { sceneAt } from '@/lib/motion-studio/timeline'
import type { MsScenePatch, MsSettings } from '@/lib/motion-studio/types'
import { STATUS_LABEL, STATUS_TONE } from './motion-studio-create'
import { useMotionProject } from './use-motion-project'
import { InlineError, MockDataNotice, StageStatusIcon } from './motion-studio-shared'
import { SetupStep } from './setup-step'
import { ProductionActivity } from './production-activity'
import { MediaLibrary } from './media-library'
import { StoryReview } from './story-review'
import { Storyboard } from './storyboard'
import { Inspector } from './inspector'
import { DirectorChat } from './director-chat'
import { PreviewStage } from './preview-stage'
import { MotionStudioTracks } from './motion-studio-tracks'
import { MotionExportDialog } from './export-dialog'

const SECTION_ICON: Record<MsProjectSection, typeof BookOpen> = { Story: BookOpen, Media: FolderOpen, Scenes: Film, Graphics: Shapes, Audio: AudioLines }
type MobileTab = 'chat' | 'storyboard' | 'preview' | 'timeline'
const MOBILE_TABS: { id: MobileTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'preview', label: 'Preview' },
  { id: 'timeline', label: 'Timeline' },
]

/** One workspace for every stage (ST-UX-040): setup → plan → production → review → export. */
export function MotionStudioWorkspace({ projectId, client: injected, pollMs = 1500 }: { projectId: string; client?: MotionStudioClient; pollMs?: number }) {
  const client = useMemo(() => injected ?? getMotionStudioClient(), [injected])
  const router = useRouter()
  const { project, events, loadError, actionError, setActionError, busy, act, refresh } = useMotionProject(client, projectId, pollMs)
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [playheadMs, setPlayheadMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [bottom, setBottom] = useState<'storyboard' | 'timeline'>('storyboard')
  const [section, setSection] = useState<Exclude<MsProjectSection, 'Media'> | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('preview')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [uploads, setUploads] = useState<{ key: string; name: string; percent: number; error?: string | null }[]>([])
  const keys = useRef({ plan: newIdempotencyKey('ms_plan'), run: newIdempotencyKey('ms_run'), export: newIdempotencyKey('ms_export') })
  const bottomRef = useRef<HTMLDivElement>(null)

  const scenes = project?.scenes ?? []
  useEffect(() => {
    if (!selectedSceneId && scenes.length) setSelectedSceneId(scenes[0]!.id)
  }, [scenes, selectedSceneId])
  // While playing, the selection follows the playhead.
  useEffect(() => {
    if (!playing) return
    const s = sceneAt(scenes, playheadMs)
    if (s && s.id !== selectedSceneId) setSelectedSceneId(s.id)
  }, [playing, playheadMs, scenes, selectedSceneId])

  const scene = scenes.find((s) => s.id === selectedSceneId) ?? null
  const selectScene = useCallback(
    (id: string) => {
      setSelectedSceneId(id)
      const s = scenes.find((x) => x.id === id)
      if (s) setPlayheadMs(s.startMs)
      setPlaying(false)
    },
    [scenes],
  )

  if (loadError && !project) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-16">
        <InlineError message={loadError} action={<Button size="xs" variant="outline" onClick={() => void refresh()}>Retry</Button>} />
        <Link href={MOTION_STUDIO_ROUTE} className="text-sm text-primary hover:underline">Back to {MS_LABELS.myProjects}</Link>
      </div>
    )
  }
  if (!project) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground" aria-busy="true" data-testid="ms-workspace-loading">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        Loading project…
      </div>
    )
  }

  const total = project.durationMs || scenes.at(-1)?.endMs || project.settings.lengthMin * 60_000
  const stageIndex = (() => {
    const i = project.stages.findIndex((s) => s.status !== 'done')
    return i < 0 ? MS_STAGES.length : i
  })()
  const awaitingReview = project.status === 'awaiting_review' && project.settings.productionMode === 'checkpoint' && !project.story?.approved
  const canExport = project.status === 'review' || project.status === 'complete' || project.status === 'exporting'

  const patchSettings = (patch: Partial<MsSettings>) => void act('settings', () => client.updateProject(project.id, { settings: patch }))
  const createPlan = () =>
    void act('plan', async () => {
      const planned = await client.createPlan(project.id, keys.current.plan)
      // Fully automatic: production follows the plan with no stop (ST-UX-071). Checkpoint waits for Approve.
      if (project.settings.productionMode === 'auto') return client.startProduction(project.id, 'auto', keys.current.run)
      return planned
    })
  const approve = () =>
    void act('approve', async () => {
      await client.approveStory(project.id)
      return client.startProduction(project.id, project.settings.productionMode, keys.current.run)
    })
  const patchScene = (sceneId: string, patch: MsScenePatch) => void act('scene', () => client.updateScene(project.id, sceneId, patch))
  const regenerate = (sceneId: string) => void act('regenerate', () => client.regenerateScene(project.id, sceneId, null, newIdempotencyKey('ms_regen')))
  const editTimeline = (sceneId: string) => {
    selectScene(sceneId)
    setBottom('timeline')
    setMobileTab('timeline')
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }
  const openEditor = () =>
    void act('editor', async () => {
      const h = await client.openInEditor(project.id)
      // Compact Editor with the Motion Studio lanes (EditorShell `motionStudioSlot`); existing clip editing is unchanged.
      router.push(`/app/video-editor/${encodeURIComponent(h.clipProjectId)}/edit/${encodeURIComponent(h.clipId)}?motionStudio=${encodeURIComponent(project.id)}`)
    })
  const uploadToLibrary = (files: File[]) => {
    for (const file of files) {
      const key = `${file.name}-${Math.random().toString(36).slice(2, 7)}`
      setUploads((u) => [...u, { key, name: file.name, percent: 0 }])
      void (async () => {
        try {
          const { uploadId } = await client.uploadFile(file, (percent) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, percent } : x))))
          await act('assets', () => client.addAssets(project.id, [{ uploadId, kind: assetKindForFile(file), label: file.name }]))
          setUploads((u) => u.filter((x) => x.key !== key))
        } catch (err) {
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: err instanceof Error ? err.message : 'Upload failed' } : x)))
        }
      })()
    }
  }
  const openSection = (s: MsProjectSection) => (s === 'Media' ? setLibraryOpen(true) : setSection(s))
  const saveTitle = () => {
    setEditingTitle(false)
    const t = titleDraft.trim()
    if (t && t !== project.title) void act('title', () => client.updateProject(project.id, { title: t }))
  }

  const header = (
    <header className="flex flex-col gap-3 border-b border-border px-4 py-3 md:px-6" data-testid="ms-workspace-header">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={MOTION_STUDIO_ROUTE} className="inline-flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={`${MOTION_STUDIO_NAME}: ${MS_LABELS.myProjects}`}>
          <ArrowLeft className="size-3.5" aria-hidden />
          <Clapperboard className="size-3.5" aria-hidden />
        </Link>
        {editingTitle ? (
          <Input
            autoFocus
            aria-label="Project title"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle()
              if (e.key === 'Escape') setEditingTitle(false)
            }}
            className="h-8 max-w-md text-base font-semibold"
            data-testid="ms-title-input"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleDraft(project.title)
              setEditingTitle(true)
            }}
            className="group inline-flex min-w-0 items-center gap-2 rounded-md px-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            data-testid="ms-title"
          >
            <h1 className="truncate text-page-title tracking-tight">{project.title}</h1>
            <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-label="Rename" />
          </button>
        )}
        {project.isExample ? <StatusBadge tone="info">{MS_LABELS.exampleProject}</StatusBadge> : null}
        <StatusBadge tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</StatusBadge>
        <span className="font-mono text-sm text-muted-foreground tabular-nums" data-testid="ms-header-time">
          {formatClock(playheadMs)} / {formatClock(total)}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setActivityOpen(true)} data-testid="ms-open-activity">
            <Activity className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">{MS_LABELS.productionActivity}</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLibraryOpen(true)} data-testid="ms-open-library">
            <FolderOpen className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">{MS_LABELS.mediaLibrary}</span>
          </Button>
          {project.status !== 'setup' ? (
            <Button size="sm" variant={canExport ? 'default' : 'outline'} onClick={() => setExportOpen(true)} data-testid="ms-open-export">
              <Download className="size-3.5" aria-hidden />
              Export
            </Button>
          ) : null}
        </div>
      </div>
      {project.status !== 'setup' ? (
        <div className="overflow-x-auto" aria-label="Production stages">
          <ProcessingStepRail steps={MS_STAGES.map((s) => s.label)} current={stageIndex} />
        </div>
      ) : null}
    </header>
  )

  const director = (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground"><Sparkles className="size-3.5 text-lane-ai" aria-hidden />{MS_LABELS.aiDirector}</h2>
      <DirectorChat
        project={project}
        scene={scene}
        busy={busy}
        onSend={(text, sceneId) => void act('director', () => client.sendDirectorMessage(project.id, text, sceneId))}
        onDecide={(pid, ids, decision) => void act('proposal', () => client.decideProposal(project.id, pid, ids, decision))}
      />
    </div>
  )

  const projectNav = (
    <nav aria-label={MS_LABELS.project} className="flex flex-col gap-1">
      <h2 className="px-2 text-xs font-semibold tracking-wide text-muted-foreground">{MS_LABELS.project}</h2>
      {MS_PROJECT_SECTIONS.map((s) => {
        const Icon = SECTION_ICON[s]
        return (
          <button key={s} type="button" onClick={() => openSection(s)} className="flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-foreground/90 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" data-testid={`ms-section-${s.toLowerCase()}`}>
            <Icon className="size-4 text-muted-foreground" aria-hidden />
            {s}
            {s === 'Story' && awaitingReview ? <span className="ml-auto size-2 rounded-full bg-warning" aria-label="Needs review" /> : null}
          </button>
        )
      })}
    </nav>
  )

  const preview = (
    <div className="flex min-w-0 flex-col gap-3">
      <PreviewStage project={project} scene={scene} playheadMs={playheadMs} playing={playing} onPlayingChange={setPlaying} onTime={setPlayheadMs} onSelectScene={selectScene} />
      {project.status === 'planning' || project.status === 'producing' ? (
        <section className="rounded-xl border border-border bg-card p-3" aria-label={MS_LABELS.productionActivity}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{MS_LABELS.productionActivity}</h2>
            <Button size="xs" variant="ghost" onClick={() => setActivityOpen(true)}>Open</Button>
          </div>
          <ProductionActivity project={project} events={events.slice(-4)} onRetry={(st) => void act('retry', () => client.retryStage(project.id, st, newIdempotencyKey('ms_retry')))} busy={busy} compact />
        </section>
      ) : null}
    </div>
  )

  const inspector = (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground">{MS_LABELS.inspector}</h2>
      <Inspector project={project} scene={scene} busy={busy} onPatch={patchScene} onRegenerate={regenerate} onEditTimeline={editTimeline} />
    </div>
  )

  const bottomPanel = (
    <div ref={bottomRef} className="flex flex-col gap-3" data-testid="ms-bottom">
      <div className="flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Storyboard or timeline" className="inline-flex rounded-lg bg-muted p-0.5">
          {(['storyboard', 'timeline'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={bottom === v}
              onClick={() => setBottom(v)}
              className={cn('h-7 rounded-md px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', bottom === v ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
              data-testid={`ms-bottom-${v}`}
            >
              {v === 'storyboard' ? MS_LABELS.storyboard : MS_LABELS.timeline}
            </button>
          ))}
        </div>
        {bottom === 'timeline' ? (
          <Button size="sm" variant="outline" onClick={openEditor} disabled={busy != null || !canExport} title={!canExport ? 'Available once the documentary is assembled' : undefined} data-testid="ms-open-editor-timeline">
            <Rows3 className="size-3.5" aria-hidden />
            {MS_LABELS.openAdvanced}
          </Button>
        ) : null}
      </div>
      {bottom === 'storyboard' ? (
        <Storyboard project={project} selectedSceneId={selectedSceneId} onSelect={selectScene} />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <MotionStudioTracks project={project} playheadMs={playheadMs} selectedSceneId={selectedSceneId} onSeek={(ms) => { setPlayheadMs(ms); setPlaying(false) }} onSelectScene={(id) => setSelectedSceneId(id)} />
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex min-h-full flex-col" data-testid="ms-workspace" data-status={project.status}>
      {header}
      <div className="flex flex-col gap-3 px-4 pt-3 md:px-6">
        {client.mode === 'mock' ? <MockDataNotice /> : null}
        {actionError ? <InlineError message={actionError} onDismiss={() => setActionError(null)} /> : null}
        {awaitingReview ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3" role="status" data-testid="ms-checkpoint">
            <div className="flex items-center gap-2 text-sm">
              <StageStatusIcon status="needs_review" />
              <span><span className="font-medium">Checkpoint.</span> The story and visual plan are ready. Production starts when you approve.</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSection('Story')}>Review story</Button>
              <Button size="sm" onClick={approve} disabled={busy != null} data-testid="ms-checkpoint-approve">Approve and start production</Button>
            </div>
          </div>
        ) : null}
      </div>

      {project.status === 'setup' ? (
        <SetupStep project={project} busy={busy} onChange={patchSettings} onPlan={createPlan} />
      ) : (
        <>
          {/* Mobile (< md): separate tabs in the same project (ST-UX-131). */}
          <div role="tablist" aria-label="Workspace" className="sticky top-0 z-10 mx-4 mt-3 grid grid-cols-4 rounded-lg bg-muted p-0.5 md:hidden" data-testid="ms-mobile-tabs">
            {MOBILE_TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={mobileTab === t.id} onClick={() => setMobileTab(t.id)} className={cn('h-8 rounded-md text-xs font-medium', mobileTab === t.id ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground')} data-testid={`ms-tab-${t.id}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-4 md:grid-cols-[260px_minmax(0,1fr)] md:px-6 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
            <aside className={cn('flex min-h-0 flex-col gap-4 rounded-xl border border-border bg-card p-3 md:max-h-[calc(100vh-11rem)] md:flex', mobileTab === 'chat' ? 'flex' : 'hidden')} data-testid="ms-left">
              {projectNav}
              <div className="h-px bg-border" />
              {director}
            </aside>
            <main className={cn('min-w-0 flex-col gap-3 md:flex', mobileTab === 'preview' ? 'flex' : 'hidden')} data-testid="ms-center">
              {preview}
              {/* Inspector docks under the preview below xl and on mobile. */}
              <div className="rounded-xl border border-border bg-card p-3 xl:hidden">{inspector}</div>
            </main>
            <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card p-3 xl:flex xl:max-h-[calc(100vh-11rem)]" data-testid="ms-right">
              {inspector}
            </aside>
            <section className={cn('rounded-xl border border-border bg-card p-3 md:col-span-2 md:block xl:col-span-3', mobileTab === 'storyboard' || mobileTab === 'timeline' ? 'block' : 'hidden')}>
              {mobileTab === 'timeline' || mobileTab === 'storyboard' ? <div className="md:hidden">{mobileBottom()}</div> : null}
              <div className="hidden md:block">{bottomPanel}</div>
            </section>
          </div>
        </>
      )}

      <Sheet open={activityOpen} onOpenChange={(o) => setActivityOpen(o)}>
        <SheetContent side="right" className="w-full p-4 sm:max-w-md" data-testid="ms-activity-sheet">
          <SheetHeader className="p-0">
            <SheetTitle>{MS_LABELS.productionActivity}</SheetTitle>
            <SheetDescription>Live steps and the director’s reasoning. Watching is optional; nothing here needs your input.</SheetDescription>
          </SheetHeader>
          <ProductionActivity project={project} events={events} busy={busy} onRetry={(st) => void act('retry', () => client.retryStage(project.id, st, newIdempotencyKey('ms_retry')))} />
        </SheetContent>
      </Sheet>

      <Sheet open={libraryOpen} onOpenChange={(o) => setLibraryOpen(o)}>
        <SheetContent side="right" className="w-full p-4 sm:max-w-lg" data-testid="ms-library-sheet">
          <SheetHeader className="p-0">
            <SheetTitle>{MS_LABELS.mediaLibrary}</SheetTitle>
            <SheetDescription>Your uploads and what the analysis found. Replacing an asset re-renders only the scenes that use it.</SheetDescription>
          </SheetHeader>
          <MediaLibrary project={project} busy={busy} uploads={uploads} onUpload={uploadToLibrary} onReplace={(a, b) => void act('replace', () => client.replaceAsset(project.id, a, b))} />
        </SheetContent>
      </Sheet>

      <Sheet open={section != null} onOpenChange={(o) => !o && setSection(null)}>
        <SheetContent side="left" className="w-full p-4 sm:max-w-lg" data-testid="ms-section-sheet">
          <SheetHeader className="p-0">
            <SheetTitle>{section}</SheetTitle>
            <SheetDescription>{section === 'Story' ? 'Chapters, script and sources.' : section === 'Scenes' ? 'Every scene in order. Select one to edit it.' : section === 'Graphics' ? 'Motion graphics by scene.' : 'Narration and music.'}</SheetDescription>
          </SheetHeader>
          {section === 'Story' ? (
            <StoryReview project={project} busy={busy} onApprove={approve} onRequestChanges={(note) => void act('story', () => client.requestStoryChanges(project.id, note))} />
          ) : section === 'Scenes' || section === 'Graphics' ? (
            <ul className="flex min-h-0 flex-col gap-1.5 overflow-y-auto">
              {scenes.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => { selectScene(s.id); setSection(null) }} className={cn('flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', s.id === selectedSceneId ? 'border-primary/50 bg-primary/5' : 'border-border')}>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatClock(s.startMs)}</span>
                    <span className="min-w-0 flex-1 truncate">{section === 'Graphics' ? s.graphicName : s.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{section === 'Graphics' ? s.tags[0] : s.treatment}</span>
                    {s.status === 'rendering' ? <Loader2 className="size-3.5 animate-spin text-primary motion-reduce:animate-none" aria-label="Rendering" /> : null}
                  </button>
                </li>
              ))}
              {!scenes.length ? <li className="text-sm text-muted-foreground">Scenes appear when the visual plan is ready.</li> : null}
            </ul>
          ) : section === 'Audio' ? (
            <div className="flex flex-col gap-3">
              {[
                { icon: AudioLines, title: 'Voiceover', label: project.audio.voice.label, status: project.audio.voice.status },
                { icon: Layers, title: 'Music', label: project.audio.music.label, status: project.audio.music.status },
              ].map((r) => (
                <div key={r.title} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <r.icon className="size-4 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.label}</p>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{r.status}</span>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => { setSection(null); setLibraryOpen(true) }}>
                <Upload className="size-3.5" aria-hidden />
                Upload music or narration
              </Button>
              <p className="text-xs text-muted-foreground">Music is optional. Without an upload, a score is generated from this story’s beats.</p>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <MotionExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        project={project}
        busy={busy}
        onExport={() => void act('export', () => client.startExport(project.id, keys.current.export))}
        onDownload={() =>
          void act('download', async () => {
            const d = await client.getExportDownload(project.id)
            const a = document.createElement('a')
            a.href = d.url
            a.download = d.filename
            a.rel = 'noopener'
            a.click()
          })
        }
        onOpenEditor={openEditor}
      />
    </div>
  )

  function mobileBottom() {
    if (!project) return null
    return mobileTab === 'storyboard' ? (
      <Storyboard project={project} selectedSceneId={selectedSceneId} onSelect={(id) => { selectScene(id); setMobileTab('preview') }} />
    ) : (
      <div className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <MotionStudioTracks project={project} playheadMs={playheadMs} selectedSceneId={selectedSceneId} onSeek={setPlayheadMs} onSelectScene={setSelectedSceneId} />
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={openEditor} disabled={busy != null || !canExport}>{MS_LABELS.openAdvanced}</Button>
      </div>
    )
  }
}
