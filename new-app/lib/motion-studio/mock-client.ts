import { MotionStudioHttpError, type MotionStudioClient } from './client'
import { MS_STAGES } from './config'
import { buildChapters, buildMissingVisuals, buildScenes, titleFromPrompt, topicFromPrompt } from './plan-mock'
import type {
  MsActivityEvent,
  MsActivityStep,
  MsAllowance,
  MsAsset,
  MsAssetKind,
  MsCreateInput,
  MsProject,
  MsProjectStatus,
  MsProposal,
  MsScene,
  MsSettings,
  MsStage,
  MsStageId,
  MsStageStatus,
} from './types'

/**
 * In-browser mock of the `/api/motion-studio/*` contract. It simulates planning, production and export
 * on a clock so every screen can be exercised without the backend. It never calls a paid provider.
 */

type Phase = { at: number; stage: MsStageId; kind: MsActivityEvent['kind']; text: string }

type Rec = {
  project: MsProject
  createIdem: string
  planIdem: string | null
  planAt: number | null
  prodIdem: string | null
  prodAt: number | null
  approved: boolean
  exportIdem: string | null
  exportAt: number | null
  regen: Record<string, number>
  regenKeys?: string[]
  script?: string | null
  extraEvents: MsActivityEvent[]
  cancelledAt?: number | null
}

type Store = { recs: Record<string, Rec>; seq: number }

const STORAGE_KEY = 'motion-studio-mock-v1'
export const MOCK_TIMING = { plan: 9_000, sceneMs: 900, assemble: 4_000, export: 6_000, regen: 3_000, analyzePerAsset: 1_200 }

function iso(ms: number) {
  return new Date(ms).toISOString()
}

const DEFAULT_SETTINGS: MsSettings = { lengthMin: 5, visualDirection: 'cinematic', voiceover: 'ai', format: '16:9_1080p', productionMode: 'checkpoint', webResearch: false }

export type MockOptions = {
  now?: () => number
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  latencyMs?: number
  seedExample?: boolean
}

