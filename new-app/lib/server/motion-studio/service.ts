import 'server-only'
import { createHash } from 'node:crypto'
import * as PrismaPkg from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { createReadableSignedUrl, storageDriverName, uploadSourceKey } from '@/lib/storage'
import { defaultClipSettings } from '@/lib/clips/settings'
import type { ClipEditsV2, ClipMotionStudioExt } from '@/lib/clips/edits'
import type { Marker } from '@/lib/clips/editor/markers'
import { buildMotionStudioEditorEdits, MS_MUSIC_ID_PREFIX, type MsEditorStems } from '@/lib/motion-studio/editor-timeline'
import { registerProjectMedia } from '@/lib/server/clips/project-media'
import { importAgentTimeline } from '@/lib/server/motion-studio/agent-import'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'
import type {
  MsActivityEvent, MsActivityStep, MsAllowance, MsAsset, MsAssetKind, MsChapter, MsEditorHandoff, MsProject, MsProjectStatus,
  MsProjectSummary, MsProposal, MsScene, MsSceneStatus, MsSelectionKind, MsSettings, MsStage, MsStageId, MsStageStatus, MsVisualType,
  MsWorkflow, MsMusicChoice, MsProposalItem, MsDirectorMessage,
} from '@/lib/motion-studio/types'
import {
  applyOps, buildBlueprint, effectOf, noCurrency, scenesPhrase, validateItems, type DirectorItem, type DirectorOp,
} from '@/lib/motion-studio/director-ops'
import { askDirector } from '@/lib/server/motion-studio/director-llm'
import { sanitizeCreativeBrief } from '@/lib/motion-studio/creative-options'
import { loadBrandKit } from '@/lib/server/motion-studio/brand-kits'

/**
 * Motion Studio service — matches the frontend client (lib/motion-studio/client.ts, PR #1260) exactly.
 * Contract: docs/contracts/motion-studio-v1.md. No currency anywhere; credits are null until D2.
 */

const db = () => getPrisma()
/** Interactive-transaction client. Typed structurally so this file also type-checks where `prisma generate` has not run (CI). */
type Tx = Omit<ReturnType<typeof db>, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>
/** Prisma.DbNull without a type-level dependency on the generated `Prisma` namespace. */
const DB_NULL = (PrismaPkg as unknown as { Prisma: { DbNull: unknown } }).Prisma.DbNull as never
const stableId = (prefix: string, key: string) => prefix + createHash('sha256').update(key).digest('hex').slice(0, 28)
const SIGN_TTL_S = 3600
const MS_JOB_TYPES = ['DOC_PLAN', 'DOC_PRODUCE', 'MGD_RENDER_SEGMENT', 'DOC_ASSEMBLE']
const STAGE_ORDER: MsStageId[] = ['story', 'assets', 'direct', 'graphics', 'assemble', 'review']
const LENGTHS = [1, 3, 5, 10, 15] as const
// rangeEndMs is stored as a 32-bit millisecond value in the clips project.
const MAX_LENGTH_MIN = Math.floor(2_147_483_647 / 60_000)
const validMinutes = (v: unknown): v is number => Number.isSafeInteger(v) && typeof v === 'number' && v >= 1 && v <= MAX_LENGTH_MIN
const DIRECTIONS = ['cinematic', 'explainer', 'investigative', 'technical_3d'] as const
const DEFAULT_SETTINGS: MsSettings = { lengthMin: 3, visualDirection: 'cinematic', voiceover: 'ai', format: '16:9_480p', renderSize: '480p', finalRenderSize: '480p', productionMode: 'checkpoint', music: 'generated', webResearch: false }
const MUSIC_CHOICES: readonly MsMusicChoice[] = ['generated', 'upload', 'elevenlabs', 'none']
const ENTER_MS = 1400
const EXIT_MS = 1200

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const J = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function titleFromCreate(o: Json, prompt: string, script: string): string {
  const explicit = str(o.title, 120)
  if (explicit) return explicit
  const src = prompt || script
  const line = (src.split(/\r?\n/).find((l) => l.trim()) || src).trim()
  const sentence = (line.split(/(?<=[.?!])\s+/)[0] || line).replace(/\s+/g, ' ').trim()
  return sentence.slice(0, 80) || 'Documentary'
}

export function motionStudioEnabled(): boolean {
  const v = (process.env.MOTION_STUDIO_ENABLED ?? '1').trim().toLowerCase()
  return !['0', 'false', 'off', 'no'].includes(v)
}

function assertEnabled() {
  if (!motionStudioEnabled()) throw new MotionStudioError('DISABLED', 'Motion Studio is not enabled.', 404)
}

export function motionStudioConfig() {
  return {
    lengths: [...LENGTHS], lengthInput: { min: 1, max: MAX_LENGTH_MIN, step: 1 }, betaLengths: [10, 15], visualDirections: [...DIRECTIONS], voiceovers: ['ai', 'upload'],
    productionModes: ['checkpoint', 'auto'], formats: ['16:9_480p', '16:9_720p', '16:9_1080p', '16:9_2160p', '9:16_480p', '9:16_720p', '9:16_1080p', '9:16_2160p', '1:1_480p', '1:1_720p', '1:1_1080p', '1:1_2160p'], mediaPolicy: 'uploads_only',
    music: ['generated', 'upload', 'elevenlabs', 'none'],
    features: { narration: true, groundedResearch: true, generatedMusic: true, elevenLabsMusic: true, customSceneCode: true, directorChat: 'blueprint' },
  }
}

// ------------------------------------------------------------------ settings
function parseSettings(raw: unknown, prev: MsSettings): MsSettings {
  const o = J(raw)
  const out = { ...prev }
  if (o.durationSeconds !== undefined && [30,60,120,180,300].includes(Number(o.durationSeconds))) out.durationSeconds = Number(o.durationSeconds)
  if (o.lengthMin !== undefined) {
    const minutes = Number(o.lengthMin)
    if (!validMinutes(minutes)) throw new MotionStudioError('INVALID', 'Length must be a positive whole number of minutes.', 400)
    out.lengthMin = minutes
  }
  if ((DIRECTIONS as readonly unknown[]).includes(o.visualDirection)) out.visualDirection = o.visualDirection
  if (o.voiceover === 'ai' || o.voiceover === 'upload') out.voiceover = o.voiceover
  if (o.productionMode === 'checkpoint' || o.productionMode === 'auto') out.productionMode = o.productionMode
  if (MUSIC_CHOICES.includes(o.music)) out.music = o.music
  out.music = out.music ?? 'generated'          // always explicit in the API (incl. 'none')
  if (typeof o.webResearch === 'boolean') out.webResearch = o.webResearch
  out.webResearch = out.webResearch === true
  if (typeof o.preflightOnly === 'boolean') out.preflightOnly = o.preflightOnly
  if (o.creative) out.creative = sanitizeCreativeBrief(o.creative)
  const FORMAT_RE = /^(16:9|9:16|1:1)_(480p|720p|1080p|2160p)$/
  if (typeof o.format === 'string' && FORMAT_RE.test(o.format)) out.format = o.format as MsSettings['format']
  const rs = typeof o.renderSize === 'string' ? o.renderSize.trim().toLowerCase()
    : (typeof o.resolution === 'string' ? o.resolution.trim().toLowerCase() : '')
  const validSize = (v: string) => ['480p', '720p', '1080p', '2160p', '4k'].includes(v) || /^\d{2,4}x\d{2,4}$/.test(v)
  if (validSize(rs)) out.renderSize = rs
  // Honest default: worker renders 480p when renderSize is omitted. Do not infer 1080p from a leftover format label.
  if (!out.renderSize) {
    const fromFmt = typeof out.format === 'string' && FORMAT_RE.test(out.format) ? out.format.split('_')[1] : ''
    out.renderSize = (fromFmt && fromFmt !== '1080p') ? fromFmt : '480p'
  }
  const sizeKey = out.renderSize === '4k' ? '2160p' : (['480p', '720p', '1080p', '2160p'].includes(out.renderSize) ? out.renderSize : '480p')
  const aspect = (typeof out.format === 'string' && out.format.includes('_')) ? out.format.split('_')[0] : '16:9'
  out.format = `${aspect}_${sizeKey}` as MsSettings['format']
  const fr = typeof o.finalRenderSize === 'string' ? o.finalRenderSize.trim().toLowerCase()
    : (typeof o.deliverySize === 'string' ? o.deliverySize.trim().toLowerCase() : '')
  if (validSize(fr)) out.finalRenderSize = fr
  if (!out.finalRenderSize) out.finalRenderSize = out.renderSize
  return out
}

function feSettings(s: Json): MsSettings {
  return parseSettings(s, DEFAULT_SETTINGS)
}

// ------------------------------------------------------------------ idempotency
/** Atomically records `${action}:${key}` on the project (row lock). Returns false when the key was already used. */
async function claimKey(projectId: string, action: string, key: string | null | undefined): Promise<boolean> {
  if (!key) return true
  const tag = `${action}:${key.slice(0, 120)}`
  return db().$transaction(async (tx: Tx) => {
    const rows = await tx.$queryRaw<{ settings: unknown }[]>`SELECT settings FROM "MotionStudioProject" WHERE id = ${projectId} FOR UPDATE`
    const s = J(rows[0]?.settings)
    const used: string[] = Array.isArray(s.idem) ? s.idem : []
    if (used.includes(tag)) return false
    await tx.motionStudioProject.update({ where: { id: projectId }, data: { settings: toPrismaJson({ ...s, idem: [...used, tag].slice(-100) }) } })
    return true
  })
}

/** Settings update under the row lock (shared protocol with the worker's finish_plan). */
async function updateSettingsLocked(projectId: string, fn: (s: Json) => Json): Promise<Json> {
  return db().$transaction(async (tx: Tx) => {
    const rows = await tx.$queryRaw<{ settings: unknown }[]>`SELECT settings FROM "MotionStudioProject" WHERE id = ${projectId} FOR UPDATE`
    const next = fn({ ...J(rows[0]?.settings) })
    await tx.motionStudioProject.update({ where: { id: projectId }, data: { settings: toPrismaJson(next) } })
    return next
  })
}

const shouldProduce = (s: Json) => Boolean(s.runRequested) && ((s.productionMode ?? 'checkpoint') === 'auto' || Boolean(s.approved))

// ------------------------------------------------------------------ uploads
type UploadRow = { id: string; key: string; mime: string; filename: string; durationMs: number | null; width: number | null; height: number | null }
type UploadIn = { uploadId: string; kind?: MsAssetKind; label?: string }

