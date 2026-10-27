import 'server-only'
import { brandEditsFromProjectBrand } from '@/lib/clips/brand'
import { getPrisma } from '@/lib/server/db'
import { storageKeyAllowedForWorkspace } from '@/lib/server/t2v/validate-document'
import type { T2vDraftV1 } from '@/lib/t2v/types'

/** Resolve brand keys from workspace template; strip cross-workspace storage keys from client patches. */
export async function resolveT2vBrandSettings(
  workspaceId: string,
  settings: T2vDraftV1['settings'],
): Promise<T2vDraftV1['settings']> {
  const next = { ...settings }
  const templateId = settings.brandTemplateId
  let brand = settings.brand ? { ...settings.brand } : undefined

  if (templateId) {
    const row = await getPrisma().clipBrandTemplate.findFirst({
      where: { id: templateId, workspaceId },
    })
    if (row) {
      const st = (row.settings ?? {}) as Record<string, unknown>
      const prev = settings.brand
      brand = {
        templateId: row.id,
        brandTemplateId: row.id,
        logoKey: row.logoKey ?? undefined,
        introVideoKey: row.introVideoKey ?? undefined,
        outroVideoKey: row.outroVideoKey ?? undefined,
        useIntro: prev?.useIntro ?? Boolean(row.introVideoKey),
        useOutro: prev?.useOutro ?? Boolean(row.outroVideoKey),
        primaryColor: typeof st.primaryColor === 'string' ? st.primaryColor : brand?.primaryColor,
        secondaryColor: typeof st.secondaryColor === 'string' ? st.secondaryColor : brand?.secondaryColor,
        fontFamily: typeof st.fontFamily === 'string' ? st.fontFamily : brand?.fontFamily,
        titleFont: typeof st.titleFont === 'string' ? st.titleFont : brand?.titleFont,
      }
    }
  }

  if (brand) {
    for (const key of ['logoKey', 'introVideoKey', 'outroVideoKey'] as const) {
      const v = brand[key]
      if (typeof v === 'string' && v && !storageKeyAllowedForWorkspace(workspaceId, v)) {
        delete brand[key]
      }
    }
    brand.brandTemplateId = brand.brandTemplateId ?? brand.templateId ?? templateId
    brand.templateId = brand.templateId ?? brand.brandTemplateId ?? templateId
    const edits = brandEditsFromProjectBrand(brand as Record<string, unknown>)
    if (edits) {
      next.brand = {
        ...brand,
        ...edits,
        templateId: brand.templateId,
        brandTemplateId: brand.brandTemplateId ?? brand.templateId,
      } as T2vDraftV1['settings']['brand']
    } else {
      next.brand = brand
    }
  } else if (!templateId) {
    next.brand = undefined
  }

  return next
}
