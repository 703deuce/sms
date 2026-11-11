import 'server-only'

import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { defaultEdits } from '@/lib/clips/edits'
import { compileTemplatePlayback, playbackSourceBounds } from '@/lib/clips/real-video-templates/slot-playback'
import { clipProjectSettingsSchema, defaultClipSettings } from '@/lib/clips/settings'
import {
  compileTemplate,
  validateTemplateDesign,
  validateTemplateFamily,
  type TemplateAsset,
  type TemplateChoices,
  type TemplateDesignV1,
  type TemplateFamilyV1,
} from '@/lib/clips/real-video-templates/sequence-contract'
import { getPrisma } from '@/lib/server/db'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { buildProcessProjectJobPayload } from '@/lib/server/clips/process-project-payload'
import { storageDriverName, uploadSourceKey } from '@/lib/storage'

const KEY_RE = /^[A-Za-z0-9_-]{8,120}$/
const ID_RE = /^[A-Za-z0-9_-]{1,120}$/

export class TemplateInstanceNotFound extends Error { constructor() { super('Not found') } }
export class TemplateInstanceConflict extends Error { constructor() { super('Template instance conflict') } }
export class TemplateAssetUnavailable extends Error { constructor() { super('Selected media is unavailable in this workspace') } }

export type TemplateSnapshot = { family: TemplateFamilyV1; design: TemplateDesignV1 }
export type TemplateAuthoringState = Omit<TemplateChoices, 'instanceId'>
export type PublishedTemplateProject = {
  instanceId: string
  projectId: string
  clipId: string
  authoringVersion: number
  editsSaveVersion: number
  status: string
}

function digest(...parts: string[]): string {
  return createHash('sha256').update(parts.map((p) => String(p.length) + ':' + p).join('|')).digest('hex')
}
function idsFor(workspaceId: string, idempotencyKey: string) {
  const h = digest('real-video-template-v1', workspaceId, idempotencyKey).slice(0, 32)
  const uploadId = 'upl_tpl_' + h
  return {
    instanceId: 'vti_' + h,
    uploadId,
    projectId: 'proj_tpl_' + h,
    clipId: 'clip_fv_' + uploadId,
    jobId: 'job_tpl_' + h,
  }
}
function stableJson(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(v as Record<string, unknown>).sort())
        out[key] = sort((v as Record<string, unknown>)[key])
      return out
    }
    return v
  }
  return JSON.stringify(sort(value))
}
function definitionHash(snapshot: TemplateSnapshot): string {
  return digest(stableJson(snapshot))
}
function parseTemplateMeta(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const meta = (raw as Record<string, unknown>).videoTemplate
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta as Record<string, unknown> : null
}
function resultFromRows(
  instanceId: string,
  project: { id: string; status: string },
  clip: { id: string; editsSaveVersion: number; aiMeta: unknown },
): PublishedTemplateProject {
  const meta = parseTemplateMeta(clip.aiMeta)
  return {
    instanceId,
    projectId: project.id,
    clipId: clip.id,
    authoringVersion: Number(meta?.authoringVersion ?? 0),
    editsSaveVersion: clip.editsSaveVersion,
    status: project.status,
  }
}
function mimeMatches(kind: TemplateAsset['kind'], mime: string): boolean {
  return kind === 'image'
    ? mime.startsWith('image/')
    : kind === 'video'
      ? mime.startsWith('video/')
      : mime.startsWith('audio/')
}
async function loadAndValidateAssets(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  family: TemplateFamilyV1,
  design: TemplateDesignV1,
  choices: TemplateAuthoringState,
) {
  if (!choices || typeof choices !== 'object' || !choices.media ||
      typeof choices.media !== 'object' || Array.isArray(choices.media))
    throw new Error('Invalid template assignments')
  const slots = new Map(family.slots.map((s) => [s.id, s]))
  if (Object.keys(choices.media).length !== family.slots.length)
    throw new Error('Every template slot requires media')
  const selected: Array<{ asset: TemplateAsset; minimumFrames: number }> = []
  for (const [slotId, asset] of Object.entries(choices.media)) {
    const slot = slots.get(slotId)
    if (!slot || !asset || typeof asset !== 'object' || !ID_RE.test(asset.id))
      throw new TemplateAssetUnavailable()
    if (slot.media !== 'either' && slot.media !== asset.kind) throw new TemplateAssetUnavailable()
    if (asset.kind !== 'image' && asset.kind !== 'video') throw new TemplateAssetUnavailable()
    const handles = slot.handles ?? { headFrames: 0, tailFrames: 0 }
    const minimumFrames = slot.playback
      ? Math.ceil(playbackSourceBounds(
          compileTemplatePlayback(slot.playback, slot.durationFrames), slot.sourceInFrame ?? 0,
        ).maxFrame + 1 + handles.tailFrames)
      : (slot.sourceInFrame ?? 0) + Math.ceil(slot.durationFrames * (slot.speed ?? 1)) + handles.tailFrames
    selected.push({ asset, minimumFrames })
  }
  if (choices.music) {
    if (design.musicPolicy !== 'licensed-only' || choices.music.kind !== 'audio')
      throw new TemplateAssetUnavailable()
    selected.push({ asset: choices.music, minimumFrames: 1 })
  }
  const ids = [...new Set(selected.map((x) => x.asset.id))]
  const rows = await tx.clipUpload.findMany({
    where: { workspaceId, status: 'COMPLETE', id: { in: ids } },
    select: { id: true, mime: true, durationMs: true, width: true, height: true },
  })
  if (rows.length !== ids.length) throw new TemplateAssetUnavailable()
  const byId = new Map(rows.map((row) => [row.id, row]))
  for (const { asset, minimumFrames } of selected) {
    const row = byId.get(asset.id)
    if (!row || !mimeMatches(asset.kind, row.mime)) throw new TemplateAssetUnavailable()
    if (asset.kind !== 'image') {
      const needMs = Math.ceil(minimumFrames * 1000 / 30)
      if (!row.durationMs || row.durationMs < needMs ||
          !asset.durationFrames || asset.durationFrames < minimumFrames)
        throw new TemplateAssetUnavailable()
    }
  }
  return byId
}