function parseUploads(v: unknown): UploadIn[] {
  if (!Array.isArray(v)) return []
  const out: UploadIn[] = []
  const seen = new Set<string>()
  for (const x of v.slice(0, 200)) {
    const u = typeof x === 'string' ? { uploadId: x } : J(x)
    const uploadId = str(u.uploadId, 64)
    if (!uploadId || seen.has(uploadId)) continue
    seen.add(uploadId)
    out.push({ uploadId, kind: ['photo', 'video', 'audio', 'script'].includes(u.kind) ? u.kind : undefined, label: str(u.label, 200) || undefined })
  }
  return out
}

async function loadUploads(workspaceId: string, ids: string[]): Promise<Map<string, UploadRow>> {
  if (!ids.length) return new Map()
  const rows = await db().clipUpload.findMany({
    where: { id: { in: ids }, workspaceId },
    select: { id: true, key: true, mime: true, filename: true, durationMs: true, width: true, height: true, status: true },
  })
  if (rows.length !== ids.length) throw new MotionStudioError('INVALID', 'One or more uploads were not found.', 400)
  type UpRow = (typeof rows)[number]
  if (rows.some((r: UpRow) => r.status !== 'COMPLETE')) throw new MotionStudioError('INVALID', 'Finish uploading every file before continuing.', 400)
  return new Map(rows.map((r: UpRow) => [r.id, { ...r, durationMs: r.durationMs ?? null, width: r.width ?? null, height: r.height ?? null }]))
}

function assetKind(mime: string, filename: string, hint?: MsAssetKind): 'video' | 'image' | 'audio' | 'script' {
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (hint === 'video') return 'video'
  if (hint === 'photo') return 'image'
  if (hint === 'audio') return 'audio'
  return /\.(txt|md|docx?|pdf)$/i.test(filename) ? 'script' : 'script'
}

const isNarrationLabel = (label: string) => /(^|[^a-z])(vo|voice|voiceover|narrat)/i.test(label)

/** Insert StudioAsset rows (+ canvas media registration) and return audio role picks. */
async function attachUploads(workspaceId: string, projectId: string, clipProjectId: string | null, uploads: UploadIn[], rows: Map<string, UploadRow>) {
  let narration: UploadRow | null = null
  let music: UploadRow | null = null
  for (const u of uploads) {
    const r = rows.get(u.uploadId)!
    const kind = assetKind(r.mime, r.filename, u.kind)
    const label = u.label || r.filename
    const role = kind === 'video' ? 'footage' : kind === 'image' ? 'photo' : kind === 'audio' ? (isNarrationLabel(label) ? 'narration' : 'music') : 'script'
    if (role === 'narration' && !narration) narration = r
    if (role === 'music' && !music) music = r
    await db().studioAsset.upsert({
      where: { projectId_uploadId: { projectId, uploadId: r.id } }, update: {},
      create: { id: createId('msa'), projectId, workspaceId, uploadId: r.id, kind, filename: label, status: 'pending', width: r.width,
        height: r.height, durationMs: r.durationMs, provenanceLog: toPrismaJson({ role, source: 'user_upload' }) },
    })
    if (clipProjectId && (kind === 'video' || kind === 'image' || kind === 'audio')) {
      try {
        await registerProjectMedia(workspaceId, clipProjectId, { uploadId: r.id, label, durationMs: r.durationMs ?? undefined,
          width: r.width ?? undefined, height: r.height ?? undefined })
      } catch (err) {
        console.warn('[motion-studio:assets] media_register_failed', { projectId, type: err instanceof Error ? err.name : typeof err })
      }
    }
  }
  return { narration, music }
}

// ------------------------------------------------------------------ create
export async function createProject(workspaceId: string, userId: string, body: unknown, headerKey?: string | null) {
  assertEnabled()
  const o = J(body)
  const workflow = (['idea', 'script', 'footage'].includes(o.workflow) ? o.workflow : 'idea') as MsWorkflow
  const prompt = typeof (o.prompt ?? o.brief) === 'string' ? String(o.prompt ?? o.brief).trim() : ''
  const script = typeof o.script === 'string' ? o.script : ''
  if (o.mediaPolicy && !['uploads_only','auto_plus_uploads','auto_only'].includes(String(o.mediaPolicy)))
    throw new MotionStudioError('INVALID', 'Unsupported media policy.', 400)
  const uploads = parseUploads(o.uploads ?? o.uploadIds)
  if (!prompt && !script && !uploads.length) throw new MotionStudioError('INVALID', 'Describe the video, paste a script or add media.', 400)
  if (workflow === 'footage' && !uploads.length) throw new MotionStudioError('INVALID', 'Add the footage to edit.', 400)
  const rawKey = (headerKey || str(o.idempotencyKey, 120) || createId('msk')).slice(0, 120)
  const key = `${userId}:${rawKey}`.slice(0, 190)     // dedupe per user
  const existing = await db().motionStudioProject.findUnique({ where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: key } } })
  if (existing) {
    console.info('[motion-studio:create] idempotent_replay', { projectId: existing.id })
    return { project: await getProject(workspaceId, existing.id), created: false }
  }
  const creative = sanitizeCreativeBrief(o.creative)
  if (creative.brandMode === 'saved') {
    if (!creative.brandKitId) throw new MotionStudioError('INVALID', 'Choose a saved brand kit.', 400)
    const saved = await loadBrandKit(workspaceId, creative.brandKitId)
    creative.brand = { ...saved.profile }
  }
  // Validate every referenced brand asset independently of user-upload metadata.
  const extraIds = [creative.brandMode !== 'none' ? creative.brand?.logoUploadId : undefined, ...(creative.referenceUploadIds || [])].filter((x): x is string => Boolean(x))
  const allUploads = [...uploads]
  for (const uploadId of extraIds) if (!allUploads.some(x => x.uploadId === uploadId)) allUploads.push({ uploadId, kind: 'photo' })
  const rows = await loadUploads(workspaceId, allUploads.map(u => u.uploadId))
  if (creative.brand?.logoUploadId && !['image/png','image/jpeg','image/webp'].includes(rows.get(creative.brand.logoUploadId)?.mime || '')) throw new MotionStudioError('INVALID', 'Brand logo must be an image.', 400)
  if (creative.referenceUploadIds?.some(id => !rows.get(id)?.mime.startsWith('image/') && !rows.get(id)?.mime.startsWith('video/'))) throw new MotionStudioError('INVALID', 'References must be images or video.', 400)
  const settings: MsSettings = parseSettings({ format: o.format || J(o.settings).format }, DEFAULT_SETTINGS)
  const reqMusic = J(o.settings).music ?? o.music
  if (MUSIC_CHOICES.includes(reqMusic) && reqMusic !== 'upload') settings.music = reqMusic
  const requested = o.lengthMin ?? J(o.settings).lengthMin
  const len = /\b(\d+)\s*(?:-\s*)?(?:minutes?|mins?)\b/i.exec(prompt)
  const requestedMinutes = requested !== undefined ? Number(requested) : len ? Number(len[1]) : undefined
  if (requestedMinutes !== undefined && o.durationSeconds == null) {
    if (!validMinutes(requestedMinutes)) throw new MotionStudioError('INVALID', 'Length must be a positive whole number of minutes.', 400)
    settings.lengthMin = requestedMinutes
  }
  const requestedSeconds = Number(o.durationSeconds)
  if (o.durationSeconds !== undefined) {
    if (![30, 60, 120, 180, 300].includes(requestedSeconds)) throw new MotionStudioError('INVALID','Choose 30 seconds, 1, 2, 3 or 5 minutes.',400)
    settings.durationSeconds = requestedSeconds
    settings.lengthMin = Math.ceil(requestedSeconds / 60)
  }
  const id = createId('msp')
  const clipProjectId = createId('proj')
  const canvasUploadId = createId('upl')
  const clipId = stableId('clip_ms_', id)
  const title = titleFromCreate(o, prompt, script)
  try {
    await db().$transaction(async (tx: Tx) => {
      await tx.clipUpload.create({ data: { id: canvasUploadId, workspaceId, key: uploadSourceKey(workspaceId, canvasUploadId, 'mp4'),
        filename: 'Motion Studio video.mp4', bytes: BigInt(0), mime: 'video/mp4', status: 'PENDING', storageDriver: storageDriverName(), kind: 'source' } })
      await tx.clipProject.create({ data: { id: clipProjectId, workspaceId, createdById: userId, title: (title || prompt || 'Video').slice(0, 120),
        uploadId: canvasUploadId, sourceKind: 'motion_studio',
        settings: toPrismaJson(defaultClipSettings({ aspectRatio: settings.format.split('_')[0] as '16:9' | '9:16' | '1:1', rangeStartMs: 0, rangeEndMs: settings.lengthMin * 60_000, byo: true,
          fullVideo: true, blank: true, captions: { enabled: false, presetId: 'bold_pop', language: 'en' } })),
        rangeStartMs: 0, rangeEndMs: settings.lengthMin * 60_000, status: 'QUEUED', stage: 'motion_studio', progress: 0 } })
      await tx.motionStudioProject.create({ data: { id, workspaceId, userId, director: 'creative', clipProjectId, clipId, title,
        brief: prompt || script, workflow,
        settings: toPrismaJson({ ...settings, aspect: settings.format.split('_')[0], automation: settings.productionMode, music: settings.music ?? 'generated', script, mediaPolicy: o.mediaPolicy || 'auto_plus_uploads', creative }),
        status: 'setup', stage: 'story', stages: toPrismaJson({}), idempotencyKey: key } })
      await tx.studioActivityEvent.create({ data: { projectId: id, stage: 'story', kind: 'stage', message: 'Project created. Nothing renders until you create the plan.' } })
    })
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code === 'P2002') {
      const again = await db().motionStudioProject.findUnique({ where: { workspaceId_idempotencyKey: { workspaceId, idempotencyKey: key } } })
      if (again) return { project: await getProject(workspaceId, again.id), created: false }
    }
    throw err
  }
  const roles = await attachUploads(workspaceId, id, clipProjectId, allUploads, rows)
  if (roles.narration || roles.music) {
    await updateSettingsLocked(id, s => ({
      ...s,
      ...(roles.narration ? { voiceover: 'upload', voiceoverUploadKey: roles.narration.key } : {}),
      ...(roles.music ? { music: 'upload', musicUploadKey: roles.music.key } : {}),
    }))
  }
  console.info('[motion-studio:create] created', { projectId: id, clipProjectId, workflow, uploads: uploads.length })
  return { project: await getProject(workspaceId, id), created: true }
}

