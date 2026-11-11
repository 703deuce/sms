import 'server-only'

import { Prisma } from '@prisma/client'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import {
  validateTemplateFamily,
  validateTemplateDesign,
  type TemplateAsset,
  type TemplateChoices,
  type TemplateFamilyV1,
  type TemplateDesignV1,
} from '@/lib/clips/real-video-templates/sequence-contract'

/**
 * Fail-closed, isolated B3 authoring store; NOT a project publishing path.
 * No public route calls these functions until preview/export parity exists.
 * ClipEditsV2 remains authoritative after editing; saving authoring never
 * generates or replaces a timeline, and no template job is enqueued here.
 */
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,120}$/
const INSTANCE_ID = /^[A-Za-z0-9_-]{1,120}$/
export class TemplateInstanceNotFound extends Error {
  constructor() { super('Not found') }
}
export class TemplateInstanceConflict extends Error {
  constructor() { super('Template authoring revision conflict') }
}
export class TemplateAssetUnavailable extends Error {
  constructor() { super('Selected media is unavailable in this workspace') }
}

export type TemplateSnapshot = {
  family: TemplateFamilyV1
  design: TemplateDesignV1
}

export async function createTemplateAuthoringDraft(
  workspaceId: string,
  idempotencyKey: string,
  familyRaw: unknown,
  designRaw: unknown,
) {
  if (!workspaceId || !IDEMPOTENCY_KEY.test(idempotencyKey)) throw new Error('Invalid template creation key')
  const family = validateTemplateFamily(familyRaw)
  const design = validateTemplateDesign(designRaw, family)
  const prisma = getPrisma()
  const where = { workspaceId_idempotencyKey: { workspaceId, idempotencyKey } }
  const existing = await prisma.clipVideoTemplateInstance.findUnique({ where })
  if (existing) {
    // A retry with the same key MUST return the original snapshot, not silently
    // refresh the definition or re-create a project after catalog updates.
    if (existing.familyId !== family.familyId || existing.familyRevision !== family.revision ||
      existing.designId !== design.designId || existing.designRevision !== design.revision)
      throw new TemplateInstanceConflict()
    return existing
  }
  try {
    return await prisma.clipVideoTemplateInstance.create({
      data: {
        id: createId('vti'),
        workspaceId,
        idempotencyKey,
        familyId: family.familyId,
        familyRevision: family.revision,
        designId: design.designId,
        designRevision: design.revision,
        snapshot: toPrismaJson({ family, design }),
        authoringState: toPrismaJson({ media: {}, texts: {} }),
        status: 'DRAFT',
      },
    })
  } catch (err) {
    // Atomic unique index makes concurrent retries idempotent.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err
    const winning = await prisma.clipVideoTemplateInstance.findUnique({ where })
    if (!winning) throw err
    if (winning.familyId !== family.familyId || winning.familyRevision !== family.revision ||
      winning.designId !== design.designId || winning.designRevision !== design.revision)
      throw new TemplateInstanceConflict()
    return winning
  }
}

function parseSnapshot(raw: unknown): TemplateSnapshot {
  if (!raw || typeof raw !== 'object') throw new Error('Corrupt template snapshot')
  const o = raw as Record<string, unknown>
  const family = validateTemplateFamily(o.family)
  const design = validateTemplateDesign(o.design, family)
  return { family, design }
}

function imageOrVideo(kind: TemplateAsset['kind'], mime: string): boolean {
  return kind === 'image'
    ? mime.startsWith('image/')
    : kind === 'video'
      ? mime.startsWith('video/')
      : mime.startsWith('audio/')
}

