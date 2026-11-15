import 'server-only'
import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { createReadableSignedUrl, storageDriverName, uploadSourceKey } from '@/lib/storage'
import { defaultClipSettings } from '@/lib/clips/settings'
import { defaultEdits, type ClipEditsV2, type ClipMotionStudioExt } from '@/lib/clips/edits'
import { registerProjectMedia } from '@/lib/server/clips/project-media'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'
import {
  MS_ASPECTS, MS_AUTOMATION, MS_BETA_LENGTHS, MS_LENGTHS, MS_MUSIC, MS_STAGES, MS_VISUAL_DIRECTIONS, MS_VOICEOVERS,
  MS_WORKFLOWS, type MsSettings, type MsStage, type MsWorkflow,
} from '@/lib/motion-studio/types'

const db = () => getPrisma()
const stableId = (prefix: string, key: string) => prefix + createHash('sha256').update(key).digest('hex').slice(0, 28)
const SIGN_TTL_S = 3600

export function motionStudioEnabled(): boolean {
  const v = (process.env.MOTION_STUDIO_ENABLED ?? '1').trim().toLowerCase()
  return !['0', 'false', 'off', 'no'].includes(v)
}

function assertEnabled() {
  if (!motionStudioEnabled()) throw new MotionStudioError('DISABLED', 'Motion Studio is not enabled.', 404)
}

export function motionStudioConfig() {
  return {
    lengths: [...MS_LENGTHS], betaLengths: [...MS_BETA_LENGTHS], visualDirections: MS_VISUAL_DIRECTIONS,
    voiceovers: MS_VOICEOVERS, aspects: [...MS_ASPECTS], automation: [...MS_AUTOMATION], music: [...MS_MUSIC],
    mediaPolicy: 'uploads_only', stages: MS_STAGES,
    features: { narration: true, groundedResearch: true, generatedMusic: true, elevenLabsMusic: true, customSceneCode: true },
    creditEstimate: null,
  }
}

// ------------------------------------------------------------------ parsing
function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function pick<T extends readonly (string | number)[]>(v: unknown, allowed: T, dflt: T[number]): T[number] {
  return (allowed as readonly unknown[]).includes(v) ? (v as T[number]) : dflt
}

export function parseSettings(raw: unknown, prev?: Partial<MsSettings>): MsSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const base: MsSettings = {
    lengthMin: 3, visualDirection: 'auto', visualNotes: '', voiceover: 'ai_brian', narrationUploadId: null, aspect: '16:9',
    automation: 'checkpoint', music: 'generated', musicUploadId: null, mediaPolicy: 'uploads_only', ...(prev ?? {}),
  }
  const has = (k: string) => Object.prototype.hasOwnProperty.call(o, k)
  return {
    ...base,
    lengthMin: has('lengthMin') ? pick(Number(o.lengthMin), MS_LENGTHS, base.lengthMin) as MsSettings['lengthMin'] : base.lengthMin,
    visualDirection: has('visualDirection')
      ? pick(o.visualDirection, MS_VISUAL_DIRECTIONS.map(v => v.id) as unknown as readonly string[], base.visualDirection)
      : base.visualDirection,
    visualNotes: has('visualNotes') ? str(o.visualNotes, 2000) : base.visualNotes,
    voiceover: has('voiceover') ? pick(o.voiceover, ['ai_brian', 'upload', 'none'] as const, base.voiceover) : base.voiceover,
    narrationUploadId: has('narrationUploadId') ? (str(o.narrationUploadId, 64) || null) : base.narrationUploadId,
    aspect: has('aspect') ? pick(o.aspect, MS_ASPECTS, base.aspect) : base.aspect,
    automation: has('automation') ? pick(o.automation, MS_AUTOMATION, base.automation) : base.automation,
    music: has('music') ? pick(o.music, MS_MUSIC, base.music) : base.music,
    musicUploadId: has('musicUploadId') ? (str(o.musicUploadId, 64) || null) : base.musicUploadId,
    mediaPolicy: 'uploads_only',
    tone: has('tone') ? str(o.tone, 80) : base.tone,
  }
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(v ?? null)
}

