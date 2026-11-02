import type { FacecamLayoutState } from '@/lib/server/clips/clip-detail'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { layoutPickPayload } from '@/lib/clips/layout-options'
import { applyLayoutPack, type LayoutPackPayload } from '@/lib/clips/layout-packs'
import { layoutForKind, layoutPersistedOnSegment } from '@/lib/clips/editor/multicam-layout-pick'
import type { SegmentLayoutKind } from '@/lib/clips/editor/segment-layout'
import { setLayoutForRange } from '@/lib/clips/editor/multicam-manual'
import { sourceSegmentAt, type ClipMediaSource } from '@/lib/clips/editor/sources'
import {
  applyStarterLook,
  captionPresetPatch,
  STARTER_LOOKS,
  templateLayoutPatch,
  type StarterApplyOpts,
} from '@/lib/clips/editor/starter-templates'
import { T6_TEMPLATES_BY_ID } from '@/lib/clips/templates/registry'

export type ApplyToken =
  | { kind: 'layout'; id: string }
  | { kind: 'layout_template'; id: string }
  | { kind: 'multicam'; id: SegmentLayoutKind }
  | { kind: 'caption'; id: string }
  | { kind: 'look'; id: string }
  | { kind: 'look_feature'; id: string }
  | { kind: 'layout_pack'; id: string }

export function parseApplyToken(raw: string): ApplyToken | null {
  const i = raw.indexOf(':')
  if (i <= 0) return null
  const kind = raw.slice(0, i)
  const id = raw.slice(i + 1)
  if (!id) return null
  if (
    kind === 'layout' ||
    kind === 'layout_template' ||
    kind === 'multicam' ||
    kind === 'caption' ||
    kind === 'look' ||
    kind === 'look_feature' ||
    kind === 'layout_pack'
  ) {
    return { kind, id } as ApplyToken
  }
  return null
}

export type ApplyCatalogContext = {
  facecamLayout: FacecamLayoutState | null
  playheadSourceMs: number
  mediaLibrary: readonly ClipMediaSource[]
  starterOpts: StarterApplyOpts
}

export function applyCatalogToken(
  edits: ClipEditsV2,
  token: ApplyToken,
  ctx: ApplyCatalogContext,
): { edits: ClipEditsV2; sideEffect?: 'bg_removal' } {
  switch (token.kind) {
    case 'layout': {
      const payload = layoutPickPayload(token.id as ClipEditsV2['layout']['mode'], ctx.facecamLayout, edits)
      return {
        edits: {
          ...edits,
          layout: {
            ...edits.layout,
            mode: payload.mode,
            facecam: payload.facecam ?? edits.layout.facecam,
            userPicked: true,
          },
        },
      }
    }
    case 'layout_template': {
      const t = T6_TEMPLATES_BY_ID[token.id]
      if (!t) return { edits }
      return { edits: templateLayoutPatch(edits, t, { auto: false, reason: 'templates_hub', family: t.lane }) }
    }
    case 'caption':
      return { edits: captionPresetPatch(edits, token.id) }
    case 'look': {
      const look = STARTER_LOOKS.find((l) => l.id === token.id)
      if (!look) return { edits }
      return { edits: applyStarterLook(edits, look, ctx.starterOpts) }
    }
    case 'look_feature':
      if (token.id === 'bg_removal') return { edits, sideEffect: 'bg_removal' }
      return { edits }
    case 'multicam': {
      const kind = token.id as SegmentLayoutKind
      const seg = sourceSegmentAt(edits.sourceSegments, ctx.playheadSourceMs)
      if (!seg) return { edits }
      const lib = [...(edits.sources ?? []), ...ctx.mediaLibrary]
      const layout = layoutForKind(kind, seg.sourceId, edits, lib)
      if (!layout) return { edits }
      const next = setLayoutForRange(edits, seg.startMs, seg.endMs, layout, lib)
      return layoutPersistedOnSegment(next, seg, layout) ? { edits: next } : { edits }
    }
    case 'layout_pack':
      return { edits }
    default:
      return { edits }
  }
}

export async function fetchLayoutPackPayload(id: string): Promise<LayoutPackPayload | null> {
  const res = await fetch(`/api/clips/layout-packs/${encodeURIComponent(id)}`)
  if (!res.ok) return null
  const body = (await res.json()) as { data?: { pack?: { payload?: LayoutPackPayload } } }
  return body.data?.pack?.payload ?? null
}

export function applyLayoutPackPayload(edits: ClipEditsV2, payload: LayoutPackPayload): ClipEditsV2 {
  return applyLayoutPack(edits, payload)
}
