import 'server-only'

import { getPrisma } from '@/lib/server/db'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

/** Patch a single edits sub-key without overwriting the full edits blob (SQL jsonb_set). */
export async function patchClipEditsJsonPath(
  clipId: string,
  path: string[],
  value: unknown,
): Promise<void> {
  if (!path.length) throw new Error('patchClipEditsJsonPath requires path')
  const prisma = getPrisma()
  const segments = path.map((p) => `{${p}}`).join(',')
  await prisma.$executeRawUnsafe(
    `
    UPDATE clips
    SET edits = jsonb_set(COALESCE(edits, '{}'::jsonb), $2::text[], $3::jsonb, true),
        "editsSaveVersion" = COALESCE("editsSaveVersion", 0) + 1,
        "updatedAt" = NOW()
    WHERE id = $1
    `,
    clipId,
    `{${path.join(',')}}`,
    JSON.stringify(value),
  )
}

export async function patchClipEditsJsonPathSafe(
  clipId: string,
  path: string[],
  value: unknown,
): Promise<void> {
  try {
    await patchClipEditsJsonPath(clipId, path, value)
  } catch {
    const prisma = getPrisma()
    const row = await prisma.clip.findUnique({ where: { id: clipId }, select: { edits: true } })
    const edits = (row?.edits && typeof row.edits === 'object' ? row.edits : {}) as Record<string, unknown>
    let cur: Record<string, unknown> = edits
    for (let i = 0; i < path.length - 1; i++) {
      const seg = path[i]
      const next = cur[seg]
      if (!next || typeof next !== 'object') cur[seg] = {}
      cur = cur[seg] as Record<string, unknown>
    }
    cur[path[path.length - 1]] = value
    await prisma.clip.update({
      where: { id: clipId },
      data: { edits: toPrismaJson(edits), editsSaveVersion: { increment: 1 } },
    })
  }
}
