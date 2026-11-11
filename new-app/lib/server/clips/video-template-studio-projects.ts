import 'server-only'

import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { compileTemplate, validateTemplateDesign, validateTemplateFamily, type TemplateAsset } from '@/lib/clips/real-video-templates/sequence-contract'
import { defaultClipSettings } from '@/lib/clips/settings'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { FIRST_PARTY_VIDEO_TEMPLATES } from '@/lib/clips/real-video-templates/releases'
import { materializeStudioDraft, newStudioDraft, type StudioDraft } from '@/lib/clips/real-video-templates/slot-workflow'
import { publishTemplateProject, TemplateInstanceConflict, TemplateInstanceNotFound } from '@/lib/server/clips/real-video-template-instances'

const KEY = /^[A-Za-z0-9_-]{8,120}$/
type DraftRecord = { id: string; status: string; version: number; draft: StudioDraft; clipId: string | null }
const releaseFor = (id: string) => FIRST_PARTY_VIDEO_TEMPLATES.find(item => item.id === id)
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
/** Compare persisted JSON drafts independent of JSONB/object key order. */
function equivalentDraft(a: unknown, b: unknown): boolean {
  const normalize = (value: unknown, depth = 0): unknown => {
    if (depth > 24) throw new Error('Template draft too deeply nested')
    if (Array.isArray(value)) return value.map(item => normalize(item, depth + 1))
    if (!object(value)) return value
    const ordered: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort())
      ordered[key] = normalize(value[key], depth + 1)
    return ordered
  }
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
}
function digest(...parts: string[]) {
  return createHash('sha256').update(parts.map(p => String(p.length) + ':' + p).join('|')).digest('hex')
}
/** Identical scoped derivation to Batch 3 idsFor — no alternate project ID namespace. */
export function templateDraftProjectId(workspaceId: string, key: string): string {
  if (!workspaceId || !KEY.test(key)) throw new Error('Invalid template draft key')
  return 'proj_tpl_' + digest('real-video-template-v1', workspaceId, key).slice(0, 32)
}
function templateInstanceId(workspaceId: string, key: string) {
  return 'vti_' + digest('real-video-template-v1', workspaceId, key).slice(0, 32)
}
function draftMeta(settings: unknown): { version: number; draft: StudioDraft } | null {
  if (!object(settings) || !object(settings.videoTemplateDraft)) return null
  const value = settings.videoTemplateDraft
  if ((typeof value.version !== 'number' || !Number.isSafeInteger(value.version)) || value.version < 0 ||
      !object(value.draft) || value.draft.v !== 1 ||
      typeof value.draft.draftId !== 'string' || !KEY.test(value.draft.draftId) ||
      typeof value.draft.releaseId !== 'string' || typeof value.draft.draftId !== 'string')
    return null
  return { version: value.version as number, draft: value.draft as StudioDraft }
}
export async function assertDraftAssets(workspaceId: string, draft: StudioDraft) {
  const selected = [
    ...Object.values(draft.slots).flatMap(s => [s.asset, ...(s.holdAsset ? [s.holdAsset] : [])]),
    ...(draft.music ? [draft.music] : []),
  ]
  if (selected.length > 260) throw new Error('Too many selected assets')
  for (const asset of selected) {
    if (!asset || typeof asset.id !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(asset.id) ||
        !['image', 'video', 'audio'].includes(asset.kind)) throw new Error('Invalid media assignment')
  }
  const ids = [...new Set(selected.map(s => s.id))]
  if (!ids.length) return
  const rows = await getPrisma().clipUpload.findMany({
    where: { workspaceId, status: 'COMPLETE', id: { in: ids } },
    select: { id: true, mime: true, durationMs: true },
  })
  if (rows.length !== ids.length) throw new TemplateInstanceNotFound()
  const byId = new Map(rows.map(r => [r.id, r]))
  for (const asset of selected) {
    const row = byId.get(asset.id)
    if (!row || !row.mime.startsWith(asset.kind + '/') ||
        (asset.kind !== 'image' && (!row.durationMs || !asset.durationFrames ||
          Math.ceil(asset.durationFrames * 1000 / 30) > row.durationMs + 33)))
      throw new TemplateInstanceNotFound()
  }
}
export function validDraft(releaseId: string, raw: unknown): StudioDraft {
  if (!object(raw) || raw.v !== 1 || raw.releaseId !== releaseId ||
      typeof raw.draftId !== 'string' || !KEY.test(raw.draftId) ||
      !object(raw.slots) || Object.keys(raw.slots).length > 120 ||
      !object(raw.texts) || Object.keys(raw.texts).length > 60 ||
      raw.musicTiming !== 'keep' ||
      (raw.brandColor != null && (typeof raw.brandColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(raw.brandColor))))
    throw new Error('Invalid template draft')
  const release = releaseFor(releaseId)
  if (!release) throw new TemplateInstanceNotFound()
  const allowedSlots = new Map(release.family.slots.map(slot => [slot.id, slot]))
  const allowedTexts = new Map(release.family.texts.map(t => [t.id, t.maxChars]))
  const validAsset = (rawAsset: unknown, kind: 'image' | 'video' | 'audio'): boolean => {
    if (!object(rawAsset) || rawAsset.kind !== kind ||
        typeof rawAsset.id !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(rawAsset.id) ||
        !object(rawAsset.license) || rawAsset.license.provenance !== 'user-owned') return false
    if (kind !== 'image' && (typeof rawAsset.durationFrames !== 'number' ||
        !Number.isSafeInteger(rawAsset.durationFrames) ||
        Number(rawAsset.durationFrames) < 1)) return false
    return true
  }
  for (const [id, fill] of Object.entries(raw.slots)) {
    const slot = allowedSlots.get(id)
    if (!slot || !object(fill) ||
        !['cover','contain'].includes(String(fill.fit)) ||
        !['replace','loop','hold'].includes(String(fill.remedy)) ||
        (typeof fill.sourceInFrame !== 'number' || !Number.isSafeInteger(fill.sourceInFrame)) ||
        fill.sourceInFrame < 0 ||
        typeof fill.focalX !== 'number' || !Number.isFinite(fill.focalX) ||
        fill.focalX < 0 || fill.focalX > 100 ||
        typeof fill.focalY !== 'number' || !Number.isFinite(fill.focalY) ||
        fill.focalY < 0 || fill.focalY > 100 ||
        typeof fill.muteSourceAudio !== 'boolean' ||
        !object(fill.asset) || !['image', 'video'].includes(String(fill.asset.kind)) ||
        !validAsset(fill.asset, fill.asset.kind as 'image' | 'video') ||
        (slot.media !== 'either' && slot.media !== fill.asset.kind) ||
        (slot.playback && fill.asset.kind !== 'video') ||
        (fill.asset.kind === 'image' && (fill.sourceInFrame !== 0 || fill.remedy !== 'replace')) ||
        (fill.remedy === 'hold' && fill.asset.kind !== 'video') ||
        (fill.holdAsset !== undefined && !validAsset(fill.holdAsset, 'image')))
      throw new Error('Invalid slot fill')
  }
  if (raw.music !== undefined && (release.design.musicPolicy === 'none' || !validAsset(raw.music, 'audio')))
    throw new Error('Template music is unavailable or unapproved')
  if (raw.music !== undefined && raw.musicRightsConfirmed !== true)
    throw new Error('Confirm ownership or licensed use of the selected music before saving')
  for (const [id, text] of Object.entries(raw.texts)) {
    const max = allowedTexts.get(id)
    if (!max || typeof text !== 'string' || !text.trim() || Array.from(text).length > max)
      throw new Error('Invalid template text')
  }
  if (JSON.stringify(raw).length > 120_000) throw new Error('Template draft too large')
  return raw as unknown as StudioDraft
}
export async function createVideoTemplateDraft(workspaceId: string, releaseId: string, key: string): Promise<DraftRecord> {
  const release = releaseFor(releaseId)
  if (!release) throw new TemplateInstanceNotFound()
  const id = templateDraftProjectId(workspaceId, key)
  const current = await getVideoTemplateDraft(workspaceId, id)
  if (current) {
    if (current.draft.releaseId !== releaseId || current.draft.draftId !== key) throw new TemplateInstanceConflict()
    return current
  }
  const initial = newStudioDraft(releaseId, key)
  try {
    await getPrisma().clipProject.create({
      data: { id, workspaceId, title: release.title, sourceKind: 'video_template_draft',
        stage: 'template_slots', status: 'DRAFT', rangeStartMs: 0,
        rangeEndMs: Math.round(release.family.totalFrames * 1000 / 30),
        settings: toPrismaJson({ ...defaultClipSettings(),
          videoTemplateOriginal: { family: release.family, design: release.design },
          videoTemplateDraft: { version: 0, draft: initial } }),
      },
    })
  } catch (e) {
    const after = await getVideoTemplateDraft(workspaceId, id)
    if (after && after.draft.releaseId === releaseId && after.draft.draftId === key) return after
    throw e
  }
  return { id, status: 'DRAFT', version: 0, draft: initial, clipId: null }
}
export async function getVideoTemplateDraft(workspaceId: string, projectId: string): Promise<DraftRecord | null> {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(projectId)) return null
  const row = await getPrisma().clipProject.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: { id: true, status: true, settings: true,
      clips: { where: { deletedAt: null }, take: 1, select: { id: true } } },
  })
  if (!row) return null
  const state = draftMeta(row.settings)
  if (!state || templateDraftProjectId(workspaceId, state.draft.draftId) !== projectId) return null
  return { id: row.id, status: row.status, version: state.version, draft: state.draft,
    clipId: row.clips[0]?.id ?? null }
}
export async function saveVideoTemplateDraft(
  workspaceId: string, projectId: string, expectedVersion: number, raw: unknown,
): Promise<DraftRecord> {
  const current = await getVideoTemplateDraft(workspaceId, projectId)
  if (!current) throw new TemplateInstanceNotFound()
  if (current.status !== 'DRAFT') throw new TemplateInstanceConflict()
  const draft = validDraft(current.draft.releaseId, raw)
  if (draft.draftId !== current.draft.draftId) throw new TemplateInstanceConflict()
  // A retry after an uncertain network response is safe only for the exact
  // immediately previous payload. Never silently accept a stale *different* edit.
  const same = equivalentDraft(current.draft, draft)
  if (same && (expectedVersion === current.version ||
      expectedVersion + 1 === current.version)) return current
  if (expectedVersion !== current.version) throw new TemplateInstanceConflict()
  await assertDraftAssets(workspaceId, draft)
  try {
    await getPrisma().$transaction(async tx => {
      const row = await tx.clipProject.findFirst({
        where: { id: projectId, workspaceId, status: 'DRAFT', deletedAt: null },
        select: { settings: true },
      })
      const state = draftMeta(row?.settings)
      if (!state || state.version !== expectedVersion) throw new TemplateInstanceConflict()
      const settings = row!.settings as Record<string, unknown>
      await tx.clipProject.update({ where: { id: projectId },
        data: { settings: toPrismaJson({ ...settings, videoTemplateDraft: {
          version: expectedVersion + 1, draft,
        } }) },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (error) {
    if (error instanceof TemplateInstanceConflict) throw error
    if (object(error) && error.code === 'P2034') throw new TemplateInstanceConflict()
    throw error
  }
  return { ...current, version: expectedVersion + 1, draft }
}
export async function publishVideoTemplateDraft(workspaceId: string, projectId: string) {
  const record = await getVideoTemplateDraft(workspaceId, projectId)
  if (!record) throw new TemplateInstanceNotFound()
  const release = releaseFor(record.draft.releaseId)
  if (!release) throw new Error('Template release no longer available; existing draft was not deleted')
  if (record.status !== 'DRAFT') {
    if (record.clipId) return { projectId, clipId: record.clipId, status: record.status }
    throw new TemplateInstanceConflict()
  }
  const instanceId = templateInstanceId(workspaceId, record.draft.draftId)
  // Older drafts may predate the music rights gate: do not publish them until confirmed.
  const approvedDraft = validDraft(record.draft.releaseId, record.draft)
  const { family, choices } = materializeStudioDraft(release.family, approvedDraft, instanceId)
  await assertDraftAssets(workspaceId, approvedDraft)
  const publish = await publishTemplateProject(
    workspaceId, record.draft.draftId, family, release.design,
    { media: choices.media, texts: choices.texts, music: choices.music },
    release.title,
  )
  return publish
}
export async function discardVideoTemplateDraft(workspaceId: string, projectId: string) {
  const record = await getVideoTemplateDraft(workspaceId, projectId)
  if (!record) throw new TemplateInstanceNotFound()
  if (record.status !== 'DRAFT') throw new TemplateInstanceConflict()
  await getPrisma().clipProject.updateMany({
    where: { id: projectId, workspaceId, status: 'DRAFT', deletedAt: null },
    data: { deletedAt: new Date() },
  })
}

/**
 * Standalone template editing (no editor timeline integration).
 * This atomically saves the pinned ClipEditsV2 video/text/graphics/music lanes and
 * corresponding workspace draft. Any independent editor save permanently blocks this
 * template-owned recompile, protecting manual full/Compact changes.
 */
export async function savePublishedStudioDraft(
  workspaceId: string,
  projectId: string,
  expectedVersion: number,
  expectedEditsSaveVersion: number,
  raw: unknown,
): Promise<{ version: number; editsSaveVersion: number }> {
  const state = await getVideoTemplateDraft(workspaceId, projectId)
  if (!state || !state.clipId) throw new TemplateInstanceNotFound()
  if (state.status !== 'READY') throw new TemplateInstanceConflict()
  const draft = validDraft(state.draft.releaseId, raw)
  if (draft.draftId !== state.draft.draftId || draft.musicTiming === 'resync')
    throw new Error('Music re-sync requires an approved beat map; choose Keep timing until analysis is available')
  if (state.version !== expectedVersion) {
    if (state.version === expectedVersion + 1 && equivalentDraft(state.draft, draft)) {
      const clip = await getPrisma().clip.findFirst({
        where: { id: state.clipId, workspaceId, deletedAt: null },
        select: { editsSaveVersion: true, aiMeta: true },
      })
      const aiMeta = clip?.aiMeta
      const metadata = object(aiMeta) ? aiMeta.videoTemplate : null
      if (clip?.editsSaveVersion === expectedEditsSaveVersion + 1 && object(metadata) &&
          metadata.studioEditsSaveVersion === clip.editsSaveVersion)
        return { version: state.version, editsSaveVersion: clip.editsSaveVersion }
    }
    throw new TemplateInstanceConflict()
  }
  await assertDraftAssets(workspaceId, draft)
  try {
    return await getPrisma().$transaction(async tx => {
      const project = await tx.clipProject.findFirst({
        where: { id: projectId, workspaceId, status: 'READY', deletedAt: null },
        select: { settings: true, clips: { where: { id: state.clipId!, deletedAt: null },
          select: { id: true, edits: true, aiMeta: true, editsSaveVersion: true } } },
      })
      const clip = project?.clips[0]
      const settings = project?.settings
      const saved = draftMeta(settings)
      if (!clip || !saved || saved.version !== expectedVersion ||
          !object(settings) || !object(settings.videoTemplateOriginal) ||
          clip.editsSaveVersion !== expectedEditsSaveVersion)
        throw new TemplateInstanceConflict()
      const original = settings.videoTemplateOriginal
      const family = validateTemplateFamily(original.family)
      const design = validateTemplateDesign(original.design, family)
      const aiMeta: Record<string, unknown> = object(clip.aiMeta) ? structuredClone(clip.aiMeta) : {}
      const templateMeta = aiMeta.videoTemplate
      if (!object(templateMeta) || templateMeta.instanceId !== templateInstanceId(workspaceId, draft.draftId) ||
          templateMeta.studioEditsSaveVersion !== expectedEditsSaveVersion)
        throw new TemplateInstanceConflict()
      const materialized = materializeStudioDraft(family, draft, String(templateMeta.instanceId))
      const durationMs = Math.round(family.totalFrames * 1000 / 30)
      const compiled = compileTemplate(materialized.family, design, materialized.choices,
        { durationFrames: family.totalFrames, edits: defaultEdits({ clipStartMs: 0, clipEndMs: durationMs }) })
      // Retain every unknown/legacy field; only the studio-authoritative lanes are changed.
      const old = clip.edits as unknown as ClipEditsV2
      const next: ClipEditsV2 = {
        ...old,
        sources: compiled.edits.sources,
        sourceSegments: compiled.edits.sourceSegments,
        videoSplits: compiled.edits.videoSplits,
        transitions: compiled.edits.transitions,
        keyframes: compiled.edits.keyframes,
        textItems: compiled.edits.textItems,
        audio: { ...old.audio, music: compiled.edits.audio.music },
        templateProvenance: compiled.edits.templateProvenance,
      }
      // Selected uploads are always revalidated within the transaction as well.
      const assets = new Map<string, TemplateAsset>()
      Object.values(materialized.choices.media).forEach(a => assets.set(a.id, a))
      if (materialized.choices.music) assets.set(materialized.choices.music.id, materialized.choices.music)
      const rows = await tx.clipUpload.findMany({
        where: { workspaceId, status: 'COMPLETE', id: { in: [...assets.keys()] } },
        select: { id: true, mime: true, durationMs: true, width: true, height: true },
      })
      if (rows.length !== assets.size) throw new TemplateInstanceNotFound()
      for (const row of rows) {
        const asset = assets.get(row.id)!
        if (!row.mime.startsWith(asset.kind + '/') ||
            (asset.kind !== 'image' && (!row.durationMs || !asset.durationFrames ||
              Math.ceil(asset.durationFrames * 1000 / 30) > row.durationMs + 33)))
          throw new TemplateInstanceNotFound()
        await tx.clipProjectMedia.upsert({
          where: { projectId_uploadId: { projectId, uploadId: row.id } },
          create: { id: 'pm_tpl_' + digest(projectId, row.id).slice(0, 28),
            projectId, workspaceId, uploadId: row.id, mediaType: asset.kind,
            label: row.id, durationMs: row.durationMs, width: row.width, height: row.height },
          update: {},
        })
      }
      templateMeta.snapshot = { family: materialized.family, design }
      templateMeta.authoringState = { media: materialized.choices.media, texts: materialized.choices.texts,
        ...(materialized.choices.music ? { music: materialized.choices.music } : {}) }
      templateMeta.authoringVersion = Number(templateMeta.authoringVersion ?? 0) + 1
      templateMeta.slotToItemIds = compiled.slotToItemIds
      templateMeta.studioEditsSaveVersion = expectedEditsSaveVersion + 1
      aiMeta.videoTemplate = templateMeta
      const written = await tx.clip.updateMany({
        where: { id: clip.id, workspaceId, editsSaveVersion: expectedEditsSaveVersion },
        data: { edits: toPrismaJson(next), aiMeta: toPrismaJson(aiMeta),
          editsSaveVersion: { increment: 1 } },
      })
      if (written.count !== 1) throw new TemplateInstanceConflict()
      await tx.clipProject.update({ where: { id: projectId },
        data: { settings: toPrismaJson({ ...settings, videoTemplateDraft: {
          version: expectedVersion + 1, draft,
        } }) },
      })
      return { version: expectedVersion + 1, editsSaveVersion: expectedEditsSaveVersion + 1 }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (error) {
    if (error instanceof TemplateInstanceConflict || error instanceof TemplateInstanceNotFound) throw error
    if (object(error) && error.code === 'P2034') throw new TemplateInstanceConflict()
    throw error
  }
}
