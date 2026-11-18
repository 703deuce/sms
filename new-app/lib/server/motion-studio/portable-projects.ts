import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'
import { coordinatorEnabled } from '@/lib/server/motion-studio/coordinator'
import { coordinateSceneRenders } from '@/lib/server/motion-studio/render-coordinator'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { adaptProducerProject, type ProducerAssetRecord, type ProducerSceneBundle } from '@/lib/motion-studio/producer-project-adapter'
import {
  validatePortableManifest, validateScenePropertyPatch, validateThemePatch,
  type MsPortableManifest,
} from '@/lib/motion-studio/portable-contract'

const db = () => getPrisma()
const bad = (msg: string, code = 'INVALID', status = 400): never => { throw new MotionStudioError(code, msg, status) }
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')

async function requireProject(workspaceId: string, projectId: string) {
  const project = await db().motionStudioProject.findFirst({ where: { id: projectId, workspaceId } })
  if (!project) bad('Motion Studio project not found.', 'NOT_FOUND', 404)
  return project!
}

/** Producer submits a manifest only after referenced files have been registered. */
export async function publishPortableVersion(workspaceId: string, projectId: string, raw: unknown) {
  await requireProject(workspaceId, projectId)
  const input = obj(raw)
  let manifest: MsPortableManifest
  try {
    // Native producer payload: preserve the exact transovo.motion-project/1
    // document and map only the verified scene metadata into the older editor.
    // The producer must supply extracted scene bundle metadata and registered
    // asset records; absence is an error, never an implicit flattened scene.
    manifest = input.document !== undefined
      ? adaptProducerProject({
          document: input.document,
          assets: input.assets as ProducerAssetRecord[],
          bundles: input.bundles as ProducerSceneBundle[],
        })
      : validatePortableManifest(input.manifest)
  }
  catch (error) { return bad(error instanceof Error ? error.message : 'Invalid portable manifest') }
  if (manifest.projectId !== projectId) bad('Portable manifest belongs to another project')
  const assets = manifest.assets.map(x => x.id)
  const registered = await db().studioAsset.findMany({ where: {
    projectId, workspaceId, id: { in: assets }, status: 'ready',
  }, select: { id: true, kind:true, provenanceLog:true } })
  if (registered.length !== assets.length)
    bad('Every portable asset must be registered and ready in this project.', 'CONFLICT', 409)
  if (input.document !== undefined) {
    // A bundle or font is executable/render-critical source; never accept an
    // unverified digest that a producer merely declared in a JSON document.
    const byId=new Map(registered.map(item=>[item.id,item]))
    for(const source of manifest.assets){
      if(!['bundle','font','image'].includes(source.kind))continue
      const stored=byId.get(source.id)
      const provenance=obj(stored?.provenanceLog)
      if(provenance.verifiedSha256!==true ||
          String(provenance.sha256||'').toLowerCase()!==source.sha256.toLowerCase())
        bad('Native scene source must be uploaded with a verified SHA-256 before publication.', 'CONFLICT', 409)
    }
  }
  // Preserve producer-native theme and user-edit patch exactly on first import.
  // Explicit Transovo overrides are only accepted on the portable path.
  const nativeDoc = input.document !== undefined ? obj(input.document) : null
  const theme = nativeDoc ? obj(nativeDoc.theme) : obj(input.theme)
  const overrides = nativeDoc ? obj(nativeDoc.overrides) : obj(input.overrides)
  const manifestHash = digest(manifest)
  const sourceJobId = typeof input.sourceJobId === 'string' ? input.sourceJobId : null
  if (sourceJobId) {
    const source = await db().motionStudioAgentJob.findFirst({
      where: { id: sourceJobId, workspaceId, projectId }, select: { id: true },
    })
    if (!source) bad('Production job does not belong to this project')
  }
  return db().$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "MotionStudioProject" WHERE "id" = ${projectId} FOR UPDATE`
    const last = await tx.motionStudioPortableVersion.findFirst({
      where: { projectId }, orderBy: { revision: 'desc' },
    })
    const revision = (last?.revision ?? -1) + 1
    return tx.motionStudioPortableVersion.create({ data: {
      id: 'mspv_' + randomUUID(), projectId, workspaceId, revision,
      parentId: last?.id ?? null, sourceJobId,
      status: 'committed', manifest: toPrismaJson(manifest),
      theme: toPrismaJson(theme), overrides: toPrismaJson(overrides),
      manifestHash, committedAt: new Date(),
    } })
  })
}

export async function getPortableProject(workspaceId: string, projectId: string, versionId?: string) {
  await requireProject(workspaceId, projectId)
  const version = await db().motionStudioPortableVersion.findFirst({
    where: { workspaceId, projectId, status: 'committed', ...(versionId ? { id: versionId } : {}) },
    orderBy: { revision: 'desc' },
  })
  const history = await db().motionStudioPortableVersion.findMany({
    where: { workspaceId, projectId, status: 'committed' },
    select: { id:true,revision:true,parentId:true,createdAt:true,sourceJobId:true },
    orderBy: { revision: 'desc' }, take:100,
  })
  if (!version) return { version: null, history }
  return { version: { ...version, manifest: version.manifest, theme: version.theme, overrides: version.overrides }, history }
}

/** Save a user edit atomically as a new immutable version. Never mutate source. */
export async function commitPortableEdit(workspaceId: string, projectId: string, raw: unknown) {
  await requireProject(workspaceId, projectId)
  const input = obj(raw)
  const baseVersionId = typeof input.baseVersionId === 'string' ? input.baseVersionId : ''
  const sceneId = typeof input.sceneId === 'string' ? input.sceneId : ''
  const themePatch = input.themePatch === undefined ? {} : validateThemePatch(input.themePatch)
  const hasScenePatch = input.elements !== undefined
  const version = await db().motionStudioPortableVersion.findFirst({
    where: { id: baseVersionId, projectId, workspaceId, status: 'committed' },
  })
  if (!version) bad('Project version not found.', 'NOT_FOUND', 404)
  const manifest = validatePortableManifest(version!.manifest)
  let validated: ReturnType<typeof validateScenePropertyPatch> | null = null
  try {
    if (hasScenePatch) validated = validateScenePropertyPatch(manifest, sceneId, input.elements, 'render')
  } catch (error) { bad(error instanceof Error ? error.message : 'Invalid scene edit') }
  if (!validated && !Object.keys(themePatch).length) bad('No changes were provided')
  return db().$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "MotionStudioProject" WHERE "id" = ${projectId} FOR UPDATE`
    const latest = await tx.motionStudioPortableVersion.findFirst({
      where: { projectId }, orderBy: { revision: 'desc' },
    })
    if (!latest || latest.id !== baseVersionId)
      bad('Project changed in another editor session. Reload before saving.', 'CONFLICT', 409)
    const prev = obj(latest.overrides)
    const oldScenes = obj(prev.scenes)
    const oldScene = obj(oldScenes[sceneId])
    const prevElements = obj(oldScene.elements)
    const mergedElements = { ...prevElements }
    for (const [elementId, values] of Object.entries(validated?.patch ?? {})) {
      const previous = obj(mergedElements[elementId])
      const next = { ...previous, ...values }
      for (const [key, val] of Object.entries(next)) if (val === null) delete next[key]
      mergedElements[elementId] = next
    }
    const nextOverrides = {
      ...prev, scenes: { ...oldScenes, ...(validated ? { [sceneId]: { ...oldScene, elements: mergedElements } } : {}) },
    }
    const previousTheme = obj(latest.theme)
    // Preserve producer-specific design metadata around theme tokens.
    // A color entry may be a raw hex or {value,label,designName}.
    const nextColors:Record<string,unknown>={...obj(previousTheme.colors)}
    for(const [key,value] of Object.entries(obj(themePatch.colors))){
      const previous=nextColors[key]
      if(value===null){delete nextColors[key];continue}
      nextColors[key]=previous && typeof previous==='object' && !Array.isArray(previous)
        ? {...obj(previous),value}:value
    }
    const nextTheme = {
      ...previousTheme,
      ...themePatch,
      colors: nextColors,
      fonts: { ...obj(previousTheme.fonts), ...obj(themePatch.fonts) },
    }
    const next = await tx.motionStudioPortableVersion.create({ data: {
      id: 'mspv_' + randomUUID(), projectId, workspaceId,
      revision: latest.revision + 1, parentId: latest.id, sourceJobId: latest.sourceJobId,
      status: 'committed', manifest: toPrismaJson(latest.manifest),
      manifestHash: latest.manifestHash, theme: toPrismaJson(nextTheme),
      overrides: toPrismaJson(nextOverrides), committedAt: new Date(),
    } })
    return { version: next, requiresRender: Boolean(validated?.requiresRender), affectedSceneIds:
      validated ? [sceneId] : manifest.scenes.map(s => s.id) }
  })
}

