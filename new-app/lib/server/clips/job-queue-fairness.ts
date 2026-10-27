import 'server-only'

import { getPrisma } from '@/lib/server/db'

/** Jobs ahead of this one under per-user fair queueing (same ordering as worker claim). */
export async function fairQueueAheadForJob(jobId: string): Promise<number> {
  const prisma = getPrisma()
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    WITH target AS (
      SELECT j.id, j.priority, j."createdAt", p."createdById" AS uid
      FROM clip_jobs j
      INNER JOIN clip_projects p ON p.id = j."projectId"
      WHERE j.id = ${jobId}
    ),
    target_idx AS (
      SELECT t.*,
        (
          SELECT COUNT(*)::int
          FROM clip_jobs j2
          INNER JOIN clip_projects p2 ON p2.id = j2."projectId"
          WHERE j2.status = 'QUEUED'
            AND p2."createdById" = t.uid
            AND j2."createdAt" <= t."createdAt"
        ) AS user_idx
      FROM target t
    )
    SELECT COUNT(*)::int AS count
    FROM clip_jobs j
    INNER JOIN clip_projects p ON p.id = j."projectId"
    CROSS JOIN target_idx t
    WHERE j.status = 'QUEUED'
      AND j.id <> t.id
      AND (
        j.priority > t.priority
        OR (
          j.priority = t.priority
          AND (
            (
              SELECT COUNT(*)::int
              FROM clip_jobs j3
              INNER JOIN clip_projects p3 ON p3.id = j3."projectId"
              WHERE j3.status = 'QUEUED'
                AND p3."createdById" = p."createdById"
                AND j3."createdAt" <= j."createdAt"
            ) < t.user_idx
            OR (
              (
                SELECT COUNT(*)::int
                FROM clip_jobs j4
                INNER JOIN clip_projects p4 ON p4.id = j4."projectId"
                WHERE j4.status = 'QUEUED'
                  AND p4."createdById" = p."createdById"
                  AND j4."createdAt" <= j."createdAt"
              ) = t.user_idx
              AND j."createdAt" < t."createdAt"
            )
          )
        )
      )
  `
  return rows[0]?.count ?? 0
}

export async function fairQueueAheadForProject(projectId: string): Promise<number | undefined> {
  const prisma = getPrisma()
  const job = await prisma.clipJob.findFirst({
    where: { projectId, status: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!job) return undefined
  return fairQueueAheadForJob(job.id)
}