// ------------------------------------------------------------------ load + view
type ProjectRow = NonNullable<Awaited<ReturnType<ReturnType<typeof db>['motionStudioProject']['findFirst']>>>
type SceneRow = Awaited<ReturnType<ReturnType<typeof db>['motionStudioScene']['findMany']>>[number]
type AssetRow = Awaited<ReturnType<ReturnType<typeof db>['studioAsset']['findMany']>>[number]

async function required(workspaceId: string, id: string): Promise<ProjectRow> {
  assertEnabled()
  const row = await db().motionStudioProject.findFirst({ where: { id, workspaceId } })
  if (!row) throw new MotionStudioError('NOT_FOUND', 'Project not found.', 404)
  return row
}

async function sign(key: string | null | undefined, downloadFilename?: string): Promise<string | null> {
  if (!key) return null
  try {
    return await createReadableSignedUrl(key, SIGN_TTL_S, downloadFilename ? { downloadFilename } : undefined)
  } catch {
    return null
  }
}

/** A worker job that died (stale lock -> FAILED) must not leave the project "running" forever. */
async function reconcileFailedJob(row: ProjectRow): Promise<ProjectRow> {
  if (!['queued', 'running'].includes(row.status) || !row.clipProjectId) return row
  const active = await db().clipJob.count({ where: { projectId: row.clipProjectId, status: { in: ['QUEUED', 'RUNNING'] }, type: { in: MS_JOB_TYPES } } })
  if (active) return row
  const failed = await db().clipJob.findFirst({
    where: { projectId: row.clipProjectId, status: 'FAILED', type: { in: MS_JOB_TYPES }, finishedAt: { gte: row.updatedAt } },
    select: { error: true },
  })
  if (!failed) return row
  return db().motionStudioProject.update({ where: { id: row.id }, data: { status: 'failed', errorCode: 'job_failed',
    errorMessage: 'A production step stopped unexpectedly. Retry the step to continue.', errorStage: row.stage } })
}

const WORDS_PER_S = 2.3   // Brian at speed 0.85

const VT: Record<string, { visualType: MsVisualType; kind: MsSelectionKind; treatment: string; graphicName: string; tags: string[] }> = {
  title: { visualType: 'text', kind: 'text', treatment: 'Hero typography', graphicName: 'Hero type', tags: ['Graphic', 'Word-synced'] },
  quote: { visualType: 'text', kind: 'text', treatment: 'Quote card', graphicName: 'Quote', tags: ['Graphic', 'Word-synced'] },
  data: { visualType: 'chart', kind: 'chart', treatment: 'Custom motion graphic', graphicName: 'Chart animation', tags: ['Code animation', 'Word-synced'] },
  map: { visualType: 'map', kind: 'scene', treatment: 'Map sequence', graphicName: 'World map', tags: ['Map', 'Code-rendered camera'] },
  timeline: { visualType: 'diagram', kind: 'scene', treatment: 'Timeline', graphicName: 'Timeline', tags: ['Diagram', 'Code animation'] },
  diagram: { visualType: 'diagram', kind: 'scene', treatment: 'Explainer diagram', graphicName: 'Connector diagram', tags: ['Diagram', 'Framework block'] },
  photo: { visualType: 'photo', kind: 'photo', treatment: 'Documentary photo reveal', graphicName: 'Photo surface', tags: ['Photo', 'Code-rendered camera'] },
  document: { visualType: 'photo', kind: 'photo', treatment: 'Document close-up', graphicName: 'Evidence board', tags: ['Photo', 'Callouts'] },
  abstract: { visualType: 'cinematic', kind: 'scene', treatment: 'Cinematic motion graphic', graphicName: 'World canvas', tags: ['Code animation', 'Original composition'] },
  handoff: { visualType: 'footage', kind: 'clip', treatment: 'Cinematic Media Handoff', graphicName: 'Photo-to-footage handoff', tags: ['Footage', 'Approach · Play · Return'] },
}

function sceneStatus(s: SceneRow): MsSceneStatus {
  if (s.status === 'done' || s.status === 'ready') return 'ready'
  if (s.status === 'rendering') return 'rendering'
  if (s.status === 'failed') return 'failed'
  return 'planned'
}

type Ctx = { row: ProjectRow; s: Json; story: Json | null; plan: Json | null; scenes: SceneRow[]; assets: AssetRow[] }

function chaptersView(story: Json | null): MsChapter[] {
  if (!story) return []
  const srcs: Json[] = Array.isArray(story.sources) ? story.sources : []
  const srcFor = (u: unknown) => {
    const url = typeof u === 'string' ? u : str(J(u).url, 2000)
    if (!url) return null
    const hit = srcs.find(x => J(x).url === url)
    let title = str(J(hit).title ?? J(u).title, 200)
    if (!title) { try { title = new URL(url).hostname.replace(/^www\./, '') } catch { title = url.slice(0, 60) } }
    return { title, url }
  }
  const lines: Json[] = Array.isArray(story.lines) ? story.lines : []
  const chapters: Json[] = Array.isArray(story.chapters) && story.chapters.length ? story.chapters
    : [...new Set(lines.map(l => l.chapter))].map((n, i) => ({ n, title: `Chapter ${i + 1}` }))
  return chapters.map((c, i) => {
    const cl = lines.filter(l => String(l.chapter) === String(c.n ?? i + 1))
    return {
      id: `ch${c.n ?? i + 1}`, index: i, title: str(c.title, 200) || `Chapter ${i + 1}`,
      summary: str(c.summary, 600) || cl.slice(0, 2).map(l => str(l.text, 140)).join(' '),
      lines: cl.map(l => ({ id: String(l.id), text: String(l.text ?? ''), sources: (Array.isArray(l.sources) ? l.sources : []).map(srcFor).filter(Boolean) as { title: string; url: string }[] })),
    }
  })
}


function sceneElements(plan: Json, qa: unknown): MsScene['elements'] {
  if (Array.isArray(plan.elements)) return plan.elements as MsScene['elements']
  const blob = qa ? J(qa) : {}
  if (Array.isArray(blob.elements)) return blob.elements as MsScene['elements']
  const spec = blob.spec ? J(blob.spec) : {}
  const out: NonNullable<MsScene['elements']> = []
  const push = (id: unknown, kind: string, extra?: Json) => {
    if (!id) return
    out.push({ id: String(id), kind, ...((extra && typeof extra === 'object') ? extra : {}) })
  }
  if (spec.environment) push(J(spec.environment).id ?? 'environment', 'environment', J(spec.environment))
  for (const row of ([...(Array.isArray(spec.media) ? spec.media : []), ...(Array.isArray(spec.placements) ? spec.placements : [])] as Json[]).slice(0, 40)) {
    const r = J(row)
    push(r.id ?? r.assetId, 'media', r)
  }
  for (const row of ([...(Array.isArray(spec.graphics) ? spec.graphics : []), ...(Array.isArray(spec.objects) ? spec.objects : [])] as Json[]).slice(0, 40)) {
    const r = J(row)
    push(r.id ?? r.name, 'graphic', r)
  }
  for (const row of (Array.isArray(spec.text) ? spec.text : []) as Json[]) {
    const r = J(row)
    push(r.id ?? r.name, 'text', r)
  }
  if (spec.camera) push(J(spec.camera).id ?? 'camera', 'camera', J(spec.camera))
  return out.length ? out : undefined
}

async function scenesView(c: Ctx): Promise<MsScene[]> {
  const lines: Json[] = Array.isArray(c.story?.lines) ? c.story!.lines : []
  const byLine = new Map(lines.map(l => [String(l.id), l]))
  const assetById = new Map(c.assets.map(a => [a.id, a]))
  let cursor = 500
  return Promise.all(c.scenes.map(async s => {
    const p = J(s.plan)
    const lineIds: string[] = Array.isArray(p.lineIds) ? p.lineIds.map(String) : []
    const meta = VT[s.visualType] ?? VT[s.kind === 'graphics' ? 'abstract' : 'handoff']
    const h = p.handoff ? J(p.handoff) : null
    const footageMs = h ? Math.max(1000, Math.round(((Number(h.outS) || 0) - (Number(h.inS) || 0)) * 1000)) : 0
    let startMs = s.startMs
    let endMs = s.endMs
    if (!endMs) {   // before narration exists: estimate from word counts (storyboard only)
      const words = lineIds.reduce((n, id) => n + String(byLine.get(id)?.spoken ?? byLine.get(id)?.text ?? '').split(/\s+/).filter(Boolean).length, 0)
      const dur = h && !lineIds.length ? ENTER_MS + footageMs + EXIT_MS : Math.max(2000, Math.round((words / WORDS_PER_S) * 1000) + 600)
      startMs = cursor
      endMs = cursor + dur
      cursor = endMs
    }
    const chapter = lineIds.length ? byLine.get(lineIds[0])?.chapter : null
    const heroes = lineIds.map(id => str(byLine.get(id)?.hero, 60)).filter(Boolean)
    const asset = h?.assetId ? assetById.get(String(h.assetId)) : null
    const params = J(p.params)
    return {
      id: s.id, chapterId: chapter != null ? `ch${chapter}` : (c.scenes.length ? 'ch1' : ''), index: s.index, startMs, endMs,
      title: str(p.title, 120) || heroes.join(' · ').slice(0, 80) || meta.graphicName,
      treatment: meta.treatment, description: str(p.description, 1000), visualType: meta.visualType, kind: meta.kind,
      reason: str(p.reason, 600), tags: meta.tags, graphicName: meta.graphicName,
      style: str(p.styleOverride, 200) || str(J(c.plan?.style).mood, 80) || 'Director-chosen',
      camera: str(p.cameraOverride, 200) || (h ? 'Camera enters the surface' : 'Director-chosen camera path'),
      source: asset ? asset.filename : s.visualType === 'data' ? 'Research data' : 'Script',
      text: str(p.textOverride, 500) || heroes.join(' · '),
      status: sceneStatus(s), thumbnailUrl: await sign(s.stillKey), previewUrl: await sign(s.renderKey),
      assetIds: asset ? [asset.id] : [],
      handoff: h ? { assetId: String(h.assetId), approachMs: ENTER_MS, footageMs, returnMs: EXIT_MS, exit: s.kind === 'hardcut' ? 'cut' : 'return' } : null,
      version: s.version, params, error: s.error ? 'This scene failed to render. Regenerate it to try again.' : null,
      elements: sceneElements(p, s.qa),
    } as MsScene
  }))
}