/** Server-validated workspace ownership. Never trust asserted license metadata as proof. */
async function checkAssignedWorkspaceMedia(
  workspaceId: string, snapshot: TemplateSnapshot, choices: TemplateChoices,
) {
  if (!choices || typeof choices !== 'object' || !choices.media ||
    typeof choices.media !== 'object' || Array.isArray(choices.media))
    throw new Error('Invalid template assignments')
  const bySlot = new Map(snapshot.family.slots.map(s => [s.id, s]))
  const chosen: TemplateAsset[] = []
  for (const [slotId, asset] of Object.entries(choices.media)) {
    const slot = bySlot.get(slotId)
    if (!slot) throw new Error('Unknown media slot')
    if (!asset || typeof asset !== 'object' || !INSTANCE_ID.test(asset.id))
      throw new Error('Invalid media assignment')
    if (slot.media !== 'either' && slot.media !== asset.kind) throw new Error('Invalid slot media type')
    if (asset.kind !== 'image' && asset.kind !== 'video') throw new Error('Invalid slot media type')
    if (!asset.license || asset.license.provenance !== 'user-owned')
      throw new TemplateAssetUnavailable()
    chosen.push(asset)
  }
  if (choices.music) {
    if (snapshot.design.musicPolicy !== 'licensed-only') throw new Error('Music not permitted')
    if (!choices.music.license || choices.music.license.provenance !== 'user-owned')
      throw new TemplateAssetUnavailable()
    chosen.push(choices.music)
  }
  const ids = [...new Set(chosen.map(x => x.id))]
  if (!ids.length) return
  const uploads = await getPrisma().clipUpload.findMany({
    where: { workspaceId, status: 'COMPLETE', id: { in: ids } },
    select: { id: true, mime: true, durationMs: true },
  })
  if (uploads.length !== ids.length) throw new TemplateAssetUnavailable()
  const byId = new Map(uploads.map(x => [x.id, x]))
  for (const choice of chosen) {
    const row = byId.get(choice.id)
    if (!row || !imageOrVideo(choice.kind, row.mime)) throw new TemplateAssetUnavailable()
    if (choice.kind !== 'image') {
      if (!row.durationMs || row.durationMs < Math.round((choice.durationFrames ?? 0) * 1000 / 30))
        throw new TemplateAssetUnavailable()
    }
  }
}

/** Optimistic authoring CAS. Never touches edits/editsSaveVersion or re-generates a timeline. */
export async function saveTemplateAuthoringDraft(
  workspaceId: string,
  instanceId: string,
  expectedVersion: number,
  choices: TemplateChoices,
) {
  if (!workspaceId || !INSTANCE_ID.test(instanceId) || !Number.isInteger(expectedVersion) || expectedVersion < 0)
    throw new TemplateInstanceNotFound()
  const prisma = getPrisma()
  const row = await prisma.clipVideoTemplateInstance.findFirst({
    where: { id: instanceId, workspaceId, status: 'DRAFT' },
  })
  if (!row) throw new TemplateInstanceNotFound()
  if (choices.instanceId !== row.id) throw new Error('Instance ID mismatch')
  const snapshot = parseSnapshot(row.snapshot)
  await checkAssignedWorkspaceMedia(workspaceId, snapshot, choices)
  const saved = await prisma.clipVideoTemplateInstance.updateMany({
    where: { id: row.id, workspaceId, status: 'DRAFT', authoringVersion: expectedVersion },
    data: { authoringState: toPrismaJson(choices), authoringVersion: { increment: 1 } },
  })
  if (saved.count !== 1) throw new TemplateInstanceConflict()
  return prisma.clipVideoTemplateInstance.findFirstOrThrow({ where: { id: row.id, workspaceId } })
}

/** A canceled draft never schedules render work and cannot be resurrected by stale CAS. */
export async function cancelTemplateAuthoringDraft(workspaceId: string, instanceId: string) {
  if (!workspaceId || !INSTANCE_ID.test(instanceId)) throw new TemplateInstanceNotFound()
  const prisma = getPrisma()
  const found = await prisma.clipVideoTemplateInstance.findFirst({ where: { id: instanceId, workspaceId } })
  if (!found) throw new TemplateInstanceNotFound()
  if (found.status === 'CANCELED') return
  if (found.status !== 'DRAFT') throw new TemplateInstanceConflict()
  const changed = await prisma.clipVideoTemplateInstance.updateMany({
    where: { id: instanceId, workspaceId, status: 'DRAFT' },
    data: { status: 'CANCELED' },
  })
  if (changed.count !== 1) throw new TemplateInstanceConflict()
}