type UploadRow = { id: string; key: string; mime: string; filename: string; durationMs: number | null; width: number | null; height: number | null; status: string }

async function loadUploads(workspaceId: string, ids: string[]): Promise<UploadRow[]> {
  if (!ids.length) return []
  const rows = await db().clipUpload.findMany({
    where: { id: { in: ids }, workspaceId },
    select: { id: true, key: true, mime: true, filename: true, durationMs: true, width: true, height: true, status: true },
  })
  if (rows.length !== new Set(ids).size) throw new MotionStudioError('INVALID', 'One or more uploads were not found.', 400)
  const pending = rows.find(r => r.status !== 'COMPLETE')
  if (pending) throw new MotionStudioError('INVALID', 'Finish uploading every file before starting.', 400)
  return rows.map(r => ({ ...r, durationMs: r.durationMs ?? null, width: r.width ?? null, height: r.height ?? null }))
}

function kindOf(mime: string): 'video' | 'image' | 'audio' | null {
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  return null
}

// ------------------------------------------------------------------ create
export async function createProject(workspaceId: string, userId: string, body: unknown, headerKey?: string | null) {
  assertEnabled()
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const workflow = pick(o.workflow, MS_WORKFLOWS, 'idea') as MsWorkflow
  const brief = str(o.brief, 20000)
  const script = str(o.script, 60000)
  const title = str(o.title, 120)
  const settings = parseSettings(o.settings)
  const uploadIds = Array.isArray(o.uploadIds) ? [...new Set(o.uploadIds.filter((x): x is string => typeof x === 'string'))].slice(0, 200) : []
  if (!brief && !script && !uploadIds.length) throw new MotionStudioError('INVALID', 'Describe the documentary, paste a script or add media.', 400)
  if (workflow === 'script' && !script && !brief && settings.voiceover !== 'upload')
    throw new MotionStudioError('INVALID', 'Paste or upload the script.', 400)
  if (workflow === 'footage' && !uploadIds.length) throw new MotionStudioError('INVALID', 'Add the footage to edit.', 400)
  const key = (headerKey || str(o.idempotencyKey, 120) || createId('msk')).slice(0, 120)
  const input = { workflow, brief, script, title, settings, uploadIds }
  const existing = await db().motionStudioProject.findUnique({ where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: key } } })
  if (existing) {
    const prevInput = (existing.settings as Record<string, unknown> | null)?.createInput
    if (canonical(prevInput) !== canonical(input))
      throw new MotionStudioError('CONFLICT', 'That idempotency key was already used for another project.', 409)
    console.info('[motion-studio:create] idempotent_replay', { projectId: existing.id })
    return { project: await getProject(workspaceId, existing.id), created: false }
  }
  const extraIds = [settings.narrationUploadId, settings.musicUploadId].filter((x): x is string => Boolean(x))
  const uploads = await loadUploads(workspaceId, [...new Set([...uploadIds, ...extraIds])])
  const byId = new Map(uploads.map(u => [u.id, u]))
  const id = createId('msp')
  const clipProjectId = createId('proj')
  const canvasUploadId = createId('upl')
  const clipId = stableId('clip_ms_', id)
  const workerSettings: Record<string, unknown> = {
    ...settings, script, createInput: input,
    voiceoverUploadKey: settings.narrationUploadId ? byId.get(settings.narrationUploadId)?.key ?? null : null,
    musicUploadKey: settings.musicUploadId ? byId.get(settings.musicUploadId)?.key ?? null : null,
  }
  const clipSettings = defaultClipSettings({
    aspectRatio: settings.aspect, rangeStartMs: 0, rangeEndMs: settings.lengthMin * 60_000,
    byo: true, fullVideo: true, blank: true, captions: { enabled: false, presetId: 'bold_pop', language: 'en' },
  })
  try {
    await db().$transaction(async tx => {
      await tx.clipUpload.create({ data: { id: canvasUploadId, workspaceId, key: uploadSourceKey(workspaceId, canvasUploadId, 'mp4'),
        filename: 'Motion Studio documentary.mp4', bytes: BigInt(0), mime: 'video/mp4', status: 'PENDING',
        storageDriver: storageDriverName(), kind: 'source' } })
      await tx.clipProject.create({ data: { id: clipProjectId, workspaceId, createdById: userId,
        title: (title || brief || 'Documentary').slice(0, 120), uploadId: canvasUploadId, sourceKind: 'motion_studio',
        settings: toPrismaJson(clipSettings), rangeStartMs: 0, rangeEndMs: settings.lengthMin * 60_000,
        status: 'QUEUED', stage: 'motion_studio', progress: 0 } })
      await tx.motionStudioProject.create({ data: { id, workspaceId, userId, director: 'documentary', clipProjectId, clipId,
        title: title || '', brief: brief || script.slice(0, 2000), workflow, settings: toPrismaJson(workerSettings), status: 'queued',
        stage: 'story', stages: toPrismaJson({ story: 'pending' }), idempotencyKey: key } })
      for (const uid of uploadIds) {
        const u = byId.get(uid)!
        const kind = kindOf(u.mime)
        if (!kind) continue
        await tx.studioAsset.create({ data: { id: createId('msa'), projectId: id, workspaceId, uploadId: uid, kind,
          filename: u.filename, status: 'pending', width: u.width, height: u.height, durationMs: u.durationMs } })
      }
      await tx.studioActivityEvent.create({ data: { projectId: id, stage: 'story', kind: 'stage', message: 'Project created; planning queued' } })
      await tx.clipJob.create({ data: { id: createId('job'), projectId: clipProjectId, type: 'DOC_PLAN', status: 'QUEUED', maxAttempts: 1,
        priority: 5, payload: toPrismaJson({ motionProjectId: id }) } })
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const again = await db().motionStudioProject.findUnique({ where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: key } } })
      if (again) return { project: await getProject(workspaceId, again.id), created: false }
    }
    throw err
  }
  for (const u of uploads) {
    if (!uploadIds.includes(u.id)) continue
    try {
      await registerProjectMedia(workspaceId, clipProjectId, { uploadId: u.id, label: u.filename, durationMs: u.durationMs ?? undefined,
        width: u.width ?? undefined, height: u.height ?? undefined })
    } catch (err) {
      console.warn('[motion-studio:create] media_register_failed', { projectId: id, type: err instanceof Error ? err.name : typeof err })
    }
  }
  console.info('[motion-studio:create] created', { projectId: id, clipProjectId, workflow, uploads: uploadIds.length })
  return { project: await getProject(workspaceId, id), created: true }
}

