import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { createSignedDownloadUrlForObjectKey } from '@/lib/storage'

export type WorkspaceBrandShare = {
  brandName: string
  logoUrl: string | null
  accentColor: string | null
}

export async function getWorkspaceBrandForShare(workspaceId: string): Promise<WorkspaceBrandShare> {
  const prisma = getPrisma()
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  })
  const brand = await prisma.clipBrandTemplate.findFirst({
    where: { workspaceId, isDefault: true },
    orderBy: { updatedAt: 'desc' },
  })
  const settings = (brand?.settings ?? {}) as Record<string, unknown>
  const accent =
    typeof settings.accentColor === 'string'
      ? settings.accentColor
      : typeof settings.primaryColor === 'string'
        ? settings.primaryColor
        : null

  let logoUrl: string | null = null
  if (brand?.logoKey) {
    try {
      logoUrl = await createSignedDownloadUrlForObjectKey(brand.logoKey, undefined, 3600)
    } catch {
      logoUrl = null
    }
  }

  return {
    brandName: brand?.name?.trim() || workspace?.name?.trim() || 'Transovo',
    logoUrl,
    accentColor: accent,
  }
}