async function assetsView(c: Ctx): Promise<MsAsset[]> {
  return Promise.all(c.assets.map(async a => {
    const an = a.analysis ? J(a.analysis) : {}
    const prov = J(a.provenanceLog)
    const kind: MsAssetKind = a.kind === 'image' ? 'photo' : (a.kind as MsAssetKind)
    const sceneIds = c.scenes.filter(s => J(J(s.plan).handoff).assetId === a.id || (J(s.plan).assetIds ?? []).includes?.(a.id)).map(s => s.id)
    const up = await db().clipUpload.findUnique({ where: { id: a.uploadId }, select: { key: true } })
    const words: Json[] = Array.isArray(an.words) ? an.words : []
    return {
      id: a.id, kind, label: a.filename, url: kind === 'script' ? null : await sign(up?.key), durationMs: a.durationMs,
      role: prov.role ?? (kind === 'video' ? 'footage' : kind === 'photo' ? 'photo' : kind === 'audio' ? 'music' : 'script'),
      analysis: {
        status: a.status === 'ready' ? 'ready' : a.status === 'failed' ? 'failed' : a.status === 'analyzing' ? 'analyzing' : 'queued',
        summary: str(an.description ?? an.summary, 600) || null,
        transcriptExcerpt: words.length ? words.slice(0, 40).map(w => w.w).join(' ') : null,
        faces: Array.isArray(an.faces) ? an.faces.length : null,
        objects: Array.isArray(an.objects) ? an.objects.slice(0, 12).map(String) : [],
        shots: Array.isArray(an.shots) ? an.shots.length : null,
      },
      intendedUse: sceneIds.length ? (kind === 'video' ? 'Footage handoff insert' : 'Anchor image') : null,
      chapterId: null, sceneIds, uploadedAt: a.createdAt.toISOString(),
    }
  }))
}

function feStatus(c: Ctx): MsProjectStatus {
  const { row, s } = c
  if (row.status === 'failed' || row.status === 'cancelled') return 'failed'
  if (row.status === 'setup') return 'setup'
  if (row.status === 'awaiting_approval') return 'awaiting_review'
  if (row.status === 'preflight_ok') return 'preflight_ok'
  if (row.status === 'review') return (s.exportRequested || ['transovo_agent','grokbot_agent'].includes(String(J(row.exportInfo).source))) && row.exportInfo ? 'complete' : 'review'
  if (!row.plan || row.stage === 'story' || row.stage === 'direct') return 'planning'
  return s.exportRequested ? 'exporting' : 'producing'
}

function stagesView(c: Ctx, status: MsProjectStatus): MsStage[] {
  const { row, s, scenes, assets } = c
  const st: Record<MsStageId, MsStageStatus> = { story: 'pending', assets: 'pending', direct: 'pending', graphics: 'pending', assemble: 'pending', review: 'pending' }
  const labels: Partial<Record<MsStageId, string>> = {}
  const analyzed = assets.filter(a => a.status === 'ready' || a.status === 'failed').length
  if (assets.length) labels.assets = `${analyzed} of ${assets.length} uploads analyzed`
  const ready = scenes.filter(x => sceneStatus(x) === 'ready').length
  if (scenes.length) labels.graphics = `${ready} of ${scenes.length} scenes`
  const doneThrough = (k: number) => STAGE_ORDER.slice(0, k).forEach(id => { st[id] = 'done' })
  if (status === 'planning') {
    st.story = row.story ? 'done' : 'running'
    st.assets = analyzed >= assets.length ? 'done' : 'running'
    st.direct = row.plan ? 'done' : row.story ? 'running' : 'pending'
  } else if (status === 'awaiting_review') {
    doneThrough(3)
    if ((s.productionMode ?? 'checkpoint') === 'checkpoint' && !s.approved) st.story = 'needs_review'
  } else if (status === 'producing' || status === 'exporting') {
    doneThrough(3)
    const allReady = scenes.length > 0 && ready === scenes.length
    st.graphics = allReady ? 'done' : 'running'
    st.assemble = allReady ? 'running' : 'pending'
  } else if (status === 'preflight_ok') {
    doneThrough(3)
    st.graphics = 'done'
    labels.graphics = 'Pre-flight passed · render not started'
  } else if (status === 'review') {
    doneThrough(5); st.review = 'running'
  } else if (status === 'complete') {
    doneThrough(6)
  } else if (status === 'failed') {
    const map: Record<string, MsStageId> = { story: 'story', plan: 'story', direct: 'direct', assets: 'assets', produce: 'graphics', graphics: 'graphics', assemble: 'assemble' }
    const failedAt = map[row.errorStage ?? row.stage] ?? 'story'
    doneThrough(STAGE_ORDER.indexOf(failedAt))
    st[failedAt] = 'failed'
  }
  return STAGE_ORDER.map(id => ({ id, status: st[id], progressLabel: labels[id] ?? null,
    error: st[id] === 'failed' ? (row.status === 'cancelled' ? 'Cancelled.' : row.errorMessage ? 'This step failed. Retry it to continue.' : null) : null }))
}

function allowanceFor(s: Json, plan?: Json | null): MsAllowance {
  const music = s.music ?? 'generated'
  const estimate = plan ? J(plan).costEstimate : null
  const breakdown = estimate && Array.isArray(J(estimate).breakdown) ? J(estimate).breakdown as Json[] : null
  const items = breakdown && breakdown.length
    ? breakdown.slice(0, 16).map((b) => {
        const row = J(b)
        const credits = Number(row.credits)
        const n = Number.isFinite(credits) ? credits : 0
        return {
          id: str(row.id, 40) || 'item',
          label: str(row.label, 160) || str(row.id, 40) || 'Item',
          included: n === 0,
          thirdParty: Boolean(row.paidModel),
          credits: n,
        }
      })
    : [
      { id: 'research', label: s.webResearch ? 'Story research (web search)' : 'Story from model knowledge', included: true, thirdParty: Boolean(s.webResearch), credits: null },
      { id: 'script', label: 'Scriptwriting and direction', included: true, thirdParty: true, credits: null },
      { id: 'narration', label: s.voiceover === 'upload' ? 'Your narration (uploaded)' : 'AI narration', included: true, thirdParty: s.voiceover !== 'upload', credits: null },
      { id: 'graphics', label: 'Code-rendered motion graphics', included: true, thirdParty: false, credits: null },
      { id: 'music', label: music === 'upload' ? 'Your music' : music === 'elevenlabs' ? 'Generated music' : music === 'none' ? 'No music' : 'Score generated from the story beats', included: music !== 'none', thirdParty: music === 'elevenlabs', credits: null },
      { id: 'render', label: 'Render, mix and QA', included: true, thirdParty: false, credits: null },
    ]
  const estimateCredits = estimate && typeof J(estimate).total === 'number' ? Number(J(estimate).total) : null
  return {
    estimateCredits, minutes: Number(s.lengthMin) || 3,
    items,
  }
}