export function createMockMotionStudioClient(opts: MockOptions = {}): MotionStudioClient {
  const now = opts.now ?? (() => Date.now())
  const storage = opts.storage === undefined ? (typeof window !== 'undefined' ? window.localStorage : null) : opts.storage
  let store: Store = load()
  if (opts.seedExample !== false && !Object.values(store.recs).some((r) => r.project.isExample)) seedExample()

  function load(): Store {
    try {
      const raw = storage?.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as Store
    } catch {
      /* corrupted mock store: start fresh */
    }
    return { recs: {}, seq: 1 }
  }
  function save() {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(store))
    } catch {
      /* quota: mock only */
    }
  }
  const wait = () => new Promise<void>((r) => setTimeout(r, opts.latencyMs ?? 0))
  const id = (p: string) => `${p}_${(store.seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

  function get(pid: string): Rec {
    const rec = store.recs[pid]
    if (!rec) throw new MotionStudioHttpError(404, 'NOT_FOUND', 'Project not found.')
    return rec
  }

  function baseProject(input: { title: string; prompt: string; workflow: MsCreateInput['workflow']; assets: MsAsset[]; t: number; pid: string; example?: boolean }): MsProject {
    return {
      id: input.pid,
      title: input.title,
      isExample: Boolean(input.example),
      createdAt: iso(input.t),
      updatedAt: iso(input.t),
      workflow: input.workflow,
      prompt: input.prompt,
      mediaPolicy: 'uploads_only',
      settings: { ...DEFAULT_SETTINGS },
      status: 'setup',
      stages: MS_STAGES.map((s) => ({ id: s.id, status: 'pending' })),
      activity: [],
      story: null,
      scenes: [],
      assets: input.assets,
      missingVisuals: [],
      audio: {
        voice: { mode: 'ai', label: 'AI voice · documentary narrator', status: 'planned' },
        music: { source: 'generated', label: 'Score generated from the story beats', status: 'planned' },
      },
      durationMs: 0,
      previewUrl: null,
      styleRationale: null,
      proposals: [],
      director: [],
      allowance: null,
      export: { status: 'idle', progress: 0 },
    }
  }

  function assetsFrom(uploads: MsCreateInput['uploads'], t: number): MsAsset[] {
    return uploads.map((u, i) => ({
      id: `as_${u.uploadId}`,
      kind: u.kind,
      label: u.label,
      url: null,
      durationMs: u.durationMs ?? null,
      role: u.kind === 'video' ? 'footage' : u.kind === 'photo' ? 'photo' : u.kind === 'audio' ? (/(vo|voice|narrat)/i.test(u.label) ? 'narration' : 'music') : 'script',
      analysis: { status: 'queued' },
      intendedUse: null,
      chapterId: null,
      sceneIds: [],
      uploadedAt: iso(t + i),
    }))
  }

  function seedExample() {
    const t = now() - 3 * 86_400_000
    const pid = 'ms_example_gamestop'
    const project = baseProject({
      pid,
      t,
      title: 'GameStop: The Short Squeeze',
      prompt: 'Make a 5-minute documentary about the GameStop short squeeze in 2021. Netflix-style financial documentary.',
      workflow: 'idea',
      assets: [],
      example: true,
    })
    store.recs[pid] = {
      project,
      createIdem: 'seed',
      planIdem: 'seed',
      planAt: t,
      prodIdem: 'seed',
      prodAt: t,
      approved: true,
      exportIdem: null,
      exportAt: null,
      regen: {},
      extraEvents: [],
    }
    save()
  }

  /** Derive everything time-based (stage status, scene status, activity, export). */
  function materialize(rec: Rec): MsProject {
    const t = now()
    const p = structuredClone(rec.project)
    const stage = (sid: MsStageId, status: MsStageStatus, progressLabel?: string) => {
      const s = p.stages.find((x) => x.id === sid) as MsStage
      s.status = status
      s.progressLabel = progressLabel ?? null
    }
    const visualAssets = p.assets.length
    const planEnd = rec.planAt != null ? rec.planAt + MOCK_TIMING.plan : null
    const analyzeEnd = rec.planAt != null ? rec.planAt + Math.min(MOCK_TIMING.plan - 1000, 1500 + visualAssets * MOCK_TIMING.analyzePerAsset) : null
    // Assets analysis status
    p.assets = p.assets.map((a, i) => {
      if (rec.planAt == null) return a
      const done = rec.planAt + 1000 + (i + 1) * MOCK_TIMING.analyzePerAsset * 0.6
      const status = t >= done ? 'ready' : t >= rec.planAt + 500 ? 'analyzing' : 'queued'
      return { ...a, analysis: { ...a.analysis, ...(status === 'ready' ? analysisFor(a) : {}), status } }
    })
    let status: MsProjectStatus = 'setup'
    if (rec.planAt != null && planEnd != null) {
      status = 'planning'
      const storyDone = t >= rec.planAt + 6000
      stage('story', storyDone ? (p.settings.productionMode === 'checkpoint' && !rec.approved ? 'needs_review' : 'done') : 'running')
      stage('assets', analyzeEnd != null && t >= analyzeEnd ? 'done' : 'running', `${p.assets.filter((a) => a.analysis.status === 'ready').length} of ${p.assets.length} uploads analyzed`)
      stage('direct', t >= planEnd ? 'done' : t >= rec.planAt + 5000 ? 'running' : 'pending')
      if (t >= planEnd) {
        const waiting = p.settings.productionMode === 'checkpoint' && !rec.approved
        status = waiting ? 'awaiting_review' : rec.prodAt != null ? 'producing' : 'awaiting_review'
      }
    }
    const prodStart = rec.prodAt != null && planEnd != null && (rec.approved || p.settings.productionMode === 'auto') ? Math.max(rec.prodAt, planEnd) : null
    let reviewAt: number | null = null
    if (prodStart != null) {
      const n = p.scenes.length
      const ready = Math.max(0, Math.min(n, Math.floor((t - prodStart) / MOCK_TIMING.sceneMs)))
      p.scenes = p.scenes.map((s, i) => ({ ...s, status: i < ready ? 'ready' : t >= prodStart ? (i === ready ? 'rendering' : 'planned') : 'planned' }))
      const gEnd = prodStart + n * MOCK_TIMING.sceneMs
      stage('graphics', t >= gEnd ? 'done' : t >= prodStart ? 'running' : 'pending', `${ready} of ${n} scenes`)
      const aEnd = gEnd + MOCK_TIMING.assemble
      stage('assemble', t >= aEnd ? 'done' : t >= gEnd ? 'running' : 'pending')
      if (t >= aEnd) {
        reviewAt = aEnd
        stage('review', 'running')
        status = 'review'
        p.durationMs = p.scenes.at(-1)?.endMs ?? 0
        p.audio.voice.status = 'ready'
        p.audio.music.status = 'ready'
      } else {
        status = 'producing'
        p.audio.voice.status = t >= gEnd ? 'rendering' : 'planned'
        p.audio.music.status = t >= gEnd ? 'rendering' : 'planned'
      }
    }
    // Per-scene regenerations (only that scene re-renders, ST-RR-001).
    for (const [sid, at] of Object.entries(rec.regen)) {
      const s = p.scenes.find((x) => x.id === sid)
      if (!s) continue
      if (t < at + MOCK_TIMING.regen) s.status = 'rendering'
    }
    // Export
    if (rec.exportAt != null && reviewAt != null) {
      const prog = Math.min(100, Math.round(((t - rec.exportAt) / MOCK_TIMING.export) * 100))
      p.export = prog >= 100
        ? { status: 'ready', progress: 100, filename: `${slug(p.title)}.mp4` }
        : { status: prog < 5 ? 'queued' : 'rendering', progress: Math.max(0, prog) }
      if (prog >= 100) {
        status = 'complete'
        stage('review', 'done')
      } else status = 'exporting'
    }
    if (rec.cancelledAt != null && (status === 'planning' || status === 'producing' || status === 'awaiting_review' || status === 'exporting')) {
      status = 'failed'
      p.error = 'Cancelled.'
      for (const st of p.stages) if (st.status === 'running' || st.status === 'needs_review') { st.status = 'failed'; st.error = 'Cancelled.' }
      if (p.export.status === 'queued' || p.export.status === 'rendering') p.export = { status: 'idle', progress: 0 }
    }
    p.status = status
    p.activity = activitySteps(p, rec)
    p.allowance = allowanceFor(p.settings, p.assets)
    return p
  }

  function activitySteps(p: MsProject, rec: Rec): MsActivityStep[] {
    const st = (id: MsStageId) => p.stages.find((s) => s.id === id)?.status ?? 'pending'
    const readyScenes = p.scenes.filter((s) => s.status === 'ready').length
    const analyzed = p.assets.filter((a) => a.analysis.status === 'ready').length
    const latest = (stage: MsStageId) => [...eventsUntil(rec)].reverse().find((e) => e.stage === stage)?.text ?? null
    return [
      { id: 'story_research', status: st('story'), counts: p.story ? `${p.story.chapters.length} chapters · ${p.story.chapters.reduce((n, c) => n + c.lines.filter((l) => l.sources.length).length, 0)} sourced claims` : null, latestAction: latest('story') },
      { id: 'uploads_analyzed', status: st('assets'), counts: `${p.assets.length} uploads · ${analyzed} analyzed · ${p.missingVisuals.length} missing visuals`, latestAction: latest('assets') },
      { id: 'storyboard', status: st('direct'), counts: p.scenes.length ? `${p.scenes.length} scenes planned` : null, latestAction: latest('direct') },
      { id: 'motion_graphics', status: st('graphics'), counts: p.scenes.length ? `${readyScenes} of ${p.scenes.length} rendered · QA checked` : null, latestAction: latest('graphics') },
      { id: 'assembly_review', status: st('assemble') === 'done' ? st('review') : st('assemble'), counts: null, latestAction: latest('assemble') ?? latest('review') },
    ]
  }

  function planEvents(rec: Rec): Phase[] {
    const p = rec.project
    if (rec.planAt == null) return []
    const b = rec.planAt
    const topic = topicFromPrompt(p.prompt)
    const ev: Phase[] = [
      { at: b, stage: 'story', kind: 'status', text: 'Planning started. No render is queued until the plan exists.' },
      { at: b + 400, stage: 'story', kind: 'reasoning', text: p.workflow === 'idea' ? `Starting from the brief: “${topic}”. I’ll check what model knowledge covers and only use grounded search for recent facts.` : 'Reading your script first. Your words stay exactly as written; I’ll only organize them into chapters.' },
      { at: b + 1500, stage: 'assets', kind: 'action', text: p.assets.length ? `Analyzing ${p.assets.length} uploads with the clipper analysis (transcripts, faces, shots).` : 'No uploads yet. Gaps will be filled with code-rendered graphics.' },
      { at: b + 2600, stage: 'story', kind: 'reasoning', text: 'The story needs a clear setup, a turning point and a payoff. Five chapters keep the runtime on target.' },
      { at: b + 4200, stage: 'story', kind: 'action', text: 'Wrote the chapter plan and attached sources to factual claims.' },
      { at: b + 5200, stage: 'direct', kind: 'reasoning', text: 'Deciding which moments need real footage, photos, maps or charts. Numbers get word-synced charts; places get maps.' },
      { at: b + 7600, stage: 'direct', kind: 'reasoning', text: 'Where footage exists, the camera will enter a photo, play the clip, and return to the same world. Ordinary cuts where frames line up.' },
      { at: b + MOCK_TIMING.plan, stage: 'direct', kind: 'status', text: `Visual plan ready: ${p.scenes.length} scenes across ${p.story?.chapters.length ?? 0} chapters.` },
    ]
    if (p.settings.productionMode === 'checkpoint') ev.push({ at: b + MOCK_TIMING.plan + 1, stage: 'story', kind: 'status', text: 'Checkpoint: the story and visual plan are ready for your review.' })
    return ev
  }

  function prodEvents(rec: Rec): Phase[] {
    const p = rec.project
    if (rec.prodAt == null || rec.planAt == null) return []
    if (p.settings.productionMode === 'checkpoint' && !rec.approved) return []
    const start = Math.max(rec.prodAt, rec.planAt + MOCK_TIMING.plan)
    const ev: Phase[] = [{ at: start, stage: 'graphics', kind: 'status', text: 'Full production started.' }]
    p.scenes.forEach((s, i) => {
      if (i % 3 === 0) ev.push({ at: start + i * MOCK_TIMING.sceneMs + 100, stage: 'graphics', kind: 'reasoning', text: `${s.title}: ${s.reason}` })
      ev.push({ at: start + (i + 1) * MOCK_TIMING.sceneMs, stage: 'graphics', kind: 'action', text: `Rendered scene ${i + 1} (${s.treatment}); readability and motion checks passed.` })
    })
    const gEnd = start + p.scenes.length * MOCK_TIMING.sceneMs
    ev.push({ at: gEnd + 200, stage: 'assemble', kind: 'action', text: 'Assembling footage, graphics, narration and music on one master timeline.' })
    ev.push({ at: gEnd + 1500, stage: 'assemble', kind: 'reasoning', text: 'Ducking the score under narration and landing music hits on chapter changes.' })
    ev.push({ at: gEnd + MOCK_TIMING.assemble, stage: 'review', kind: 'status', text: 'Your documentary is ready for review.' })
    return ev
  }

  function eventsUntil(rec: Rec): MsActivityEvent[] {
    const t = now()
    const phases = [...planEvents(rec), ...prodEvents(rec)]
    const out: MsActivityEvent[] = phases
      .filter((e) => e.at <= t)
      .map((e, i) => ({ id: `${rec.project.id}_e${String(i).padStart(4, '0')}`, at: iso(e.at), stage: e.stage, kind: e.kind, text: e.text }))
    return [...out, ...rec.extraEvents.filter((e) => new Date(e.at).getTime() <= t)].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
  }

  function touch(rec: Rec) {
    rec.project.updatedAt = iso(now())
    save()
  }

  function pushEvent(rec: Rec, stage: MsStageId, kind: MsActivityEvent['kind'], text: string) {
    rec.extraEvents.push({ id: `${rec.project.id}_x${String(rec.extraEvents.length).padStart(4, '0')}`, at: iso(now()), stage, kind, text })
  }

  function ensurePlanBuilt(rec: Rec) {
    const p = rec.project
    if (p.story) return
    const script = rec.script ?? null
    const chapters = buildChapters({ prompt: p.prompt, workflow: p.workflow, script, seed: p.id })
    p.story = { chapters, approved: rec.approved, preservedUserScript: p.workflow !== 'idea' && Boolean(script) }
    p.scenes = buildScenes({ chapters, settings: p.settings, assets: p.assets, seed: p.id })
    p.missingVisuals = buildMissingVisuals(chapters, p.assets, p.id)
    p.styleRationale = `${p.settings.visualDirection === 'cinematic' ? 'Cinematic documentary' : 'Chosen direction'} as intent; palette, type and camera grammar derived from the story, so this video won’t look like the last one.`
    p.scenes.forEach((s) => {
      for (const aid of s.assetIds) {
        const a = p.assets.find((x) => x.id === aid)
        if (a) {
          a.sceneIds = [...new Set([...a.sceneIds, s.id])]
          a.chapterId = a.chapterId ?? s.chapterId
          a.intendedUse = a.intendedUse ?? (s.handoff ? 'Footage handoff insert' : 'Anchor image')
        }
      }
    })
  }

  // Example project is produced immediately.
  for (const rec of Object.values(store.recs)) if (rec.project.isExample) ensurePlanBuilt(rec)
  save()

  const client: MotionStudioClient = {
    mode: 'mock',
    async listProjects() {
      await wait()
      return Object.values(store.recs)
        .map((r) => materialize(r))
        .sort((a, b) => Number(a.isExample) - Number(b.isExample) || b.createdAt.localeCompare(a.createdAt))
        .map((p) => ({
          id: p.id,
          title: p.title,
          isExample: p.isExample,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          status: p.status,
          workflow: p.workflow,
          sceneCount: p.scenes.length,
          durationMs: p.durationMs || p.settings.lengthMin * 60_000,
          thumbnailUrl: null,
          posterKind: p.isExample ? 'chart' : (p.scenes[0]?.visualType ?? (p.workflow === 'footage' ? 'footage' : 'text')),
        }))
    },
    async createProject(input) {
      await wait()
      const existing = Object.values(store.recs).find((r) => r.createIdem === input.idempotencyKey)
      if (existing) return materialize(existing)
      if (input.mediaPolicy !== 'uploads_only') throw new MotionStudioHttpError(400, 'MEDIA_POLICY', 'Only uploaded media is supported in this version.')
      const t = now()
      const pid = id('ms')
      const project = baseProject({ pid, t, title: titleFromPrompt(input.prompt || input.script || '', input.workflow), prompt: input.prompt, workflow: input.workflow, assets: assetsFrom(input.uploads, t) })
      if (input.uploads.some((u) => u.kind === 'audio' && /(vo|voice|narrat)/i.test(u.label))) project.settings.voiceover = 'upload'
      const music = project.assets.find((a) => a.role === 'music')
      if (music) project.audio.music = { source: 'upload', label: `Your music: ${music.label}`, assetId: music.id, status: 'planned' }
      const lenMatch = /(\d{1,2})[- ]?min/i.exec(input.prompt)
      const len = lenMatch ? Number(lenMatch[1]) : null
      if (len === 3 || len === 5 || len === 10 || len === 15) project.settings.lengthMin = len
      if (/explainer/i.test(input.prompt)) project.settings.visualDirection = 'explainer'
      else if (/investigat/i.test(input.prompt)) project.settings.visualDirection = 'investigative'
      else if (/3d|technical/i.test(input.prompt)) project.settings.visualDirection = 'technical_3d'
      store.recs[pid] = { project, script: input.script ?? null, createIdem: input.idempotencyKey, planIdem: null, planAt: null, prodIdem: null, prodAt: null, approved: false, exportIdem: null, exportAt: null, regen: {}, extraEvents: [] }
      save()
      return materialize(store.recs[pid]!)
    },
    async getProject(pid) {
      await wait()
      return materialize(get(pid))
    },
    async updateProject(pid, patch) {
      await wait()
      const rec = get(pid)
      if (patch.title != null) rec.project.title = patch.title.trim().slice(0, 120) || rec.project.title
      if (patch.settings) {
        if (rec.planAt != null && patch.settings.lengthMin && patch.settings.lengthMin !== rec.project.settings.lengthMin) {
          throw new MotionStudioHttpError(409, 'PLAN_EXISTS', 'Length is locked once the production plan exists.')
        }
        rec.project.settings = { ...rec.project.settings, ...patch.settings, format: '16:9_1080p' }
        if (patch.settings.voiceover) rec.project.audio.voice.mode = patch.settings.voiceover
        rec.project.audio.voice.label = rec.project.settings.voiceover === 'ai' ? 'AI voice · documentary narrator' : 'Your narration (uploaded)'
        if (patch.settings.music) rec.project.audio.music.label = musicItem(rec.project.settings, rec.project.assets).label
      }
      touch(rec)
      return materialize(rec)
    },
    async createPlan(pid, key) {
      await wait()
      const rec = get(pid)
      if (rec.planIdem && rec.planIdem === key) return materialize(rec)
      if (rec.planAt != null) return materialize(rec)
      rec.planIdem = key
      rec.planAt = now()
      ensurePlanBuilt(rec)
      touch(rec)
      return materialize(rec)
    },
    async startProduction(pid, mode, key) {
      await wait()
      const rec = get(pid)
      if (rec.prodIdem) return materialize(rec) // duplicate start → same run (ST-RULE-003)
      if (rec.planAt == null) throw new MotionStudioHttpError(409, 'NO_PLAN', 'Create the production plan first.')
      rec.project.settings.productionMode = mode
      if (mode === 'auto') rec.approved = true
      rec.prodIdem = key
      rec.prodAt = now()
      touch(rec)
      return materialize(rec)
    },
    async approveStory(pid) {
      await wait()
      const rec = get(pid)
      rec.approved = true
      if (rec.project.story) rec.project.story.approved = true
      pushEvent(rec, 'story', 'status', 'Story approved.')
      touch(rec)
      return materialize(rec)
    },
    async requestStoryChanges(pid, note) {
      await wait()
      const rec = get(pid)
      if (!rec.project.story) throw new MotionStudioHttpError(409, 'NO_STORY', 'The story is not ready yet.')
      rec.project.story.changeRequest = note
      pushEvent(rec, 'story', 'reasoning', `Revising the story: “${note.slice(0, 140)}”. Only the affected chapters change.`)
      const ch = rec.project.story.chapters[0]
      if (ch && !rec.project.story.preservedUserScript) ch.summary = `${ch.summary} (revised per your note)`
      touch(rec)
      return materialize(rec)
    },
    async listActivity(pid, after) {
      await wait()
      const rec = get(pid)
      materialize(rec)
      const all = eventsUntil(rec)
      const idx = after ? all.findIndex((e) => e.id === after) : -1
      const events = idx >= 0 ? all.slice(idx + 1) : after ? all.filter((e) => e.id > after) : all
      return { events, cursor: all.at(-1)?.id ?? after ?? null }
    },
    async listAssets(pid) {
      await wait()
      return materialize(get(pid)).assets
    },
    async addAssets(pid, uploads) {
      await wait()
      const rec = get(pid)
      const t = now()
      const added = assetsFrom(uploads.map((u) => ({ ...u, durationMs: null })), t)
      // Added mid-production: cataloged right away (mock), no re-render until used.
      rec.project.assets.push(...added.map((a) => ({ ...a, analysis: { ...analysisFor(a), status: 'ready' as const } })))
      pushEvent(rec, 'assets', 'action', `Cataloged ${added.length} new upload${added.length === 1 ? '' : 's'}.`)
      touch(rec)
      return materialize(rec)
    },
    async replaceAsset(pid, assetId, withAssetId) {
      await wait()
      const rec = get(pid)
      const from = rec.project.assets.find((a) => a.id === assetId)
      const to = rec.project.assets.find((a) => a.id === withAssetId)
      if (!from || !to) throw new MotionStudioHttpError(404, 'NOT_FOUND', 'Asset not found.')
      if (from.kind !== to.kind && !(from.kind !== 'audio' && to.kind !== 'audio')) throw new MotionStudioHttpError(400, 'KIND_MISMATCH', 'Replace with the same kind of media.')
      const affected = rec.project.scenes.filter((s) => s.assetIds.includes(assetId))
      for (const s of affected) {
        s.assetIds = s.assetIds.map((x) => (x === assetId ? withAssetId : x))
        if (s.handoff?.assetId === assetId) s.handoff.assetId = withAssetId
        s.source = to.label
        s.version += 1
        rec.regen[s.id] = now()
      }
      to.sceneIds = [...new Set([...to.sceneIds, ...from.sceneIds])]
      to.intendedUse = from.intendedUse
      to.chapterId = from.chapterId
      from.sceneIds = []
      from.intendedUse = null
      pushEvent(rec, 'graphics', 'action', `Replaced ${from.label} with ${to.label}. Re-rendering ${affected.length} affected scene${affected.length === 1 ? '' : 's'} only.`)
      touch(rec)
      return materialize(rec)
    },
    async updateScene(pid, sceneId, patch) {
      await wait()
      const rec = get(pid)
      const s = rec.project.scenes.find((x) => x.id === sceneId)
      if (!s) throw new MotionStudioHttpError(404, 'NOT_FOUND', 'Scene not found.')
      if (patch.startMs != null || patch.endMs != null) {
        const start = patch.startMs ?? s.startMs
        const end = patch.endMs ?? s.endMs
        if (end - start < 1000) throw new MotionStudioHttpError(400, 'TIMING', 'A scene must be at least one second long.')
        s.startMs = start
        s.endMs = end
      }
      if (patch.style != null) s.style = patch.style
      if (patch.camera != null) s.camera = patch.camera
      if (patch.text != null) s.text = patch.text
      s.version += 1
      if (rec.prodAt != null) rec.regen[s.id] = now()
      pushEvent(rec, 'graphics', 'action', `Updated scene ${s.index + 1}; re-rendering that segment only.`)
      touch(rec)
      return materialize(rec)
    },
    async regenerateScene(pid, sceneId, instruction, key) {
      await wait()
      const rec = get(pid)
      const s = rec.project.scenes.find((x) => x.id === sceneId)
      if (!s) throw new MotionStudioHttpError(404, 'NOT_FOUND', 'Scene not found.')
      const regenKey = `${sceneId}:${key}`
      if (rec.regenKeys?.includes(regenKey)) return materialize(rec)
      rec.regenKeys = [...(rec.regenKeys ?? []), regenKey]
      s.version += 1
      rec.regen[s.id] = now()
      pushEvent(rec, 'graphics', 'reasoning', instruction ? `Rewriting “${s.graphicName}” for scene ${s.index + 1}: ${instruction.slice(0, 140)}` : `Regenerating “${s.graphicName}” for scene ${s.index + 1}. Other scenes are untouched.`)
      touch(rec)
      return materialize(rec)
    },
    async sendDirectorMessage(pid, message, sceneId) {
      await wait()
      const rec = get(pid)
      const text = message.trim()
      if (!text) throw new MotionStudioHttpError(400, 'EMPTY', 'Type what you want to change.')
      const t = now()
      const proposal: MsProposal = { id: id('pr'), request: text, sceneId: sceneId ?? null, createdAt: iso(t), items: proposalItems(text, sceneId ? rec.project.scenes.find((s) => s.id === sceneId) ?? null : null).map((x) => ({ id: id('pi'), text: x, status: 'pending' })) }
      rec.project.proposals.unshift(proposal)
      rec.project.director.push({ id: id('dm'), role: 'user', text, at: iso(t) })
      rec.project.director.push({ id: id('dm'), role: 'director', text: 'Here’s what I’d change. Nothing is applied until you accept.', at: iso(t + 1), proposalId: proposal.id })
      touch(rec)
      return materialize(rec)
    },
    async decideProposal(pid, proposalId, itemIds, decision) {
      await wait()
      const rec = get(pid)
      const pr = rec.project.proposals.find((x) => x.id === proposalId)
      if (!pr) throw new MotionStudioHttpError(404, 'NOT_FOUND', 'Proposal not found.')
      const ids = itemIds === 'all' ? pr.items.filter((i) => i.status === 'pending').map((i) => i.id) : itemIds
      let applied = 0
      for (const item of pr.items) {
        if (!ids.includes(item.id) || item.status !== 'pending') continue
        item.status = decision === 'accept' ? 'accepted' : 'rejected'
        if (decision === 'accept') applied++
      }
      if (applied) {
        const target = pr.sceneId ? rec.project.scenes.find((s) => s.id === pr.sceneId) : rec.project.scenes[0]
        if (target) {
          target.version += 1
          if (rec.prodAt != null) rec.regen[target.id] = now()
        }
        pushEvent(rec, 'graphics', 'action', `Applied ${applied} change${applied === 1 ? '' : 's'}${target ? ` to scene ${target.index + 1}` : ''}. Undo is available in the editor history.`)
      }
      touch(rec)
      return materialize(rec)
    },
    async retryStage(pid, stage) {
      await wait()
      const rec = get(pid)
      pushEvent(rec, stage as MsStageId, 'status', 'Retry requested by you. This step runs once; nothing retries automatically.')
      touch(rec)
      return materialize(rec)
    },
    async getAllowance(pid) {
      await wait()
      const p = get(pid).project
      return allowanceFor(p.settings, p.assets)
    },
    async startExport(pid, key) {
      await wait()
      const rec = get(pid)
      const p = materialize(rec)
      if (p.status !== 'review' && p.status !== 'exporting' && p.status !== 'complete') throw new MotionStudioHttpError(409, 'NOT_READY', 'Export is available once the documentary is ready for review.')
      if (rec.exportIdem === key || (rec.exportAt != null && p.export.status !== 'failed')) return p
      rec.exportIdem = key
      rec.exportAt = now()
      pushEvent(rec, 'review', 'action', 'Export started: MP4 · 16:9 · 1080p.')
      touch(rec)
      return materialize(rec)
    },
    async cancelProject(pid) {
      await wait()
      const rec = get(pid)
      const p = materialize(rec)
      if (p.status === 'review' || p.status === 'complete' || p.status === 'failed' || p.status === 'setup') return p
      rec.cancelledAt = now()
      pushEvent(rec, p.stages.find((x) => x.status === 'running')?.id ?? 'story', 'warning', 'Cancelled by you. Queued steps stopped; nothing retries automatically.')
      touch(rec)
      return materialize(rec)
    },
    async getExportDownload(pid) {
      await wait()
      const p = materialize(get(pid))
      if (p.export.status !== 'ready') throw new MotionStudioHttpError(409, 'NOT_READY', 'The export is still rendering.')
      throw new MotionStudioHttpError(501, 'MOCK', 'Downloads need the live backend. This is preview data.')
    },
    async openInEditor() {
      await wait()
      throw new MotionStudioHttpError(501, 'MOCK', 'The advanced editor opens once the live backend assembles a timeline. This is preview data.')
    },
    async uploadFile(file, onProgress) {
      for (const pct of [10, 35, 60, 85, 100]) {
        await new Promise((r) => setTimeout(r, opts.latencyMs ?? 60))
        onProgress(pct)
      }
      return { uploadId: `mock_${slug(file.name)}_${Math.random().toString(36).slice(2, 8)}` }
    },
  }
  return client
}

function analysisFor(a: MsAsset): Partial<MsAsset['analysis']> {
  const h = [...a.label].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7)
  switch (a.kind as MsAssetKind) {
    case 'video':
      return { summary: 'Interview footage · transcript with word timestamps', transcriptExcerpt: '“…and that’s when everything changed.”', faces: 1 + (h % 3), objects: ['person', 'microphone'], shots: 3 + (h % 9) }
    case 'photo':
      return { summary: 'Photo · subject and setting detected', faces: h % 3, objects: ['building', 'sign'].slice(0, 1 + (h % 2)), shots: null }
    case 'audio':
      return { summary: /(vo|voice|narrat)/i.test(a.label) ? 'Narration · words aligned' : 'Music · beats detected for cutting and ducking', transcriptExcerpt: null, faces: null, objects: [], shots: null }
    default:
      return { summary: 'Script · routed to Story', faces: null, objects: [], shots: null }
  }
}

function proposalItems(text: string, scene: MsScene | null): string[] {
  const lower = text.toLowerCase()
  const where = scene ? `scene ${scene.index + 1}` : 'the opening'
  const items: string[] = []
  if (/slow|pace|faster|dramatic|energy/.test(lower)) items.push(`Shorten camera travel in ${where} by 3 seconds.`, `Adjust the impact and music timing in ${where}.`)
  if (/chart|graph|number|data|read/.test(lower)) items.push('Increase chart label sizes and contrast.', 'Sync the key figure to the narrator’s word.')
  if (/music|sound|audio|loud/.test(lower)) items.push('Duck the score 3 dB further under narration.')
  if (/color|colour|look|style|cinematic/.test(lower)) items.push(`Push ${where} toward a deeper, higher-contrast grade within this video’s style.`)
  if (!items.length) items.push(`Revise ${where} to match: “${text.slice(0, 80)}”.`, 'Re-check readability and motion after the change.')
  return items.slice(0, 4)
}

function musicItem(settings: MsSettings, assets: MsAsset[]): MsAllowance['items'][number] {
  const m = settings.music ?? (assets.some((a) => a.role === 'music') ? 'upload' : 'generated')
  const label = m === 'upload' ? 'Your music (cut and ducked)' : m === 'elevenlabs' ? 'Premium generated music (optional)' : m === 'none' ? 'No music' : 'Score generated from the story beats'
  return { id: 'music', label, included: true, thirdParty: m === 'elevenlabs', credits: null }
}

function allowanceFor(settings: MsSettings, assets: MsAsset[]): MsAllowance {
  return {
    estimateCredits: null,
    minutes: settings.lengthMin,
    items: [
      { id: 'research', label: 'Story research and script', included: true, thirdParty: false, credits: null },
      { id: 'analysis', label: `Upload analysis (${assets.length} file${assets.length === 1 ? '' : 's'})`, included: true, thirdParty: false, credits: null },
      { id: 'graphics', label: 'Code-rendered motion graphics and revisions', included: true, thirdParty: false, credits: null },
      { id: 'voice', label: settings.voiceover === 'ai' ? 'AI narration (premium voice service)' : 'Your narration (aligned, no voice cost)', included: settings.voiceover !== 'ai', thirdParty: settings.voiceover === 'ai', credits: null },
      musicItem(settings, assets),
      { id: 'render', label: `Final render · ${settings.lengthMin} min · 1080p`, included: false, thirdParty: false, credits: null },
    ],
  }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'documentary'
}
