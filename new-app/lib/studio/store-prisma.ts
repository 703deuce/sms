import { getPrisma } from '../server/db'
import type { StudioJobRecord, StudioStore } from './store'

function mapJob(row: {
  id: string
  workspaceId: string
  userId: string
  projectId: string | null
  status: string
  modelId: string
  mode: string
  prompt: string
  aspect: string | null
  durationSec: number | null
  resolution: string | null
  creditEstimate: number
  provider: string
  providerTaskId: string | null
  providerApi: string | null
  referenceAssetId: string | null
  startFrameAssetId: string | null
  endFrameAssetId: string | null
  outputStorageKey: string | null
  outputStorageDriver: string | null
  outputContentType: string | null
  outputWidth: number | null
  outputHeight: number | null
  outputDurationSec: number | null
  outputKind: string | null
  outputUploadId: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  completedAt: Date | null
}): StudioJobRecord {
  return {
    ...row,
    status: row.status as StudioJobRecord['status'],
    mode: row.mode as StudioJobRecord['mode'],
    providerApi: row.providerApi === 'veo' ? 'veo' : row.providerApi === 'jobs' ? 'jobs' : null,
    outputKind: row.outputKind === 'video' || row.outputKind === 'image' ? row.outputKind : null,
  }
}

export function createPrismaStudioStore(): StudioStore {
  const prisma = getPrisma()
  return {
    async createJob(row) {
      const created = await prisma.aiStudioJob.create({
        data: {
          id: row.id,
          workspaceId: row.workspaceId,
          userId: row.userId,
          projectId: row.projectId,
          status: row.status,
          modelId: row.modelId,
          mode: row.mode,
          prompt: row.prompt,
          aspect: row.aspect,
          durationSec: row.durationSec,
          resolution: row.resolution,
          creditEstimate: row.creditEstimate,
          provider: row.provider,
          providerTaskId: row.providerTaskId,
          providerApi: row.providerApi,
          referenceAssetId: row.referenceAssetId,
          startFrameAssetId: row.startFrameAssetId,
          endFrameAssetId: row.endFrameAssetId,
          outputStorageKey: row.outputStorageKey,
          outputStorageDriver: row.outputStorageDriver,
          outputContentType: row.outputContentType,
          outputWidth: row.outputWidth,
          outputHeight: row.outputHeight,
          outputDurationSec: row.outputDurationSec,
          outputKind: row.outputKind,
          outputUploadId: row.outputUploadId,
          errorCode: row.errorCode,
          errorMessage: row.errorMessage,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
        },
      })
      return mapJob(created)
    },
    async getJob(workspaceId, id) {
      const row = await prisma.aiStudioJob.findFirst({ where: { id, workspaceId } })
      return row ? mapJob(row) : null
    },
    async getJobById(id) {
      const row = await prisma.aiStudioJob.findUnique({ where: { id } })
      return row ? mapJob(row) : null
    },
    async listJobs(workspaceId, query) {
      const where: Record<string, unknown> = { workspaceId }
      if (query.status) where.status = query.status
      if (query.modelId) where.modelId = query.modelId
      if (query.projectId) where.projectId = query.projectId
      if (query.cursor) {
        const cursor = await prisma.aiStudioJob.findFirst({ where: { id: query.cursor, workspaceId } })
        if (cursor) {
          where.OR = [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ]
        }
      }
      const rows = await prisma.aiStudioJob.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      })
      const nextCursor = rows.length > query.limit ? rows[query.limit - 1].id : null
      return { jobs: rows.slice(0, query.limit).map(mapJob), nextCursor }
    },
    async updateJob(id, patch) {
      const data: Record<string, unknown> = {}
      const keys: Array<keyof StudioJobRecord> = [
        'status',
        'providerTaskId',
        'providerApi',
        'outputStorageKey',
        'outputStorageDriver',
        'outputContentType',
        'outputWidth',
        'outputHeight',
        'outputDurationSec',
        'outputKind',
        'outputUploadId',
        'errorCode',
        'errorMessage',
        'startedAt',
        'completedAt',
        'projectId',
      ]
      for (const key of keys) {
        if (key in patch) data[key] = patch[key]
      }
      const row = await prisma.aiStudioJob.update({ where: { id }, data })
      return mapJob(row)
    },
    async countActive(workspaceId, userId) {
      return prisma.aiStudioJob.count({
        where: { workspaceId, userId, status: { in: ['queued', 'running'] } },
      })
    },
    async createAsset(row) {
      const created = await prisma.aiStudioAsset.create({
        data: {
          id: row.id,
          workspaceId: row.workspaceId,
          userId: row.userId,
          storageKey: row.storageKey,
          storageDriver: row.storageDriver,
          contentType: row.contentType,
          bytes: row.bytes,
          kind: row.kind,
        },
      })
      return created
    },
    async getAsset(workspaceId, id) {
      return prisma.aiStudioAsset.findFirst({ where: { id, workspaceId } })
    },
    async projectExists(workspaceId, projectId) {
      const row = await prisma.clipProject.findFirst({
        where: { id: projectId, workspaceId, deletedAt: null },
        select: { id: true },
      })
      return Boolean(row)
    },
    async clipInProject(workspaceId, projectId, clipId) {
      const row = await prisma.clip.findFirst({
        where: { id: clipId, projectId, workspaceId, deletedAt: null },
        select: { id: true },
      })
      return Boolean(row)
    },
  }
}