/** Customer-facing only: historical agent events predate the Transovo branding contract. */
function customerActivityMessage(message: string): string {
  if (/\/(?:workspace|tmp|home)\/|traceback|stack trace|api[_-]?key|bearer\s|https?:\/\//i.test(message))
    return "Transovo Agent is working on your video."
  return message.replace(/\bGrokbot\b/gi, 'Transovo Agent').replace(/\bGrok\b/gi, 'Transovo')
}

async function lastEventPerStage(projectId: string): Promise<Partial<Record<MsStageId, string>>> {
  const rows = await db().studioActivityEvent.findMany({ where: { projectId }, orderBy: { id: 'desc' }, take: 60, select: { stage: true, message: true } })
  const out: Partial<Record<MsStageId, string>> = {}
  for (const r of rows) {
    const st = stageOf(r.stage)
    if (!out[st]) out[st] = customerActivityMessage(r.message).slice(0, 200)
  }
  return out
}

function stageOf(stage: string): MsStageId {
  return (STAGE_ORDER as string[]).includes(stage) ? (stage as MsStageId) : stage === 'produce' ? 'graphics' : 'story'
}

function degradationsView(qa: unknown): MsProject['degradations'] {
  const items = Array.isArray(J(qa).degradations) ? J(qa).degradations as Json[] : []
  return items.map((d) => {
    const row = J(d)
    const errors = Array.isArray(row.errors) ? row.errors.map((e) => String(e)).slice(0, 12) : []
    return { stage: str(row.stage, 60) || 'unknown', errors, repaired: Boolean(row.repaired), degraded: row.degraded !== false }
  })
}

function preflightView(qa: unknown, settings: Json): MsProject['preflight'] {
  const pf = J(J(qa).preflight)
  if (!Object.keys(pf).length && !settings.preflightOnly) return null
  return {
    ok: pf.ok !== false,
    only: Boolean(pf.only ?? settings.preflightOnly),
    graphics: typeof pf.graphics === 'number' ? pf.graphics : undefined,
    handoffs: typeof pf.handoffs === 'number' ? pf.handoffs : undefined,
    scenes: typeof pf.scenes === 'number' ? pf.scenes : undefined,
    planSource: str(pf.planSource, 40) || undefined,
    productionSource: str(pf.productionSource, 40) || undefined,
    repaired: Boolean(pf.repaired),
  }
}

export async function getProject(workspaceId: string, id: string): Promise<MsProject> {
  let row = await required(workspaceId, id)
  row = await reconcileFailedJob(row)
  const [scenes, assets] = await Promise.all([
    db().motionStudioScene.findMany({ where: { projectId: id }, orderBy: { index: 'asc' } }),
    db().studioAsset.findMany({ where: { projectId: id }, orderBy: { createdAt: 'asc' } }),
  ])
  const c: Ctx = { row, s: J(row.settings), story: row.story ? J(row.story) : null, plan: row.plan ? J(row.plan) : null, scenes, assets }
  const status = feStatus(c)
  const stages = stagesView(c, status)
  const chapters = chaptersView(c.story)
  const sceneViews = await scenesView(c)
  const assetViews = await assetsView(c)
  const latest = await lastEventPerStage(id)
  const stOf = (sid: MsStageId) => stages.find(x => x.id === sid)!.status
  const readyScenes = sceneViews.filter(x => x.status === 'ready').length
  const sourced = chapters.reduce((n, ch) => n + ch.lines.filter(l => l.sources.length).length, 0)
  const activity: MsActivityStep[] = [
    { id: 'story_research', status: stOf('story'), counts: chapters.length ? `${chapters.length} chapters · ${sourced} sourced claims` : null, latestAction: latest.story ?? null },
    { id: 'uploads_analyzed', status: stOf('assets'), counts: `${assets.length} uploads · ${assets.filter((a: (typeof assets)[number]) => a.status === 'ready').length} analyzed · 0 missing visuals`, latestAction: latest.assets ?? null },
    { id: 'storyboard', status: stOf('direct'), counts: scenes.length ? `${scenes.length} scenes planned` : null, latestAction: latest.direct ?? null },
    { id: 'motion_graphics', status: stOf('graphics'), counts: scenes.length ? `${readyScenes} of ${scenes.length} rendered · QA checked` : null, latestAction: latest.graphics ?? null },
    { id: 'assembly_review', status: stOf('assemble') === 'done' ? stOf('review') : stOf('assemble'), counts: null, latestAction: latest.assemble ?? latest.review ?? null },
  ]
  const ex = row.exportInfo ? J(row.exportInfo) : null
  const music = row.music ? J(row.music) : null
  const audioDone = Boolean(ex)
  const producing = status === 'producing' || status === 'exporting'
  const exportState: MsProject['export'] = status === 'complete'
    ? { status: 'ready', progress: 100, filename: `${slug(row.title || c.story?.title || 'documentary')}.mp4` }
    : status === 'exporting' ? { status: 'rendering', progress: Math.round((readyScenes / Math.max(1, scenes.length)) * 90) }
      : status === 'failed' && c.s.exportRequested ? { status: 'failed', progress: 0, error: 'The export failed. Retry it to continue.' }
        : { status: 'idle', progress: 0 }
  const proposals = J(row.proposals)
  return {
    id: row.id, title: row.title || str(c.story?.title, 120) || 'Documentary', isExample: false,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), workflow: row.workflow as MsWorkflow,
    prompt: row.brief, mediaPolicy: ['uploads_only','auto_only'].includes(String(c.s.mediaPolicy)) ? c.s.mediaPolicy as MsProject['mediaPolicy'] : 'auto_plus_uploads', settings: feSettings(c.s), status, stages, activity,
    story: c.story ? { chapters, approved: Boolean(c.s.approved) || (c.s.productionMode === 'auto'), preservedUserScript: Boolean(c.story.verbatim),
      changeRequest: (c.s.lastChangeNote as string | undefined) ?? null } : null,
    scenes: sceneViews, assets: assetViews, missingVisuals: [],
    audio: {
      voice: { mode: c.s.voiceover === 'upload' ? 'upload' : 'ai', label: c.s.voiceover === 'upload' ? 'Your narration (uploaded)' : 'AI voice · documentary narrator',
        status: audioDone ? 'ready' : producing && row.narration ? 'rendering' : 'planned' },
      music: { source: c.s.music === 'upload' ? 'upload' : 'generated',
        label: c.s.music === 'upload' ? 'Your music' : c.s.music === 'elevenlabs' ? 'Generated music' : c.s.music === 'none' ? 'No music' : 'Score generated from the story beats',
        status: audioDone ? 'ready' : producing && music ? 'rendering' : 'planned' },
    },
    durationMs: Number(ex?.durationMs) || sceneViews.at(-1)?.endMs || 0,
    previewUrl: ex ? await sign(ex.smallKey ?? ex.masterKey) : null,
    styleRationale: c.plan ? str(J(c.plan.style).reason, 400) || str(J(c.plan.world).reason, 400) || null : null,
    proposals: (Array.isArray(proposals.items) ? proposals.items : []).map((p: StoredProposal) => ({ ...p,
      items: (Array.isArray(p.items) ? p.items : []).map(({ op: _op, ...it }) => it) })) as MsProposal[],
    director: Array.isArray(proposals.messages) ? proposals.messages : [],
    allowance: allowanceFor(c.s, c.plan), export: exportState,
    error: status === 'failed' ? (row.status === 'cancelled' ? 'Cancelled.' : (row.errorMessage || 'A step failed. Retry it to continue.')) : null,
    degradations: degradationsView(row.qa),
    preflight: preflightView(row.qa, c.s),
  }
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'documentary'
}

export async function listProjects(workspaceId: string, q: { limit?: string | null; cursor?: string | null }): Promise<{ projects: MsProjectSummary[]; nextCursor: string | null }> {
  assertEnabled()
  const limit = Math.max(1, Math.min(50, Number(q.limit) || 50))
  const rows = await db().motionStudioProject.findMany({ where: { workspaceId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) })
  const page = rows.slice(0, limit)
  const projects = await Promise.all(page.map(async (r: (typeof page)[number]) => {
    const [sceneCount, thumb] = await Promise.all([
      db().motionStudioScene.count({ where: { projectId: r.id } }),
      db().motionStudioScene.findFirst({ where: { projectId: r.id, stillKey: { not: null } }, orderBy: { index: 'asc' }, select: { stillKey: true } }),
    ])
    const c: Ctx = { row: r, s: J(r.settings), story: null, plan: r.plan ? J(r.plan) : null, scenes: [], assets: [] }
    return { id: r.id, title: r.title || str(J(r.story).title, 120) || 'Documentary', isExample: false, createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(), status: feStatus(c), workflow: r.workflow as MsWorkflow, sceneCount,
      durationMs: Number(J(r.exportInfo).durationMs) || (Number(J(r.settings).lengthMin) || 3) * 60_000, thumbnailUrl: await sign(thumb?.stillKey) }
  }))
  return { projects, nextCursor: rows.length > limit ? page[page.length - 1].id : null }
}

// ------------------------------------------------------------------ actions
async function enqueue(row: ProjectRow, type: string, payload: Record<string, unknown>, priority = 5) {
  if (!row.clipProjectId) throw new MotionStudioError('INTERNAL', 'Project canvas is missing.', 500)
  const active = await db().clipJob.findFirst({ where: { projectId: row.clipProjectId, type, status: { in: ['QUEUED', 'RUNNING'] },
    ...(payload.sceneId ? { payload: { path: ['sceneId'], equals: payload.sceneId as string } } : {}) }, select: { id: true } })
  if (active) return active.id
  const id = createId('job')
  await db().clipJob.create({ data: { id, projectId: row.clipProjectId, type, status: 'QUEUED', maxAttempts: 1, priority,
    payload: toPrismaJson({ motionProjectId: row.id, ...payload }) } })
  return id
}

async function event(projectId: string, stage: string, kind: string, message: string) {
  await db().studioActivityEvent.create({ data: { projectId, stage, kind, message: message.slice(0, 2000) } })
}

export async function patchProject(workspaceId: string, id: string, body: unknown) {
  const row = await required(workspaceId, id)
  const o = J(body)
  if (typeof o.title === 'string') await db().motionStudioProject.update({ where: { id }, data: { title: str(o.title, 120) } })
  if (o.settings) {
    const cur = J(row.settings)
    const next = parseSettings(o.settings, feSettings(cur))
    if (row.plan && next.lengthMin !== feSettings(cur).lengthMin) throw new MotionStudioError('CONFLICT', 'Length is locked once the production plan exists.', 409)
    const extra = J(o.settings)
    await updateSettingsLocked(id, s => ({
      ...s, ...next, automation: next.productionMode,
      music: MUSIC_CHOICES.includes(extra.music) && (extra.music !== 'upload' || s.musicUploadKey) ? extra.music : (s.music ?? 'generated'),
      ...(next.voiceover === 'upload' && !s.voiceoverUploadKey ? { voiceover: 'ai' } : {}),
    }))
    if (next.voiceover === 'upload' && !cur.voiceoverUploadKey)
      throw new MotionStudioError('INVALID', 'Upload your narration first (an audio file named voiceover or narration).', 400)
  }
  return getProject(workspaceId, id)
}

/** POST /plan — planning only (story, chapters, visual plan). Never renders. */
export async function createPlan(workspaceId: string, id: string, key?: string | null) {
  const row = await required(workspaceId, id)
  if (!(await claimKey(id, 'plan', key))) return getProject(workspaceId, id)
  if (row.status !== 'setup' && !(row.status === 'failed' && !row.plan)) return getProject(workspaceId, id)
  await db().motionStudioProject.update({ where: { id }, data: { status: 'queued', stage: 'story', errorCode: null, errorMessage: null, errorStage: null } })
  await event(id, 'story', 'stage', 'Planning started. No render is queued until the plan exists.')
  await enqueue(row, 'DOC_PLAN', {}, 5)
  return getProject(workspaceId, id)
}

async function startProduceIfReady(workspaceId: string, id: string) {
  const row = await required(workspaceId, id)
  const s = J(row.settings)
  if (row.status === 'awaiting_approval' && row.plan && shouldProduce(s)) {
    await db().motionStudioProject.update({ where: { id }, data: { status: 'running', stage: 'assets' } })
    await event(id, 'graphics', 'stage', 'Full production started.')
    await enqueue(row, 'DOC_PRODUCE', {}, 5)
  }
}

/** POST /run {mode} — idempotent; duplicate start returns the same run. */
export async function startProduction(workspaceId: string, id: string, body: unknown, key?: string | null) {
  const row = await required(workspaceId, id)
  const mode = J(body).mode === 'auto' ? 'auto' : 'checkpoint'
  if (!(await claimKey(id, 'run', key))) return getProject(workspaceId, id)
  if (row.status === 'setup') throw new MotionStudioError('CONFLICT', 'Create the production plan first.', 409)
  if (J(row.settings).runRequested) return getProject(workspaceId, id)
  await updateSettingsLocked(id, s => ({ ...s, runRequested: true, productionMode: mode, automation: mode }))
  await startProduceIfReady(workspaceId, id)
  return getProject(workspaceId, id)
}

export async function approveStory(workspaceId: string, id: string) {
  const row = await required(workspaceId, id)
  if (!row.story) throw new MotionStudioError('CONFLICT', 'The story is not ready yet.', 409)
  await updateSettingsLocked(id, s => ({ ...s, approved: true }))
  await event(id, 'story', 'stage', 'Story approved.')
  await startProduceIfReady(workspaceId, id)
  return getProject(workspaceId, id)
}

export async function requestStoryChanges(workspaceId: string, id: string, body: unknown) {
  const row = await required(workspaceId, id)
  const note = str(J(body).note, 4000)
  if (!note) throw new MotionStudioError('INVALID', 'Describe the change.', 400)
  if (!row.story) throw new MotionStudioError('CONFLICT', 'The story is not ready yet.', 409)
  if (!['awaiting_approval', 'review', 'failed'].includes(row.status)) throw new MotionStudioError('CONFLICT', 'Changes can be requested once the plan is ready.', 409)
  await updateSettingsLocked(id, s => ({ ...s, changeNote: note, lastChangeNote: note, approved: false, exportRequested: false }))
  await db().motionStudioProject.update({ where: { id }, data: { status: 'running', stage: 'story', narration: DB_NULL, errorCode: null, errorMessage: null, errorStage: null } })
  await event(id, 'story', 'decision', `Revising the story: “${note.slice(0, 140)}”. Unchanged scenes reuse their renders.`)
  await enqueue(row, 'DOC_PLAN', {}, 5)
  return getProject(workspaceId, id)
}