/** Restore an earlier immutable version by copying it into a new latest version. */
export async function restorePortableVersion(workspaceId:string,projectId:string,raw:unknown){
  await requireProject(workspaceId,projectId)
  const input=obj(raw)
  const baseVersionId=typeof input.baseVersionId==='string'?input.baseVersionId:''
  const restoreVersionId=typeof input.restoreVersionId==='string'?input.restoreVersionId:''
  if(!baseVersionId||!restoreVersionId)bad('Current and restored version IDs required')
  return db().$transaction(async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "MotionStudioProject" WHERE "id" = ${projectId} FOR UPDATE`
    const latest=await tx.motionStudioPortableVersion.findFirst({
      where:{projectId,workspaceId,status:'committed'},orderBy:{revision:'desc'},
    })
    if(!latest||latest.id!==baseVersionId)
      bad('Project version changed. Reload before restoring.','CONFLICT',409)
    const source=await tx.motionStudioPortableVersion.findFirst({
      where:{id:restoreVersionId,projectId,workspaceId,status:'committed'},
    })
    if(!source)bad('Version to restore not found.','NOT_FOUND',404)
    const version=await tx.motionStudioPortableVersion.create({data:{
      id:'mspv_'+randomUUID(),projectId,workspaceId,
      revision:latest.revision+1,parentId:latest.id,sourceJobId:source!.sourceJobId,
      status:'committed',manifest:toPrismaJson(source!.manifest),
      theme:toPrismaJson(source!.theme),overrides:toPrismaJson(source!.overrides),
      manifestHash:source!.manifestHash,committedAt:new Date(),
    }})
    return{version,restoredFrom:restoreVersionId}
  })
}

export async function requestSceneRender(workspaceId: string, projectId: string, raw: unknown) {
  const input = obj(raw)
  const versionId = String(input.versionId || '')
  const sceneId = String(input.sceneId || '')
  const idempotencyKey = String(input.idempotencyKey || '').slice(0, 120)
  if (!idempotencyKey) bad('Idempotency key required')
  const { version } = await getPortableProject(workspaceId, projectId, versionId)
  if (!version) bad('Project version not found.', 'NOT_FOUND', 404)
  const manifest = validatePortableManifest(version!.manifest)
  if (!manifest.scenes.some(s => s.id === sceneId)) bad('Scene not found')
  const patch = obj(input.patch)
  const valid = validateScenePropertyPatch(manifest, sceneId, patch)
  const where = { versionId_sceneId_idempotencyKey: { versionId, sceneId, idempotencyKey } }
  const existing = await db().motionStudioRenderRequest.findUnique({ where })
  if (existing) return existing
  try {
    const created = await db().motionStudioRenderRequest.create({ data: {
      id: 'msrr_' + randomUUID(), workspaceId, projectId, versionId, sceneId, idempotencyKey,
      patch: toPrismaJson(valid.patch), status: 'queued',
    } })
    if (coordinatorEnabled()) await coordinateSceneRenders(1)
    return created
  } catch (error) {
    const again = await db().motionStudioRenderRequest.findUnique({ where })
    if (again) return again
    throw error
  }
}
