/**
 * One-off: HEAD every stock_assets.storageKey; re-ingest missing Pixabay video rows or clear storageKey.
 * Run: cd new-app && NODE_OPTIONS='--import ../scripts/preload-server-only.mjs' npx tsx scripts/repair-stock-storage.ts
 */
import { PrismaClient } from '@prisma/client'
import { getClipStorage } from '@/lib/storage'

const prisma = new PrismaClient()

async function pixabayVideoUrl(providerId: string): Promise<string | null> {
  const key = process.env.PIXABAY_API_KEY?.trim()
  if (!key) return null
  const u = new URL('https://pixabay.com/api/videos/')
  u.searchParams.set('key', key)
  u.searchParams.set('id', providerId)
  const res = await fetch(u, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) return null
  const body = (await res.json()) as { hits?: Array<{ videos?: Record<string, { url?: string }> }> }
  const hit = body.hits?.[0]
  if (!hit?.videos) return null
  for (const tier of ['large', 'medium', 'small', 'tiny']) {
    const url = hit.videos[tier]?.url
    if (url) return url
  }
  return null
}

async function main() {
  const storage = getClipStorage()
  const rows = await prisma.stockAsset.findMany({
    where: { storageKey: { not: null } },
    select: { id: true, provider: true, providerId: true, storageKey: true },
  })
  let missing = 0
  let repaired = 0
  let cleared = 0
  for (const row of rows) {
    const key = row.storageKey!
    let size: number | null = null
    try {
      size = await storage.getObjectSizeBytes(key)
    } catch {
      size = null
    }
    if (size != null && size > 0) continue
    missing++
    console.info('[t2v:stock] repair-scan missing', {
      assetId: row.id,
      provider: row.provider,
      providerId: row.providerId,
      storageKey: key,
    })
    if (row.provider === 'pixabay' && key.endsWith('.mp4')) {
      const src = await pixabayVideoUrl(row.providerId)
      if (src) {
        const res = await fetch(src, { signal: AbortSignal.timeout(120_000) })
        if (res.ok) {
          const bytes = Buffer.from(await res.arrayBuffer())
          if (bytes.length > 64) {
            await storage.putBytes(key, bytes, 'video/mp4')
            repaired++
            console.info('[t2v:stock] repair-scan re-ingested', { assetId: row.id, storageKey: key })
            continue
          }
        }
      }
    }
    await prisma.stockAsset.update({ where: { id: row.id }, data: { storageKey: null } })
    cleared++
    console.info('[t2v:stock] repair-scan cleared storageKey', { assetId: row.id })
  }
  console.info('[t2v:stock] repair-scan done', {
    scanned: rows.length,
    missing,
    repaired,
    cleared,
  })
}

main()
  .catch((e) => {
    console.error('[t2v:stock] repair-scan failed', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