export async function retryStep(workspaceId: string, id: string, stage: string, key?: string | null) {
  const row = await required(workspaceId, id)
  if (!(await claimKey(id, `retry:${stage}`, key))) return getProject(workspaceId, id)
  if (row.status !== 'failed' && row.status !== 'cancelled') throw new MotionStudioError('STAGE_NOT_RETRYABLE', 'Only a failed step can be retried.', 409)
  const type = !row.plan ? 'DOC_PLAN' : stage === 'assemble' || stage === 'review' || (row.errorStage === 'assemble') ? 'DOC_ASSEMBLE' : 'DOC_PRODUCE'
  await db().motionStudioProject.update({ where: { id }, data: { status: 'running', stage: type === 'DOC_PLAN' ? 'story' : type === 'DOC_ASSEMBLE' ? 'assemble' : 'graphics',
    errorCode: null, errorMessage: null, errorStage: null } })
  await event(id, stageOf(stage), 'stage', 'Retry requested by you. This step runs once; nothing retries automatically.')
  await enqueue(row, type, { resume: true }, 5)
  return getProject(workspaceId, id)
}

export async function cancelProject(workspaceId: string, id: string) {
  const row = await required(workspaceId, id)
  if (['cancelled', 'review'].includes(row.status)) return getProject(workspaceId, id)
  await db().motionStudioProject.update({ where: { id }, data: { status: 'cancelled' } })
  if (row.clipProjectId)
    await db().clipJob.updateMany({ where: { projectId: row.clipProjectId, status: 'QUEUED', type: { in: MS_JOB_TYPES } }, data: { status: 'FAILED', error: 'cancelled' } })
  await event(id, row.stage, 'stage', 'Cancelled by you.')
  return getProject(workspaceId, id)
}

export async function listAssets(workspaceId: string, id: string) {
  return (await getProject(workspaceId, id)).assets
}

export async function addAssets(workspaceId: string, id: string, body: unknown) {
  const row = await required(workspaceId, id)
  const o = J(body)
  const uploads = parseUploads(o.uploads ?? o.uploadIds)
  if (!uploads.length) throw new MotionStudioError('INVALID', 'Choose files to add.', 400)
  const rows = await loadUploads(workspaceId, uploads.map(u => u.uploadId))
  const roles = await attachUploads(workspaceId, id, row.clipProjectId, uploads, rows)
  if (roles.narration || roles.music) {
    await updateSettingsLocked(id, s => ({ ...s,
      ...(roles.narration && !s.voiceoverUploadKey ? { voiceoverUploadKey: roles.narration.key } : {}),
      ...(roles.music && !s.musicUploadKey ? { musicUploadKey: roles.music.key, music: 'upload' } : {}) }))
  }
  await event(id, 'assets', 'stage', `Cataloged ${uploads.length} new upload${uploads.length === 1 ? '' : 's'}. Nothing re-renders until it is used.`)
  return getProject(workspaceId, id)
}

async function rerenderScenes(row: ProjectRow, sceneIds: string[], reason: string) {
  const produced = Boolean(row.narration) && ['review', 'failed', 'running'].includes(row.status) && row.stage !== 'story' && row.stage !== 'direct'
  if (!produced || !sceneIds.length) return false
  await db().motionStudioScene.updateMany({ where: { id: { in: sceneIds } }, data: { status: 'queued' } })
  await db().motionStudioProject.update({ where: { id: row.id }, data: { status: 'running', stage: 'graphics' } })
  await updateSettingsLocked(row.id, s => ({ ...s, exportRequested: false }))
  for (const sid of sceneIds) await enqueue(row, 'MGD_RENDER_SEGMENT', {
    sceneId: sid, regenerate: reason === 'regenerate' || reason === 'director_chat', force: true, reason,
    elementEdit: reason === 'scene_updated',
  }, 6)
  return true
}

export async function replaceAsset(workspaceId: string, id: string, assetId: string, body: unknown) {
  const row = await required(workspaceId, id)
  const withId = str(J(body).withAssetId, 64)
  const [from, to] = await Promise.all([
    db().studioAsset.findFirst({ where: { id: assetId, projectId: id } }),
    db().studioAsset.findFirst({ where: { id: withId, projectId: id } }),
  ])
  if (!from || !to) throw new MotionStudioError('NOT_FOUND', 'Asset not found.', 404)
  const visual = (k: string) => k === 'video' || k === 'image'
  if (from.kind !== to.kind && !(visual(from.kind) && visual(to.kind))) throw new MotionStudioError('INVALID', 'Replace with the same kind of media.', 400)
  const scenes = await db().motionStudioScene.findMany({ where: { projectId: id } })
  const affected: string[] = []
  for (const s of scenes) {
    const p = J(s.plan)
    if (J(p.handoff).assetId !== from.id) continue
    p.handoff = { ...J(p.handoff), assetId: to.id }
    await db().motionStudioScene.update({ where: { id: s.id }, data: { plan: toPrismaJson(p), version: { increment: 1 } } })
    affected.push(s.id)
  }
  const plan = row.plan ? J(row.plan) : null
  if (plan && Array.isArray(plan.scenes)) {
    plan.scenes = plan.scenes.map((x: Json) => (J(x.handoff).assetId === from.id ? { ...x, handoff: { ...J(x.handoff), assetId: to.id } } : x))
    await db().motionStudioProject.update({ where: { id }, data: { plan: toPrismaJson(plan) } })
  }
  await event(id, 'graphics', 'decision', `Replaced ${from.filename} with ${to.filename}. Re-rendering ${affected.length} affected scene${affected.length === 1 ? '' : 's'} only.`)
  await rerenderScenes(row, affected, 'asset_replaced')
  return getProject(workspaceId, id)
}

export async function updateScene(workspaceId: string, id: string, sceneId: string, body: unknown) {
  const row = await required(workspaceId, id)
  const scene = await db().motionStudioScene.findFirst({ where: { id: sceneId, projectId: id } })
  if (!scene) throw new MotionStudioError('NOT_FOUND', 'Scene not found.', 404)
  const o = J(body)
  const p = J(scene.plan)
  if (o.startMs != null || o.endMs != null) {
    const start = Number(o.startMs ?? scene.startMs)
    const end = Number(o.endMs ?? scene.endMs)
    if (!(end - start >= 1000)) throw new MotionStudioError('INVALID', 'A scene must be at least one second long.', 400)
    p.timingRequest = { startMs: start, endMs: end }   // v1: scene timing follows the narration; stored as a request
  }
  if (typeof o.style === 'string') p.styleOverride = str(o.style, 200)
  if (typeof o.camera === 'string') p.cameraOverride = str(o.camera, 200)
  if (typeof o.text === 'string') p.textOverride = str(o.text, 500)
  if (o.params && typeof o.params === 'object') {
    const clean: Record<string, string | number | boolean> = {}
    for (const [k, v] of Object.entries(J(o.params)).slice(0, 40)) {
      if (['string', 'number', 'boolean'].includes(typeof v)) clean[k.slice(0, 40)] = typeof v === 'string' ? v.slice(0, 200) : (v as number | boolean)
    }
    p.params = { ...J(p.params), ...clean }
  }
  const elementList = Array.isArray(o.elements) ? o.elements : Array.isArray(o.elementPatches) ? o.elementPatches : null
  if (elementList) {
    p.elementPatches = (elementList as Json[]).slice(0, 40).map((el) => {
      const row = J(el)
      const out: Record<string, unknown> = { id: str(row.id, 80) }
      for (const [k, v] of Object.entries(row).slice(0, 20)) {
        if (k === 'id') continue
        if (['string', 'number', 'boolean'].includes(typeof v)) out[k.slice(0, 40)] = typeof v === 'string' ? v.slice(0, 400) : v
      }
      return out
    }).filter((el) => el.id)
  }
  const notes = [p.styleOverride && `Style: ${p.styleOverride}`, p.cameraOverride && `Camera: ${p.cameraOverride}`,
    p.textOverride && `On-screen text: ${p.textOverride}`, Object.keys(J(p.params)).length && `Parameters: ${JSON.stringify(p.params)}`].filter(Boolean)
  p.userNotes = notes.join('\n')
  await db().motionStudioScene.update({ where: { id: sceneId }, data: { plan: toPrismaJson(p), version: { increment: 1 } } })
  const queued = await rerenderScenes(row, [sceneId], 'scene_updated')
  await event(id, 'graphics', 'stage', `Updated scene ${scene.index + 1}${queued ? '; re-rendering that segment only' : ''}.`)
  return getProject(workspaceId, id)
}

export async function regenerateScene(workspaceId: string, id: string, sceneId: string, body: unknown, key?: string | null) {
  const row = await required(workspaceId, id)
  const scene = await db().motionStudioScene.findFirst({ where: { id: sceneId, projectId: id } })
  if (!scene) throw new MotionStudioError('NOT_FOUND', 'Scene not found.', 404)
  if (!(await claimKey(id, `regen:${sceneId}`, key))) return getProject(workspaceId, id)
  const instruction = str(J(body).instruction, 2000)
  const p = J(scene.plan)
  if (instruction) p.userNotes = [str(p.userNotes, 4000), `Director note: ${instruction}`].filter(Boolean).join('\n')
  await db().motionStudioScene.update({ where: { id: sceneId }, data: { plan: toPrismaJson(p), version: { increment: 1 } } })
  const queued = await rerenderScenes(row, [sceneId], 'regenerate')
  if (!queued) throw new MotionStudioError('CONFLICT', 'Scenes can be regenerated once production has rendered them.', 409)
  await event(id, 'graphics', 'decision', instruction ? `Rewriting scene ${scene.index + 1}: ${instruction.slice(0, 140)}` : `Regenerating scene ${scene.index + 1}. Other scenes are untouched.`)
  return getProject(workspaceId, id)
}

type StoredItem = MsProposalItem & { op?: DirectorOp }
type StoredProposal = Omit<MsProposal, 'items'> & { items: StoredItem[] }

const isProduced = (row: ProjectRow) =>
  Boolean(row.narration) && ['review', 'failed', 'running'].includes(row.status) && row.stage !== 'story' && row.stage !== 'direct'

