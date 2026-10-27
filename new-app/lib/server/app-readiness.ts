import 'server-only'

import { getPrisma } from '@/lib/server/db'

let dbReady = false
let dbCheckPromise: Promise<boolean> | null = null

/** True once Postgres answers a trivial query (migrations finished, pool warm). */
export async function isDatabaseReady(): Promise<boolean> {
  if (dbReady) return true
  if (!process.env.DATABASE_URL?.trim()) return false
  if (!dbCheckPromise) {
    dbCheckPromise = (async () => {
      try {
        const prisma = getPrisma()
        await prisma.$queryRaw`SELECT 1`
        dbReady = true
        return true
      } catch {
        return false
      } finally {
        dbCheckPromise = null
      }
    })()
  }
  return dbCheckPromise
}

export function markDatabaseReady(): void {
  dbReady = true
}