// ------------------------------------------------------------------ views
type ProjectRow = NonNullable<Awaited<ReturnType<ReturnType<typeof db>['motionStudioProject']['findFirst']>>>

async function required(workspaceId: string, id: string): Promise<ProjectRow> {
  assertEnabled()
  const row = await db().motionStudioProject.findFirst({ where: { id, workspaceId } })
  if (!row) throw new MotionStudioError('NOT_FOUND', 'Project not found.', 404)
  return row
}

async function sign(key: string | null | undefined): Promise<string | null> {
  if (!key) return null
  try {
    return await createReadableSignedUrl(key, SIGN_TTL_S)
  } catch {
    return null
  }
}

const J = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {}) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function stagesView(row: ProjectRow) {
  const st = J(row.stages)
  return MS_STAGES.map(s => ({ id: s.id, label: s.label, status: (st[s.id] as string) || (row.stage === s.id ? 'running' : 'pending') }))
}

/** A worker job that died (stale lock -> FAILED) must not leave the project "running" forever. */
async function reconcileFailedJob(row: ProjectRow): Promise<ProjectRow> {
  if (!['queued', 'running'].includes(row.status) || !row.clipProjectId) return row
  const failed = await db().clipJob.findFirst({
    where: { projectId: row.clipProjectId, status: 'FAILED', type: { in: ['DOC_PLAN', 'DOC_PRODUCE', 'MGD_RENDER_SEGMENT', 'DOC_ASSEMBLE'] },
      finishedAt: { gte: row.updatedAt } },
    select: { id: true, error: true, type: true },
  })
  const active = await db().clipJob.count({ where: { projectId: row.clipProjectId, status: { in: ['QUEUED', 'RUNNING'] } } })
  if (!failed || active) return row
  return db().motionStudioProject.update({ where: { id: row.id }, data: { status: 'failed', errorCode: 'job_failed',
    errorMessage: (failed.error || 'A production step stopped unexpectedly.').slice(0, 500), errorStage: row.stage } })
}