async function blueprintOf(row: ProjectRow) {
  const [scenes, assets] = await Promise.all([
    db().motionStudioScene.findMany({ where: { projectId: row.id }, orderBy: { index: 'asc' } }),
    db().studioAsset.findMany({ where: { projectId: row.id } }),
  ])
  const bp = buildBlueprint({ plan: row.plan, story: row.story, scenes, settings: row.settings, title: row.title,
    assets: assets.map((a: (typeof assets)[number]) => ({ id: a.id, kind: a.kind === 'video' ? 'video' : a.kind, filename: a.filename, durationMs: a.durationMs, analysis: a.analysis })) })
  return { bp, scenes }
}

/**
 * Director chat (BE-10 / FE-7). The model reads the film's blueprint (world, look, scenes with their lines, emphasis
 * words and camera, footage inserts, score cues) and proposes typed edits; each one says what it will re-render.
 * Nothing is applied until accepted. If the model is unavailable the request is kept as one honest note-style change.
 */
export async function sendDirectorMessage(workspaceId: string, id: string, body: unknown) {
  const row = await required(workspaceId, id)
  const o = J(body)
  const text = str(o.message, 2000)
  if (!text) throw new MotionStudioError('INVALID', 'Type what you want to change.', 400)
  const sceneId = str(o.sceneId, 64) || null
  if (sceneId && !(await db().motionStudioScene.findFirst({ where: { id: sceneId, projectId: id }, select: { id: true } })))
    throw new MotionStudioError('NOT_FOUND', 'Scene not found.', 404)
  const now = new Date().toISOString()
  const cur = J(row.proposals)
  const prior: MsDirectorMessage[] = Array.isArray(cur.messages) ? cur.messages : []
  let reply: string
  let items: DirectorItem[] = []
  if (!row.plan || !row.story) {
    items = [{ text: `Use this when the plan is written: “${noCurrency(text).slice(0, 200)}”`, effect: 'Applies when the plan is written', op: { type: 'story', note: text } }]
    reply = 'The plan isn’t written yet, so I’ll use this when I write it.'
  } else {
    const { bp, scenes } = await blueprintOf(row)
    const focus = sceneId ? scenes.find((x: (typeof scenes)[number]) => x.id === sceneId)?.index ?? null : null
    try {
      const out = await askDirector({ message: text, focusSceneIndex: focus, stage: isProduced(row) ? 'produced' : 'plan', blueprint: bp,
        recent: prior.map(m => ({ role: m.role, text: m.text })) })
      const v = validateItems(out.items, bp)
      items = v.items
      reply = noCurrency(out.reply.trim()).slice(0, 600) || (items.length ? 'Here’s what I’d change.' : 'Which scene should change, and how?')
      console.info('[motion-studio:director] proposal', { projectId: id, items: items.length, dropped: v.dropped.length, model: out.model,
        ops: items.map(i => i.op.type) })
      if (v.dropped.length) console.info('[motion-studio:director] dropped_ops', { projectId: id, reasons: v.dropped.slice(0, 8) })
      if (items.length) await event(id, isProduced(row) ? 'review' : 'direct', 'decision', `Director proposed ${items.length} change${items.length === 1 ? '' : 's'}: ${items.map(i => i.text).join(' · ').slice(0, 300)}`)
    } catch (err) {
      console.warn('[motion-studio:director] model_unavailable', { projectId: id, message: err instanceof Error ? err.message : String(err) })
      const sc = focus != null ? bp.scenes.find(x => x.index === focus) : undefined
      const op: DirectorOp = sc && sc.kind === 'graphics' ? { type: 'scene', sceneIndex: sc.index, note: text } : { type: 'story', note: text }
      items = [{ text: op.type === 'scene' ? `Scene ${op.sceneIndex + 1}: ${noCurrency(text).slice(0, 200)}` : `Revise the story and plan: “${noCurrency(text).slice(0, 200)}”`, effect: effectOf(op, bp), op }]
      reply = 'I couldn’t work out the exact edits just now, so here’s your request as one change.'
    }
  }
  const proposal: StoredProposal | null = items.length ? { id: createId('pr'), request: text, sceneId, createdAt: now,
    items: items.map(i => ({ id: createId('pi'), text: i.text, effect: i.effect, status: 'pending' as const, op: i.op })) } : null
  const all = [...(proposal ? [proposal] : []), ...(Array.isArray(cur.items) ? cur.items : [])].slice(0, 50)
  const messages = [...prior, { id: createId('dm'), role: 'user', text, at: now },
    { id: createId('dm'), role: 'director', text: reply, at: now, proposalId: proposal?.id ?? null }].slice(-200)
  await db().motionStudioProject.update({ where: { id }, data: { proposals: toPrismaJson({ ...cur, items: all, messages }) } })
  return getProject(workspaceId, id)
}

export async function decideProposal(workspaceId: string, id: string, proposalId: string, decision: 'accept' | 'reject', body: unknown) {
  const row = await required(workspaceId, id)
  const cur = J(row.proposals)
  const items: StoredProposal[] = Array.isArray(cur.items) ? cur.items : []
  const pr = items.find(x => x.id === proposalId)
  if (!pr) throw new MotionStudioError('NOT_FOUND', 'Proposal not found.', 404)
  const raw = J(body).itemIds
  const ids = raw === 'all' ? pr.items.filter(i => i.status === 'pending').map(i => i.id) : Array.isArray(raw) ? raw.map(String) : []
  const picked = pr.items.filter(it => ids.includes(it.id) && it.status === 'pending')
  if (decision === 'accept' && picked.length && ['queued', 'running'].includes(row.status))
    throw new MotionStudioError('CONFLICT', 'The Director can apply this once the current step finishes.', 409)
  for (const it of picked) it.status = decision === 'accept' ? 'accepted' : 'rejected'
  if (decision !== 'accept' || !picked.length) {
    await db().motionStudioProject.update({ where: { id }, data: { proposals: toPrismaJson({ ...cur, items }) } })
    return getProject(workspaceId, id)
  }
  // Older proposals (before typed ops) carry only text: keep their old meaning.
  const sceneRow = pr.sceneId ? await db().motionStudioScene.findFirst({ where: { id: pr.sceneId, projectId: id } }) : null
  const ops: DirectorOp[] = picked.map(it => it.op ?? (sceneRow ? { type: 'scene', sceneIndex: sceneRow.index, note: pr.request } : { type: 'story', note: pr.request }))
  const story = ops.filter((x): x is Extract<DirectorOp, { type: 'story' }> => x.type === 'story')
  if (story.length || !row.plan || !row.story) {
    // Script / structure changes go through the story revision; the other accepted edits ride along as notes.
    const note = [...story.map(x => x.note), ...picked.filter(it => it.op?.type !== 'story').map(it => it.text)].join('\n')
    await db().motionStudioProject.update({ where: { id }, data: { proposals: toPrismaJson({ ...cur, items }) } })
    if (row.story && ['awaiting_approval', 'review', 'failed'].includes(row.status)) return requestStoryChanges(workspaceId, id, { note })
    await updateSettingsLocked(id, s => ({ ...s, changeNote: [str(s.changeNote, 3000), note].filter(Boolean).join('\n') }))
    await event(id, 'story', 'decision', 'Change noted; it applies when the plan is written.')
    return getProject(workspaceId, id)
  }
  const { bp, scenes } = await blueprintOf(row)
  const res = applyOps(row.plan, scenes, ops, bp)
  const { layout: _layout, ...planNoLayout } = J(row.plan)
  const history = [{ at: new Date().toISOString(), proposalId, plan: planNoLayout,
    scenes: [...res.rowPlans.keys()].map(i => ({ index: i, plan: scenes.find((x: (typeof scenes)[number]) => x.index === i)?.plan ?? null })) },
    ...(Array.isArray(cur.history) ? cur.history : [])].slice(0, 3)
  await db().motionStudioProject.update({ where: { id }, data: { plan: toPrismaJson(res.plan), proposals: toPrismaJson({ ...cur, items, history }) } })
  for (const [index, rp] of res.rowPlans) {
    const sr = scenes.find((x: (typeof scenes)[number]) => x.index === index)
    if (!sr) continue
    await db().motionStudioScene.update({ where: { id: sr.id }, data: { plan: toPrismaJson(rp.plan), ...(rp.visualType ? { visualType: rp.visualType } : {}), version: { increment: 1 } } })
  }
  if (res.musicSetting) await updateSettingsLocked(id, s => ({ ...s, music: res.musicSetting }))
  const fresh = await required(workspaceId, id)
  const affected = [...res.affected].sort((a, b) => a - b)
  const what = picked.map(it => it.text).join(' · ').slice(0, 200)
  if (!isProduced(fresh)) {
    await event(id, 'direct', 'decision', `Plan updated: ${what}. It applies when production runs.`)
  } else if (res.relayout) {
    await db().motionStudioProject.update({ where: { id }, data: { status: 'running', stage: 'assets', errorCode: null, errorMessage: null, errorStage: null } })
    await updateSettingsLocked(id, s => ({ ...s, exportRequested: false }))
    await enqueue(fresh, 'DOC_PRODUCE', { reason: 'director_chat' }, 5)
    await event(id, 'graphics', 'decision', `Applying: ${what}. Re-timing the program; re-rendering ${scenesPhrase(affected)} only, the rest are cached.`)
  } else if (affected.length) {
    const sids = scenes.filter((x: (typeof scenes)[number]) => res.affected.has(x.index)).map((x: (typeof scenes)[number]) => x.id)
    await rerenderScenes(fresh, sids, 'director_chat')
    await event(id, 'graphics', 'decision', `Applying: ${what}. Re-rendering ${scenesPhrase(affected)} only.`)
  } else if (res.remix) {
    await db().motionStudioProject.update({ where: { id }, data: { status: 'running', stage: 'assemble', errorCode: null, errorMessage: null, errorStage: null } })
    await updateSettingsLocked(id, s => ({ ...s, exportRequested: false }))
    await enqueue(fresh, 'DOC_ASSEMBLE', { reason: 'director_chat' }, 5)
    await event(id, 'assemble', 'decision', `Applying: ${what}. Re-mixing the music; no scene re-renders.`)
  }
  return getProject(workspaceId, id)
}

export async function getAllowance(workspaceId: string, id: string): Promise<MsAllowance> {
  const row = await required(workspaceId, id)
  return allowanceFor(J(row.settings), row.plan ? J(row.plan) : null)
}