/**
 * Atomically publishes a NEW blank-carrier project + preseeded clip.
 * The existing preseeded full-video worker creates only the neutral carrier and enriches this
 * exact clip; source segments, text, music and transitions stay editable ClipEditsV2 data.
 */
export async function publishTemplateProject(
  workspaceId: string,
  idempotencyKey: string,
  familyRaw: unknown,
  designRaw: unknown,
  choicesRaw: TemplateAuthoringState,
  title?: string,
): Promise<PublishedTemplateProject> {
  if (!workspaceId || !KEY_RE.test(idempotencyKey)) throw new Error('Invalid template creation key')
  const family = validateTemplateFamily(familyRaw)
  const design = validateTemplateDesign(designRaw, family)
  const ids = idsFor(workspaceId, idempotencyKey)
  const snapshot = { family, design }
  const defHash = definitionHash(snapshot)
  const requestHash = digest(stableJson({ snapshot, choices: choicesRaw }))
  const durationMs = Math.round(family.totalFrames * 1000 / 30)
  const prisma = getPrisma()

  const existing = await prisma.clipProject.findFirst({
    where: { id: ids.projectId, workspaceId, deletedAt: null },
    select: {
      id: true,
      status: true,
      clips: {
        where: { id: ids.clipId, deletedAt: null },
        select: { id: true, editsSaveVersion: true, aiMeta: true },
      },
    },
  })
  if (existing?.clips[0]) {
    const meta = parseTemplateMeta(existing.clips[0].aiMeta)
    if (meta?.definitionHash !== defHash || meta?.requestHash !== requestHash || meta?.instanceId !== ids.instanceId)
      throw new TemplateInstanceConflict()
    return resultFromRows(ids.instanceId, existing, existing.clips[0])
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const assetRows = await loadAndValidateAssets(tx, workspaceId, family, design, choicesRaw)
      const selectedAspect = choicesRaw.aspect ?? family.aspects[0]!
      if (!family.aspects.includes(selectedAspect)) throw new Error('Selected template aspect is not authored by this family')
      const settings = clipProjectSettingsSchema.parse({
        ...defaultClipSettings(),
        byo: true,
        fullVideo: true,
        blank: true,
        aspectRatio: selectedAspect,
        rangeStartMs: 0,
        rangeEndMs: durationMs,
      })
      const base = defaultEdits({ clipStartMs: 0, clipEndMs: durationMs })
      const compiled = compileTemplate(
        family,
        design,
        { instanceId: ids.instanceId, ...choicesRaw },
        {
          durationFrames: family.totalFrames,
          edits: {
            ...base,
            trim: { in: 0, out: durationMs },
            layout: { ...base.layout, mode: 'full_frame' },
            aspectRatio: selectedAspect,
            captions: { ...base.captions, enabled: false },
          },
        },
      )
      const aiMeta = {
        byo: true,
        fullVideo: true,
        blank: true,
        videoTemplate: {
          v: 1,
          instanceId: ids.instanceId,
          idempotencyKey,
          definitionHash: defHash,
          requestHash,
          snapshot,
          authoringState: structuredClone(choicesRaw),
          authoringVersion: 0,
          studioEditsSaveVersion: 0,
          slotToItemIds: compiled.slotToItemIds,
        },
      }

      await tx.clipUpload.create({
        data: {
          id: ids.uploadId,
          workspaceId,
          key: uploadSourceKey(workspaceId, ids.uploadId, 'mp4'),
          filename: 'Template carrier.mp4',
          bytes: BigInt(0),
          mime: 'video/mp4',
          status: 'PENDING',
          storageDriver: storageDriverName(),
          kind: 'source',
        },
      })
      const existingDraft = await tx.clipProject.findFirst({
        where: { id: ids.projectId, workspaceId, deletedAt: null, sourceKind: 'video_template_draft', status: 'DRAFT' },
        select: { id: true, settings: true },
      })
      // An unfilled studio draft is already a workspace-owned NEW project.
      // Publish that same ID; never create a duplicate or mutate an unrelated clip.
      const preserved = existingDraft?.settings && typeof existingDraft.settings === 'object' &&
        !Array.isArray(existingDraft.settings) ? existingDraft.settings as Record<string, unknown> : {}
      const projectData = {
        workspaceId,
        title: title?.trim().slice(0, 200) || family.title,
        uploadId: ids.uploadId,
        settings: toPrismaJson({ ...settings,
          ...(preserved.videoTemplateDraft ? { videoTemplateDraft: preserved.videoTemplateDraft } : {}),
          ...(preserved.videoTemplateOriginal ? { videoTemplateOriginal: preserved.videoTemplateOriginal } : {}) }),
        rangeStartMs: 0,
        rangeEndMs: durationMs,
        status: 'QUEUED' as const,
        stage: 'queued',
        progress: 0,
        transcriptWords: toPrismaJson([]),
        sourceKind: 'upload',
      }
      const project = existingDraft
        ? await tx.clipProject.update({ where: { id: ids.projectId }, data: projectData })
        : await tx.clipProject.create({ data: { id: ids.projectId, ...projectData } })
      const uniqueAssets = new Map<string, TemplateAsset>()
      for (const asset of Object.values(choicesRaw.media)) uniqueAssets.set(asset.id, asset)
      if (choicesRaw.music) uniqueAssets.set(choicesRaw.music.id, choicesRaw.music)
      for (const asset of uniqueAssets.values()) {
        const row = assetRows.get(asset.id)!
        await tx.clipProjectMedia.create({
          data: {
            id: 'pm_tpl_' + digest(ids.projectId, asset.id).slice(0, 28),
            projectId: ids.projectId,
            workspaceId,
            uploadId: asset.id,
            mediaType: asset.kind,
            label: asset.id,
            durationMs: row.durationMs,
            width: row.width,
            height: row.height,
          },
        })
      }

      const clip = await tx.clip.create({
        data: {
          id: ids.clipId,
          projectId: ids.projectId,
          workspaceId,
          title: project.title,
          reason: 'video_template',
          startMs: 0,
          endMs: durationMs,
          score: 0,
          scores: toPrismaJson({}),
          edits: toPrismaJson(compiled.edits),
          editsSaveVersion: 0,
          aiMeta: toPrismaJson(aiMeta),
        },
      })
      await tx.clipJob.create({
        data: {
          id: ids.jobId,
          projectId: ids.projectId,
          clipId: ids.clipId,
          type: 'PROCESS_PROJECT',
          status: 'QUEUED',
          maxAttempts: 3,
          payload: toPrismaJson(buildProcessProjectJobPayload(settings, {
            blankMs: durationMs,
            templateCarrier: true,
            templateCarrierFrames: family.totalFrames,
            preseededFullVideo: true,
          })),
        },
      })
      return resultFromRows(ids.instanceId, project, clip)
    }, { isolationLevel: 'Serializable' })
  } catch (error) {
    const won = await prisma.clipProject.findFirst({
      where: { id: ids.projectId, workspaceId, deletedAt: null },
      select: {
        id: true,
        status: true,
        clips: {
          where: { id: ids.clipId, deletedAt: null },
          select: { id: true, editsSaveVersion: true, aiMeta: true },
        },
      },
    })
    if (won?.clips[0]) {
      const meta = parseTemplateMeta(won.clips[0].aiMeta)
      if (meta?.definitionHash === defHash && meta?.requestHash === requestHash && meta?.instanceId === ids.instanceId)
        return resultFromRows(ids.instanceId, won, won.clips[0])
    }
    throw error
  }
}

