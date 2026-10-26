import type { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'

export async function getScriptForOwner(scriptId: string, ownerId: string) {
  const prisma = getPrisma()
  return prisma.swScript.findFirst({
    where: { id: scriptId, project: { ownerId } },
    include: { project: true },
  })
}

export async function saveScriptPmJson(scriptId: string, ownerId: string, pmJson: Prisma.InputJsonValue) {
  const prisma = getPrisma()
  const row = await getScriptForOwner(scriptId, ownerId)
  if (!row) throw new Error('Not found')
  const text = JSON.stringify(pmJson)
  const wordCount = (text.match(/\b\w+\b/g) ?? []).length
  return prisma.swScript.update({
    where: { id: scriptId },
    data: { pmJson, wordCount, searchText: text.slice(0, 50_000) },
  })
}

export async function saveScriptEditorMeta(scriptId: string, ownerId: string, editorMeta: Prisma.InputJsonValue) {
  const prisma = getPrisma()
  const row = await getScriptForOwner(scriptId, ownerId)
  if (!row) throw new Error('Not found')
  return prisma.swScript.update({
    where: { id: scriptId },
    data: { editorMeta },
  })
}