export async function getProject(workspaceId: string, id: string) {
  let row = await required(workspaceId, id)
  row = await reconcileFailedJob(row)
  const [scenes, assets] = await Promise.all([
    db().motionStudioScene.findMany({ where: { projectId: id }, orderBy: { index: 'asc' } }),
    db().studioAsset.findMany({ where: { projectId: id }, orderBy: { createdAt: 'asc' } }),
  ])
  const story = row.story ? J(row.story) : null
  const plan = row.plan ? J(row.plan) : null
  const narration = row.narration ? J(row.narration) : null
  const exportInfo = row.exportInfo ? J(row.exportInfo) : null
  const settings = J(row.settings)
  const sceneViews = await Promise.all(scenes.map(async s => {
    const p = J(s.plan)
    const qa = s.qa ? J(s.qa) : null
    return {
      id: s.id, index: s.index, kind: s.kind, lineIds: (p.lineIds as string[]) ?? [], visualType: s.visualType,
      reason: p.reason ?? '', description: p.description ?? '', blocks: p.blocks ?? [],
      assetIds: p.handoff?.assetId ? [p.handoff.assetId] : [], handoff: p.handoff ?? null, handoffRecord: s.handoff ?? null,
      status: s.status, startMs: s.startMs, endMs: s.endMs, model: s.model, fixRounds: s.fixRounds, usedFallback: s.usedFallback,
      qa: qa ? { passed: qa.verdict ? qa.verdict === 'pass' : Boolean(qa.seamPass), checks: qa.checks ?? [], seamScores: qa.seamScores ?? null } : null,
      previewUrl: await sign(s.renderKey), stillUrl: await sign(s.stillKey), error: s.error,
    }
  }))
  const assetViews = assets.map(a => {
    const an = a.analysis ? J(a.analysis) : null
    return {
      id: a.id, uploadId: a.uploadId, kind: a.kind, title: a.filename, durationMs: a.durationMs, width: a.width, height: a.height,
      status: a.status,
      analysis: an ? {
        description: an.description ?? an.summary ?? undefined, transcriptWords: Array.isArray(an.words) ? an.words.length : undefined,
        moments: Array.isArray(an.moments) ? an.moments.map((m: Record<string, unknown>) => ({ startS: m.start_s, endS: m.end_s, label: m.what_happened ?? m.title ?? '' })) : undefined,
        onScreenText: an.onScreenText, people: Array.isArray(an.people) ? an.people.map((p: string) => ({ label: p })) : undefined,
        faces: an.faces,
      } : undefined,
    }
  })
  const compactEditorUrl = row.clipProjectId && row.clipId && row.status === 'review' && exportInfo
    ? `/app/video-editor/${row.clipProjectId}/edit/${row.clipId}?mode=compact` : null
  return {
    id: row.id, title: row.title || (story?.title as string) || 'Untitled documentary', brief: row.brief, workflow: row.workflow,
    status: row.status, stage: row.stage as MsStage, stages: stagesView(row),
    settings: Object.fromEntries(Object.entries(settings).filter(([k]) => !['createInput', 'voiceoverUploadKey', 'musicUploadKey', 'script'].includes(k))),
    story: story ? {
      title: story.title, logline: story.logline ?? '', tone: story.tone,
      chapters: (story.chapters ?? []).map((c: Record<string, unknown>) => ({ id: String(c.n), title: c.title,
        lineIds: (story.lines ?? []).filter((l: Record<string, unknown>) => l.chapter === c.n).map((l: Record<string, unknown>) => l.id) })),
      lines: (story.lines ?? []).map((l: Record<string, unknown>) => ({ id: l.id, text: l.text, spoken: l.spoken, hero: l.hero, typed: l.typed,
        chapterId: String(l.chapter), sources: l.sources ?? [] })),
      sources: story.sources ?? [], research: story.researchDecisions ?? [], lint: story.lint ?? [], data: story.data ?? [],
      userWordsPreserved: Boolean(story.verbatim), estimatedDurationS: story.estimatedDurationS ?? null,
    } : null,
    plan: plan ? { world: plan.world, styleSpec: plan.style, musicSource: plan.musicSource, musicAnchors: plan.musicAnchors ?? null,
      source: plan.source, scenes: (plan.scenes ?? []).map((s: Record<string, unknown>) => ({ index: s.index, kind: s.kind, lineIds: s.lineIds,
        visualType: s.visualType, description: s.description, reason: s.reason, emphasis: s.emphasis ?? [], handoff: s.handoff ?? null })) } : null,
    scenes: sceneViews,
    assets: assetViews,
    narration: narration ? { voiceName: narration.voice?.name, durationMs: Math.round(((narration.chapters ?? []) as { durationS: number }[])
      .reduce((a, c) => a + (c.durationS || 0), 0) * 1000), mock: Boolean(narration.mock) } : null,
    music: row.music ? { source: J(row.music).source, params: J(row.music).params ?? null } : null,
    qa: row.qa ?? null,
    editor: { clipProjectId: row.clipProjectId, clipId: row.clipId, compactEditorUrl,
      fullEditorUrl: compactEditorUrl ? compactEditorUrl.replace('?mode=compact', '') : null },
    export: exportInfo ? { status: 'done', version: exportInfo.version, videoUrl: await sign(exportInfo.masterKey),
      smallVideoUrl: await sign(exportInfo.smallKey), creditsFileUrl: await sign(exportInfo.creditsKey),
      durationMs: exportInfo.durationMs, width: exportInfo.width, height: exportInfo.height } : null,
    error: row.errorCode ? { code: row.errorCode, message: row.errorMessage ?? '', stage: row.errorStage ?? row.stage, retryable: row.status === 'failed' } : null,
    timelineVersion: row.timelineVersion,
    creditEstimate: null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listProjects(workspaceId: string, q: { limit?: string | null; cursor?: string | null }) {
  assertEnabled()
  const limit = Math.max(1, Math.min(50, Number(q.limit) || 20))
  const rows = await db().motionStudioProject.findMany({
    where: { workspaceId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  })
  const page = rows.slice(0, limit)
  return {
    projects: await Promise.all(page.map(async r => {
      const s = await db().motionStudioScene.findFirst({ where: { projectId: r.id, stillKey: { not: null } }, orderBy: { index: 'asc' }, select: { stillKey: true } })
      return { id: r.id, title: r.title || J(r.story).title || 'Untitled documentary', status: r.status, stage: r.stage, workflow: r.workflow,
        createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), thumbnailUrl: await sign(s?.stillKey),
        durationMs: (J(r.exportInfo).durationMs as number | undefined) ?? null }
    })),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  }
}

// ------------------------------------------------------------------ actions
async function enqueue(row: ProjectRow, type: string, payload: Record<string, unknown>, priority = 5) {
  if (!row.clipProjectId) throw new MotionStudioError('INTERNAL', 'Project canvas is missing.', 500)
  const active = await db().clipJob.findFirst({ where: { projectId: row.clipProjectId, type, status: { in: ['QUEUED', 'RUNNING'] } }, select: { id: true } })
  if (active) return active.id      // a duplicate click never creates a second run
  const id = createId('job')
  await db().clipJob.create({ data: { id, projectId: row.clipProjectId, type, status: 'QUEUED', maxAttempts: 1, priority,
    payload: toPrismaJson({ motionProjectId: row.id, ...payload }) } })
  return id
}

async function event(projectId: string, stage: string, kind: string, message: string) {
  await db().studioActivityEvent.create({ data: { projectId, stage, kind, message } })
}

export async function patchProject(workspaceId: string, id: string, body: unknown) {
  const row = await required(workspaceId, id)
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const data: Prisma.MotionStudioProjectUpdateInput = {}
  if (typeof o.title === 'string') data.title = str(o.title, 120)
  if (o.settings) {
    const cur = J(row.settings)
    data.settings = toPrismaJson({ ...cur, ...parseSettings(o.settings, cur as Partial<MsSettings>) })
  }
  if (o.story && typeof o.story === 'object') {
    if (row.narration) throw new MotionStudioError('CONFLICT', 'The narration is already recorded; request changes instead.', 409)
    const story = J(row.story)
    const edits = Array.isArray((o.story as Record<string, unknown>).lines) ? (o.story as { lines: Record<string, unknown>[] }).lines : []
    const byId = new Map(edits.map(l => [String(l.id), l]))
    story.lines = (story.lines ?? []).map((l: Record<string, unknown>) => {
      const e = byId.get(String(l.id))
      if (!e) return l
      const text = str(e.text, 2000) || (l.text as string)
      return { ...l, text, spoken: str(e.spoken, 4000) || (text === l.text ? l.spoken : text), hero: e.hero !== undefined ? str(e.hero, 40) : l.hero }
    })
    data.story = toPrismaJson(story)
  }
  await db().motionStudioProject.update({ where: { id }, data })
  return getProject(workspaceId, id)
}

export async function approveProject(workspaceId: string, id: string) {
  const row = await required(workspaceId, id)
  if (row.status !== 'awaiting_approval') throw new MotionStudioError('CONFLICT', 'Nothing is waiting for approval.', 409)
  const stages = { ...J(row.stages), direct: 'done', assets: 'running' }
  await db().motionStudioProject.update({ where: { id }, data: { status: 'running', stage: 'assets', stages: toPrismaJson(stages) } })
  await event(id, 'direct', 'decision', 'Story and plan approved')
  await enqueue(row, 'DOC_PRODUCE', {}, 5)
  return getProject(workspaceId, id)
}

export async function requestChanges(workspaceId: string, id: string, body: unknown) {
  const row = await required(workspaceId, id)
  if (!['awaiting_approval', 'review'].includes(row.status)) throw new MotionStudioError('CONFLICT', 'Changes can be requested at the checkpoint or in review.', 409)
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const note = str(o.note, 4000)
  if (!note) throw new MotionStudioError('INVALID', 'Describe the change.', 400)
  const settings = { ...J(row.settings), changeNote: note }
  await db().motionStudioProject.update({ where: { id }, data: { status: 'running', stage: 'story', settings: toPrismaJson(settings),
    narration: Prisma.DbNull } })
  await event(id, 'story', 'decision', `Changes requested: ${note.slice(0, 200)}`)
  await enqueue(row, 'DOC_PLAN', { changeNote: note }, 5)
  return getProject(workspaceId, id)
}

export async function retryProject(workspaceId: string, id: string) {
  const row = await required(workspaceId, id)
  if (row.status !== 'failed') throw new MotionStudioError('STAGE_NOT_RETRYABLE', 'Only a failed step can be retried.', 409)
  const stage = (row.errorStage || row.stage) as string
  const type = !row.plan ? 'DOC_PLAN' : stage === 'assemble' ? 'DOC_ASSEMBLE' : 'DOC_PRODUCE'
  await db().motionStudioProject.update({ where: { id }, data: { status: 'running', errorCode: null, errorMessage: null, errorStage: null } })
  await event(id, stage, 'decision', 'Retry requested by the user')
  await enqueue(row, type, type === 'DOC_PLAN' ? { autoContinue: false } : {}, 5)
  return getProject(workspaceId, id)
}

export async function cancelProject(workspaceId: string, id: string) {
  const row = await required(workspaceId, id)
  if (['cancelled', 'review'].includes(row.status)) return getProject(workspaceId, id)
  await db().motionStudioProject.update({ where: { id }, data: { status: 'cancelled' } })
  if (row.clipProjectId) {
    await db().clipJob.updateMany({ where: { projectId: row.clipProjectId, status: 'QUEUED',
      type: { in: ['DOC_PLAN', 'DOC_PRODUCE', 'MGD_RENDER_SEGMENT', 'DOC_ASSEMBLE'] } }, data: { status: 'FAILED', error: 'cancelled' } })
  }
  await event(id, row.stage, 'stage', 'Cancelled by the user')
  return getProject(workspaceId, id)
}

export async function addAssets(workspaceId: string, id: string, body: unknown) {
  const row = await required(workspaceId, id)
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const ids = Array.isArray(o.uploadIds) ? [...new Set(o.uploadIds.filter((x): x is string => typeof x === 'string'))].slice(0, 100) : []
  const uploads = await loadUploads(workspaceId, ids)
  for (const u of uploads) {
    const kind = kindOf(u.mime)
    if (!kind) continue
    await db().studioAsset.upsert({ where: { projectId_uploadId: { projectId: id, uploadId: u.id } }, update: {},
      create: { id: createId('msa'), projectId: id, workspaceId, uploadId: u.id, kind, filename: u.filename, status: 'pending',
        width: u.width, height: u.height, durationMs: u.durationMs } })
    if (row.clipProjectId) {
      try { await registerProjectMedia(workspaceId, row.clipProjectId, { uploadId: u.id, label: u.filename }) } catch { /* best effort */ }
    }
  }
  await event(id, 'assets', 'stage', `${uploads.length} file(s) added`)
  return (await getProject(workspaceId, id)).assets
}

export async function regenerateScene(workspaceId: string, id: string, sceneId: string, body: unknown) {
  const row = await required(workspaceId, id)
  if (!['review', 'failed'].includes(row.status)) throw new MotionStudioError('CONFLICT', 'Scenes can be regenerated after the first cut is ready.', 409)
  const scene = await db().motionStudioScene.findFirst({ where: { id: sceneId, projectId: id } })
  if (!scene) throw new MotionStudioError('NOT_FOUND', 'Scene not found.', 404)
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const instruction = str(o.instruction, 2000)
  const plan = J(scene.plan)
  if (instruction) plan.description = `${plan.description ?? ''}\nDirector note: ${instruction}`.trim()
  await db().motionStudioScene.update({ where: { id: sceneId }, data: { status: 'queued', plan: toPrismaJson(plan) } })
  await db().motionStudioProject.update({ where: { id }, data: { status: 'running', stage: 'graphics' } })
  await event(id, 'graphics', 'decision', `Regenerate scene ${scene.index + 1}${instruction ? `: ${instruction.slice(0, 120)}` : ''}`)
  await enqueue(row, 'MGD_RENDER_SEGMENT', { sceneId, regenerate: true, force: true }, 6)
  return getProject(workspaceId, id)
}

export async function exportProject(workspaceId: string, id: string) {
  const row = await required(workspaceId, id)
  if (!['review', 'failed'].includes(row.status) || !row.plan) throw new MotionStudioError('CONFLICT', 'The first cut is not ready yet.', 409)
  await db().motionStudioProject.update({ where: { id }, data: { status: 'running', stage: 'assemble' } })
  await enqueue(row, 'DOC_ASSEMBLE', {}, 5)
  return getProject(workspaceId, id)
}

export async function listActivity(workspaceId: string, id: string, q: { after?: string | null; limit?: string | null }) {
  await required(workspaceId, id)
  const after = Number(q.after) || 0
  const limit = Math.max(1, Math.min(200, Number(q.limit) || 100))
  const rows = await db().studioActivityEvent.findMany({ where: { projectId: id, id: { gt: after } }, orderBy: { id: 'asc' }, take: limit })
  const agentOf = (kind: string, stage: string) =>
    kind.startsWith('research') ? 'researcher' : kind.startsWith('plan') ? 'director' : kind.startsWith('tts') || kind.startsWith('narration') ? 'narrator'
      : kind.startsWith('music') ? 'composer' : kind === 'mix' || stage === 'assemble' ? 'assembler' : stage === 'graphics' ? 'motion_designer'
        : stage === 'story' ? 'story' : 'system'
  return {
    events: rows.map(r => ({ id: String(r.id), at: r.createdAt.toISOString(), stage: r.stage, agent: agentOf(r.kind, r.stage), kind: r.kind,
      message: r.message, data: r.data ?? undefined })),
    lastId: rows.length ? String(rows[rows.length - 1].id) : (q.after ?? null),
  }
}

/** Compact Editor clip for the assembled program: canvas = master mix; Motion Studio tracks ride in edits.motionStudio. */
export async function ensureEditorClip(workspaceId: string, id: string): Promise<{ clipProjectId: string; clipId: string; edits: ClipEditsV2 }> {
  const row = await required(workspaceId, id)
  const ex = row.exportInfo ? J(row.exportInfo) : null
  if (!ex || !row.clipProjectId || !row.clipId) throw new MotionStudioError('CONFLICT', 'The timeline is ready after the first cut.', 409)
  const durationMs = Number(ex.durationMs) || 1000
  const patch = J(ex.editsPatch)
  const existing = await db().clip.findUnique({ where: { id: row.clipId }, select: { edits: true, aiMeta: true } })
  const meta = J(existing?.aiMeta)
  if (existing && meta.motionStudioTimelineVersion === row.timelineVersion) {
    return { clipProjectId: row.clipProjectId, clipId: row.clipId, edits: existing.edits as unknown as ClipEditsV2 }
  }
  const base = existing
    ? (existing.edits as unknown as ClipEditsV2)
    : defaultEdits({ clipStartMs: 0, clipEndMs: durationMs, trimMinMs: 0, trimMaxMs: durationMs })
  const settings = J(row.settings)
  const edits: ClipEditsV2 = {
    ...base,
    trim: { in: 0, out: durationMs },
    aspectRatio: (settings.aspect as ClipEditsV2['aspectRatio']) ?? '16:9',
    layout: { ...(base.layout ?? { shotOverrides: [] }), mode: 'full_frame', shotOverrides: base.layout?.shotOverrides ?? [] },
    markers: (patch.markers as ClipEditsV2['markers']) ?? base.markers,
    motionStudio: patch.motionStudio as ClipMotionStudioExt | undefined,
  }
  await db().clip.upsert({
    where: { id: row.clipId },
    create: { id: row.clipId, workspaceId, projectId: row.clipProjectId, title: (row.title || 'Documentary').slice(0, 120),
      reason: 'motion_studio', startMs: 0, endMs: durationMs, storageDriver: storageDriverName(), edits: toPrismaJson(edits),
      aiMeta: toPrismaJson({ motionStudioProjectId: id, motionStudioTimelineVersion: row.timelineVersion }) },
    update: { endMs: durationMs, edits: toPrismaJson(edits),
      aiMeta: toPrismaJson({ ...meta, motionStudioProjectId: id, motionStudioTimelineVersion: row.timelineVersion }) },
  })
  console.info('[motion-studio:editor] clip_ready', { projectId: id, clipId: row.clipId, version: row.timelineVersion })
  return { clipProjectId: row.clipProjectId, clipId: row.clipId, edits }
}

export async function getTimeline(workspaceId: string, id: string) {
  const r = await ensureEditorClip(workspaceId, id)
  return { ...r, compactEditorUrl: `/app/video-editor/${r.clipProjectId}/edit/${r.clipId}?mode=compact` }
}