/** Save authoring choices only. Compact/Timeline edits remain authoritative and are never regenerated. */
export async function saveTemplateAuthoringState(
  workspaceId: string,
  clipId: string,
  expectedVersion: number,
  state: TemplateAuthoringState,
): Promise<{ authoringVersion: number }> {
  if (!workspaceId || !ID_RE.test(clipId) ||
      !Number.isInteger(expectedVersion) || expectedVersion < 0)
    throw new TemplateInstanceNotFound()
  const prisma = getPrisma()
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.clip.findFirst({
        where: { id: clipId, workspaceId, deletedAt: null },
        select: { id: true, aiMeta: true },
      })
      if (!row) throw new TemplateInstanceNotFound()
      const root = row.aiMeta && typeof row.aiMeta === 'object' && !Array.isArray(row.aiMeta)
        ? structuredClone(row.aiMeta as Record<string, unknown>)
        : {}
      const meta = parseTemplateMeta(root)
      if (!meta) throw new TemplateInstanceNotFound()
      const version = Number(meta.authoringVersion ?? 0)
      if (version !== expectedVersion) throw new TemplateInstanceConflict()
      const snapshotRaw = meta.snapshot
      if (!snapshotRaw || typeof snapshotRaw !== 'object' || Array.isArray(snapshotRaw))
        throw new TemplateInstanceConflict()
      const snap = snapshotRaw as Record<string, unknown>
      const family = validateTemplateFamily(snap.family)
      const design = validateTemplateDesign(snap.design, family)
      await loadAndValidateAssets(tx, workspaceId, family, design, state)
      meta.authoringState = structuredClone(state)
      meta.authoringVersion = version + 1
      root.videoTemplate = meta
      await tx.clip.update({ where: { id: clipId }, data: { aiMeta: toPrismaJson(root) } })
      return { authoringVersion: version + 1 }
    }, { isolationLevel: 'Serializable' })
  } catch (error) {
    if (error instanceof TemplateInstanceNotFound || error instanceof TemplateInstanceConflict ||
        error instanceof TemplateAssetUnavailable) throw error
    const code = typeof error === 'object' && error ? String((error as { code?: unknown }).code ?? '') : ''
    if (code === 'P2034') throw new TemplateInstanceConflict()
    throw error
  }
}

/** Cancel pending carrier work without deleting user media or modifying the timeline. */
export async function cancelTemplateProject(workspaceId: string, projectId: string): Promise<void> {
  if (!workspaceId || !ID_RE.test(projectId)) throw new TemplateInstanceNotFound()
  const prisma = getPrisma()
  const found = await prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: { id: true, status: true },
  })
  if (!found) throw new TemplateInstanceNotFound()
  if (found.status === 'CANCELED') return
  if (found.status === 'READY') throw new TemplateInstanceConflict()
  await prisma.$transaction([
    prisma.clipProject.update({
      where: { id: projectId },
      data: { status: 'CANCELED', stage: 'canceled', error: 'canceled' },
    }),
    prisma.clipJob.updateMany({
      where: { projectId, status: 'QUEUED' },
      data: { status: 'FAILED', error: 'canceled', finishedAt: new Date() },
    }),
  ])
}
