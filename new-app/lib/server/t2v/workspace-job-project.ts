import 'server-only'
import { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

const HUB_TITLE = '__t2v_workspace_jobs__'

/** Clip project used for workspace-scoped T2V jobs when no video project exists (e.g. voice clone). */
export async function getOrCreateT2vWorkspaceJobProject(workspaceId: string) {
  const prisma = getPrisma()
  const existing = await prisma.clipProject.findFirst({
    where: { workspaceId, title: HUB_TITLE, deletedAt: null },
    select: { id: true },
  })
  if (existing) return existing

  const id = createId('proj')
  try {
    await prisma.clipProject.create({
      data: {
        id,
        workspaceId,
        title: HUB_TITLE,
        status: 'READY',
        sourceKind: 't2v',
        stage: 'ready',
        progress: 100,
        settings: { t2vWorkspaceHub: true },
      },
    })
    return { id }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const again = await prisma.clipProject.findFirst({
        where: { workspaceId, title: HUB_TITLE, deletedAt: null },
        select: { id: true },
      })
      if (again) return again
    }
    throw err
  }
}
