import type { ClipBounds, ClipEditsV2 } from '@/lib/clips/edits'
import { mergeEditsPatch, normalizeEdits } from '@/lib/clips/edits'
import { nextStoredClientSaveSeq, shouldRejectStaleClientSave } from '@/lib/clips/editor-save-order'
import { insertOriginalClipEditSnapshot } from '@/lib/server/clips/clip-edit-versions'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

export type EditorSaveClipRow = {
  id: string
  title: string
  updatedAt: Date
  edits: unknown
  editsSaveVersion: number
  aiMeta: unknown
}

export type PersistEditorSaveInput = {
  editsPatch: Record<string, unknown>
  clientSaveSeq?: number
  clientLocalRevision?: number
  /** Test hook: first loop iteration reads this snapshot instead of the DB (simulates in-flight stale read). */
  preRead?: EditorSaveClipRow
}

export type PersistEditorSaveResult =
  | {
      applied: true
      mergedEdits: ClipEditsV2
      id: string
      title: string
      updatedAt: Date
      editsSaveVersion: number
    }
  | {
      applied: false
      storedSeq: number
      serverEdits: ClipEditsV2
      id: string
      title: string
      updatedAt: Date
      editsSaveVersion: number
    }

type PersistPrisma = {
  clip: {
    findUnique: (args: {
      where: { id: string }
      select: {
        id: true
        title: true
        updatedAt: true
        edits: true
        editsSaveVersion: true
        aiMeta: true
      }
    }) => Promise<EditorSaveClipRow | null>
    updateMany: (args: {
      where: { id: string; editsSaveVersion: number }
      data: {
        edits: ReturnType<typeof toPrismaJson>
        editsSaveVersion: { increment: number }
        aiMeta: ReturnType<typeof toPrismaJson>
      }
    }) => Promise<{ count: number }>
  }
}

const clipSelect = {
  id: true,
  title: true,
  updatedAt: true,
  edits: true,
  editsSaveVersion: true,
  aiMeta: true,
} as const

async function loadClip(prisma: PersistPrisma, clipId: string): Promise<EditorSaveClipRow | null> {
  return prisma.clip.findUnique({ where: { id: clipId }, select: clipSelect })
}

/** TC4fix3: atomic seq + version CAS so stale overlapping PATCHes cannot win. */
export async function persistEditorSave(
  prisma: PersistPrisma,
  clipId: string,
  input: PersistEditorSaveInput,
  bounds: ClipBounds,
  options?: { workspaceId?: string },
): Promise<PersistEditorSaveResult | null> {
  let clip: EditorSaveClipRow | null = input.preRead ?? (await loadClip(prisma, clipId))
  if (!clip) return null

  let snapshotDone = clip.editsSaveVersion !== 0

  for (let attempt = 0; attempt < 3; attempt++) {
    if (!clip) return null
    const serverEdits = normalizeEdits(clip.edits, bounds)
    const mergedEdits = mergeEditsPatch(serverEdits, input.editsPatch, bounds)
    const meta = (clip.aiMeta && typeof clip.aiMeta === 'object' ? clip.aiMeta : {}) as Record<string, unknown>
    const storedSeq = typeof meta.__editorSaveSeq === 'number' ? meta.__editorSaveSeq : 0
    const incomingSeq = input.clientSaveSeq ?? 0

    if (incomingSeq > 0 && shouldRejectStaleClientSave(incomingSeq, storedSeq)) {
      return {
        applied: false,
        storedSeq,
        serverEdits,
        id: clip.id,
        title: clip.title,
        updatedAt: clip.updatedAt,
        editsSaveVersion: clip.editsSaveVersion,
      }
    }

    const nextMeta: Record<string, unknown> = { ...meta }
    if (incomingSeq > 0) {
      nextMeta.__editorSaveSeq = nextStoredClientSaveSeq(incomingSeq, storedSeq)
      if (typeof input.clientLocalRevision === 'number') {
        nextMeta.__editorLocalRevision = input.clientLocalRevision
      }
    }

    if (!snapshotDone && clip.editsSaveVersion === 0 && options?.workspaceId) {
      await insertOriginalClipEditSnapshot(
        prisma as Parameters<typeof insertOriginalClipEditSnapshot>[0],
        { id: clip.id, workspaceId: options.workspaceId, edits: clip.edits },
      )
      snapshotDone = true
      clip = await loadClip(prisma, clipId)
      continue
    }

    const versionRead = clip.editsSaveVersion
    const updated = await prisma.clip.updateMany({
      where: { id: clipId, editsSaveVersion: versionRead },
      data: {
        edits: toPrismaJson(mergedEdits),
        editsSaveVersion: { increment: 1 },
        aiMeta: toPrismaJson(nextMeta),
      },
    })

    if (updated.count === 1) {
      const fresh = await loadClip(prisma, clipId)
      return {
        applied: true,
        mergedEdits,
        id: clip.id,
        title: clip.title,
        updatedAt: fresh?.updatedAt ?? clip.updatedAt,
        editsSaveVersion: versionRead + 1,
      }
    }

    clip = await loadClip(prisma, clipId)
  }

  return null
}