/** POST /export — the assembled master already exists after review; export marks it delivered (no re-render unless scenes changed). */
export async function startExport(workspaceId: string, id: string, key?: string | null) {
  const row = await required(workspaceId, id)
  // ST-CMH-014 hard gate: a footage handoff whose seam check failed blocks export (regenerate that scene first)
  const seam = ((row.qa ? J(row.qa) : null)?.checks as Array<{ id?: string; pass?: boolean }> | undefined)?.find(c => c?.id === 'A15')
  if (row.status === 'review' && seam && seam.pass === false)
    throw new MotionStudioError('CONFLICT', 'A footage handoff failed its seam check. Regenerate that scene, then export.', 409)
  if (!(await claimKey(id, 'export', key))) return getProject(workspaceId, id)
  if (!['review', 'running', 'failed'].includes(row.status) || !row.plan || !row.narration)
    throw new MotionStudioError('CONFLICT', 'Export is available once the documentary is ready for review.', 409)
  await updateSettingsLocked(id, s => ({ ...s, exportRequested: true }))
  if (row.status === 'failed' || (row.status === 'review' && !row.exportInfo)) {
    await db().motionStudioProject.update({ where: { id }, data: { status: 'running', stage: 'assemble', errorCode: null, errorMessage: null, errorStage: null } })
    await enqueue(row, 'DOC_ASSEMBLE', {}, 5)
  }
  await event(id, 'review', 'stage', 'Export started: MP4 · 16:9 · 1080p.')
  return getProject(workspaceId, id)
}

export async function getExportDownload(workspaceId: string, id: string) {
  const p = await getProject(workspaceId, id)
  const row = await required(workspaceId, id)
  const ex = row.exportInfo ? J(row.exportInfo) : null
  if (p.export.status !== 'ready' || !ex?.masterKey) throw new MotionStudioError('CONFLICT', 'The export is still rendering.', 409)
  const filename = p.export.filename || 'documentary.mp4'
  const url = await sign(ex.masterKey, filename)
  if (!url) throw new MotionStudioError('INTERNAL', 'The download link could not be created.', 500)
  return { url, filename }
}

export async function listActivity(workspaceId: string, id: string, q: { after?: string | null; limit?: string | null }): Promise<{ events: MsActivityEvent[]; cursor: string | null }> {
  await required(workspaceId, id)
  const after = Number(q.after) || 0
  const limit = Math.max(1, Math.min(200, Number(q.limit) || 200))
  const rows = await db().studioActivityEvent.findMany({ where: { projectId: id, id: { gt: after } }, orderBy: { id: 'asc' }, take: limit })
  const kindOf = (k: string): MsActivityEvent['kind'] =>
    /warn|error|fail/.test(k) ? 'warning' : /decision|research_plan|plan_|reason|checkpoint_reason/.test(k) ? 'reasoning'
      : /^stage$|checkpoint|_ready$/.test(k) ? 'status' : 'action'
  return {
    events: rows.map((r: (typeof rows)[number]) => ({ id: String(r.id), at: r.createdAt.toISOString(), stage: stageOf(r.stage), kind: kindOf(r.kind), text: customerActivityMessage(r.message) })),
    cursor: rows.length ? String(rows[rows.length - 1].id) : (q.after ?? null),
  }
}

/** Music stem of one assembly as a COMPLETE upload + project media (Compact Editor Music lane). */
async function ensureMusicStemUpload(workspaceId: string, row: ProjectRow, ex: Json): Promise<string | null> {
  const stems = J(ex.editorStems) as MsEditorStems & { musicBytes?: number }
  if (!stems.musicKey || !row.clipProjectId) return null
  const uploadId = stableId(MS_MUSIC_ID_PREFIX, `${row.id}:${stems.musicKey}`)
  const durationMs = Number(stems.durationMs ?? ex.durationMs) || null
  const s = J(row.settings)
  const label = s.music === 'upload' ? 'Your music (Motion Studio)' : 'Motion Studio score'
  await db().clipUpload.upsert({
    where: { id: uploadId },
    create: { id: uploadId, workspaceId, key: stems.musicKey, filename: `${label}.m4a`, bytes: BigInt(Math.max(0, Number(stems.musicBytes) || 0)),
      mime: 'audio/mp4', durationMs, status: 'COMPLETE', storageDriver: storageDriverName(), kind: 'media' },
    update: {},
  })
  await registerProjectMedia(workspaceId, row.clipProjectId, { uploadId, label, durationMs: durationMs ?? undefined, hasAudio: true })
  return uploadId
}

/**
 * Compact Editor clip for the assembled program (FE-6 / BE-9). Canvas = picture + dialog (or the full master for
 * older assemblies); scenes and footage inserts are Video-lane splits; music sits on the Music lane; the labelled
 * Motion Studio lanes ride in edits.motionStudio. Re-synced whenever timelineVersion changes.
 */
async function ensureEditorClip(workspaceId: string, id: string): Promise<{ clipProjectId: string; clipId: string; edits: ClipEditsV2 }> {
  const row = await required(workspaceId, id)
  const ex = row.exportInfo ? J(row.exportInfo) : null
  if (!ex || !row.clipProjectId || !row.clipId) throw new MotionStudioError('CONFLICT', 'The advanced editor opens once the first cut is assembled.', 409)
  const durationMs = Number(ex.durationMs) || 1000
  const patch = J(ex.editsPatch)
  const existing = await db().clip.findUnique({ where: { id: row.clipId }, select: { edits: true, aiMeta: true } })
  const meta = J(existing?.aiMeta)
  const agentSource = ex.source === 'transovo_agent' || ex.source === 'grokbot_agent'
  if (existing && meta.motionStudioTimelineVersion === row.timelineVersion &&
    (!agentSource || meta.motionStudioImportedManifest === true))
    return { clipProjectId: row.clipProjectId, clipId: row.clipId, edits: existing.edits as unknown as ClipEditsV2 }
  let musicUploadId: string | null = null
  try {
    musicUploadId = await ensureMusicStemUpload(workspaceId, row, ex)
  } catch (err) {
    console.warn('[motion-studio:editor] music_stem_unavailable', { projectId: id, message: err instanceof Error ? err.message : String(err) })
  }
  let edits = buildMotionStudioEditorEdits({
    base: existing ? (existing.edits as unknown as ClipEditsV2) : null,
    durationMs,
    patch: { markers: patch.markers as Marker[] | undefined, motionStudio: patch.motionStudio as ClipMotionStudioExt | undefined },
    musicUploadId,
    lastPlacedMusicUploadId: typeof meta.motionStudioMusicUploadId === 'string' ? meta.motionStudioMusicUploadId : null,
  })
  let manifestImported = false
  if (agentSource) {
    const selectedAgentJobId = typeof ex.agentJobId === 'string' ? ex.agentJobId : null
    const job = await db().motionStudioAgentJob.findFirst({ where: {
      projectId: id, workspaceId, status: 'complete',
      ...(selectedAgentJobId ? { id: selectedAgentJobId } : {}) },
      orderBy: { createdAt: 'desc' }, select: { id: true } })
    if (job) {
      const imported = await importAgentTimeline({ workspaceId, motionProjectId: id, clipProjectId: row.clipProjectId,
        durationMs, base: edits, latestJobId: job.id })
      if (imported) { edits = imported; manifestImported = true }
    }
  }
  const placedMusic = edits.audio?.music?.uploadId?.startsWith(MS_MUSIC_ID_PREFIX) ? edits.audio.music.uploadId : (meta.motionStudioMusicUploadId ?? null)
  const aiMeta = { ...meta, motionStudioProjectId: id, motionStudioTimelineVersion: row.timelineVersion,
    motionStudioMusicUploadId: placedMusic, ...(agentSource ? {motionStudioImportedManifest:manifestImported} : {}) }
  await db().clip.upsert({
    where: { id: row.clipId },
    create: { id: row.clipId, workspaceId, projectId: row.clipProjectId, title: (row.title || 'Documentary').slice(0, 120), reason: 'motion_studio',
      startMs: 0, endMs: durationMs, storageDriver: storageDriverName(), edits: toPrismaJson(edits), aiMeta: toPrismaJson(aiMeta) },
    update: { endMs: durationMs, edits: toPrismaJson(edits), aiMeta: toPrismaJson(aiMeta) },
  })
  console.info('[motion-studio:editor] clip_ready', { projectId: id, clipId: row.clipId, version: row.timelineVersion,
    scenes: (edits.videoSplits?.length ?? 0) + 1, music: Boolean(edits.audio?.music), dialogCanvas: J(ex.editorStems).canvas === 'dialog' })
  return { clipProjectId: row.clipProjectId, clipId: row.clipId, edits }
}

/** Editor page: bring a Motion Studio clip up to the latest assembly before it loads (no-op when current). */
export async function syncEditorClipIfStale(workspaceId: string, motionStudioProjectId: string, clipId: string): Promise<boolean> {
  const row = await db().motionStudioProject.findFirst({ where: { id: motionStudioProjectId, workspaceId },
    select: { clipId: true, timelineVersion: true, exportInfo: true } })
  if (!row || row.clipId !== clipId || !row.exportInfo) return false
  const clip = await db().clip.findUnique({ where: { id: clipId }, select: { aiMeta: true } })
  const meta = J(clip?.aiMeta)
  const source = J(row.exportInfo).source
  if (meta.motionStudioTimelineVersion === row.timelineVersion &&
    (!['transovo_agent','grokbot_agent'].includes(String(source)) || meta.motionStudioImportedManifest === true)) return false
  await ensureEditorClip(workspaceId, motionStudioProjectId)
  return true
}

export async function openInEditor(workspaceId: string, id: string): Promise<MsEditorHandoff> {
  const r = await ensureEditorClip(workspaceId, id)
  return { clipProjectId: r.clipProjectId, clipId: r.clipId }
}

/** Read the saved editor timeline without starting any manifest downloads or writes. */
export async function getTimelineSnapshot(workspaceId: string, id: string) {
  const row = await required(workspaceId, id)
  if (!row.clipProjectId || !row.clipId) throw new MotionStudioError('CONFLICT', 'Editor not prepared.', 409)
  const clip = await db().clip.findFirst({ where: { id: row.clipId, projectId: row.clipProjectId, workspaceId, deletedAt: null },
    select: { edits: true } })
  return { clipProjectId: row.clipProjectId, clipId: row.clipId,
    edits: clip?.edits ?? null }
}

export async function getTimeline(workspaceId: string, id: string) {
  const r = await ensureEditorClip(workspaceId, id)
  return { ...r, compactEditorUrl: `/app/video-editor/${r.clipProjectId}/edit/${r.clipId}?motionStudio=${encodeURIComponent(id)}` }
}
