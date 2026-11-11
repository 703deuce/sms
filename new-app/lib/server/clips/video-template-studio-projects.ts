import 'server-only'

import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { defaultClipSettings } from '@/lib/clips/settings'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { FIRST_PARTY_VIDEO_TEMPLATES } from '@/lib/clips/real-video-templates/releases'
import { materializeStudioDraft, newStudioDraft, type StudioDraft } from '@/lib/clips/real-video-templates/slot-workflow'
import { publishTemplateProject, TemplateInstanceConflict, TemplateInstanceNotFound } from '@/lib/server/clips/real-video-template-instances'

const KEY = /^[A-Za-z0-9_-]{8,120}$/
type DraftRecord = { id: string; status: string; version: number; draft: StudioDraft; clipId: string | null }
const releaseFor = (id: string) => FIRST_PARTY_VIDEO_TEMPLATES.find(item => item.id === id)
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
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
  if (!Number.isSafeInteger(value.version) || (value.version as number) < 0 ||
      !object(value.draft) || value.draft.v !== 1 ||
      typeof value.draft.releaseId !== 'string' || typeof value.draft.draftId !== 'string')
    return null
  return { version: value.version as number, draft: value.draft as StudioDraft }
}
async function assertDraftAssets(workspaceId: string, draft: StudioDraft) {
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
function validDraft(releaseId: string, raw: unknown): StudioDraft {
  if (!object(raw) || raw.v !== 1 || raw.releaseId !== releaseId ||
      typeof raw.draftId !== 'string' || !KEY.test(raw.draftId) ||
      !object(raw.slots) || Object.keys(raw.slots).length > 120 ||
      !object(raw.texts) || Object.keys(raw.texts).length > 60 ||
      (raw.musicTiming !== 'keep' && raw.musicTiming !== 'resync'))
    throw new Error('Invalid template draft')
  const release = releaseFor(releaseId)
  if (!release) throw new TemplateInstanceNotFound()
  const allowedSlots = new Set(release.family.slots.map(slot => slot.id))
  const allowedTexts = new Map(release.family.texts.map(t => [t.id, t.maxChars]))
  for (const [id, fill] of Object.entries(raw.slots)) {
    if (!allowedSlots.has(id) || !object(fill) ||
        !['cover','contain'].includes(String(fill.fit)) ||
        !['replace','loop','hold'].includes(String(fill.remedy)) ||
        !Number.isInteger(fill.sourceInFrame) || Number(fill.sourceInFrame) < 0 ||
        !Number.isFinite(fill.focalX) || !Number.isFinite(fill.focalY) ||
        typeof fill.muteSourceAudio !== 'boolean') throw new Error('Invalid slot fill')
  }
  for (const [id, text] of Object.entries(raw.texts)) {
    const max = allowedTexts.get(id)
    if (!max || typeof text !== 'string' || !text.trim() || Array.from(text).length > max)
      throw new Error('Invalid template text')
  }
  if (JSON.stringify(raw).length > 120_000) throw new Error('Template draft too large')
  return raw as StudioDraft
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
        settings: toPrismaJson({ ...defaultClipSettings(), videoTemplateDraft: { version: 0, draft: initial } }),
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
  if (current.status !== 'DRAFT' || expectedVersion !== current.version) throw new TemplateInstanceConflict()
  const draft = validDraft(current.draft.releaseId, raw)
  if (draft.draftId !== current.draft.draftId) throw new TemplateInstanceConflict()
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
  const { family, choices } = materializeStudioDraft(release.family, record.draft, instanceId)
  await assertDraftAssets(workspaceId, record.draft)
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
