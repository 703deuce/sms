import { BRAND_STARTERS } from '@/lib/clips/brand-starters'
import { bgRemovalUiEnabled } from '@/lib/clips/editor/bg-removal'
import { LAYOUT_KIND_LABEL, type SegmentLayoutKind } from '@/lib/clips/editor/segment-layout'
import { STARTER_LOOKS, captionStyleOptions } from '@/lib/clips/editor/starter-templates'
import { isClipLayoutBeta } from '@/lib/clips/clipper-layout-beta'
import { LAYOUT_OPTIONS, layoutOptionDisabled, LAYOUT_BETA_DISABLED_TOOLTIP } from '@/lib/clips/layout-options'
import { T6_TEMPLATES } from '@/lib/clips/templates/registry'

export type CatalogTab = 'layouts' | 'captions' | 'looks' | 'brand'

export type CatalogItem = {
  kind:
    | 'layout'
    | 'layout_template'
    | 'multicam'
    | 'caption'
    | 'look'
    | 'brand_starter'
    | 'look_feature'
  id: string
  name: string
  tab: CatalogTab
  badge?: 'Beta'
  disabled?: string
  mock: Record<string, unknown>
}

const MULTICAM_KINDS: SegmentLayoutKind[] = ['side_by_side', 'stack', 'pip', 'grid']

export function buildTemplateCatalog(): CatalogItem[] {
  const out: CatalogItem[] = []

  const layoutCtx = { facecamLayout: null, reframeV2Enabled: false, aiExtras: false }

  for (const l of LAYOUT_OPTIONS) {
    const off = layoutOptionDisabled(l, layoutCtx)
    out.push({
      kind: 'layout',
      id: l.id,
      name: l.title,
      tab: 'layouts',
      badge: isClipLayoutBeta(l.id) ? 'Beta' : undefined,
      disabled: off ? LAYOUT_BETA_DISABLED_TOOLTIP : undefined,
      mock: { mode: l.id },
    })
  }

  for (const t of T6_TEMPLATES) {
    out.push({
      kind: 'layout_template',
      id: t.id,
      name: t.name,
      tab: 'layouts',
      mock: { templateId: t.id, lane: t.lane },
    })
  }

  for (const k of MULTICAM_KINDS) {
    out.push({
      kind: 'multicam',
      id: k,
      name: LAYOUT_KIND_LABEL[k],
      tab: 'layouts',
      mock: { segmentLayout: k },
    })
  }

  for (const c of captionStyleOptions(true)) {
    out.push({
      kind: 'caption',
      id: c.id,
      name: c.name,
      tab: 'captions',
      mock: { captionId: c.id, font: c.font },
    })
  }

  for (const look of STARTER_LOOKS) {
    out.push({
      kind: 'look',
      id: look.id,
      name: look.name,
      tab: 'looks',
      mock: { lookId: look.id },
    })
  }

  for (const s of BRAND_STARTERS) {
    out.push({
      kind: 'brand_starter',
      id: s.id,
      name: s.name,
      tab: 'brand',
      mock: { starterId: s.id, palette: s.columns.palette ?? [] },
    })
  }

  if (bgRemovalUiEnabled()) {
    out.push({
      kind: 'look_feature',
      id: 'bg_removal',
      name: 'Remove background',
      tab: 'looks',
      mock: { feature: 'bg_removal' },
    })
  }

  return out
}

export function catalogCounts(items: CatalogItem[]) {
  const byKind: Record<string, number> = {}
  for (const i of items) {
    byKind[i.kind] = (byKind[i.kind] ?? 0) + 1
  }
  return byKind
}
