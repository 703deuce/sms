import type { ClipEditsV2 } from '@/lib/clips/edits'
import { DEFAULT_FACECAM_BOX, DEFAULT_GAMEPLAY_BOX } from '@/lib/clips/facecam-geometry'
import { isClipLayoutBeta } from '@/lib/clips/clipper-layout-beta'
import type { FacecamLayoutState } from '@/lib/server/clips/clip-detail'

export type LayoutOptionId = ClipEditsV2['layout']['mode']

export type LayoutOption = {
  id: LayoutOptionId
  title: string
  hint: string
  needsFacecam?: boolean
  beta?: boolean
  exportPicker?: boolean
  disabled?: boolean
}

export const LAYOUT_OPTIONS: LayoutOption[] = [
  { id: 'auto', title: 'Auto variety', hint: 'Rotate layouts per clip rank.' },
  { id: 'speaker_follow', title: 'Speaker follow', hint: 'Single active speaker.', exportPicker: true },
  { id: 'dynamic', title: 'Dynamic', hint: 'Director picks per scene.' },
  { id: 'split', title: 'Two-speaker split', hint: 'Stacked two-person layout.', exportPicker: true },
  { id: 'grid3', title: 'Grid 3-up', hint: 'Three speakers visible.' },
  { id: 'grid4', title: 'Grid 4-up', hint: 'Four speakers visible.' },
  {
    id: 'fit_blur',
    title: 'Fit with blur',
    hint: 'Whole shot letterboxed with blurred fill (no headline band).',
    exportPicker: true,
  },
  {
    id: 'fit_top',
    title: 'Headline + video',
    hint: 'CLIPZ-style: white headline band, full-width 16:9 video, blur footer.',
    exportPicker: true,
  },
  {
    id: 'full_frame',
    title: 'Full frame',
    hint: 'Whole 16:9 shot with blurred fill (no headline band).',
    exportPicker: true,
  },
  {
    id: 'facecam_stack',
    title: 'Facecam stack',
    hint: 'Streamer layout: facecam panel over gameplay.',
    needsFacecam: true,
    exportPicker: true,
  },
  {
    id: 'facecam_pip',
    title: 'Facecam PiP',
    hint: 'Gameplay full frame with facecam picture-in-picture.',
    needsFacecam: true,
    exportPicker: true,
  },
  { id: 'center_crop', title: 'Fill', hint: 'Full-frame crop fill.', exportPicker: true },
  {
    id: 'screen_pip',
    title: 'Screen + camera',
    hint: 'Screen share full frame with speaker PiP (when detected).',
  },
  { id: 'subject_follow', title: 'Subject follow', hint: 'ClipAnything — later', disabled: true },
]

export const EXPORT_LAYOUT_OPTIONS = LAYOUT_OPTIONS.filter((o) => o.exportPicker)

/** E4fix: helper line under "Layout for this export" — describes the layout actually selected. */
export function exportLayoutHint(mode: LayoutOptionId | undefined): string {
  const opt = LAYOUT_OPTIONS.find((o) => o.id === mode)
  return opt ? `${opt.title}: ${opt.hint}` : 'Pick how the stream shot is framed in the 9:16 export.'
}

/** E4fix: label of the video area in the export mini preview, per saved layout mode. */
export function layoutMiniPreviewLabel(mode: LayoutOptionId | undefined): string {
  switch (mode) {
    case 'facecam_stack':
      return 'Facecam over gameplay'
    case 'facecam_pip':
      return 'Gameplay + facecam PiP'
    case 'split':
      return 'Two-speaker split'
    case 'center_crop':
      return '9:16 crop fill'
    case 'speaker_follow':
      return 'Speaker follow crop'
    case 'fit_top':
    case 'fit_blur':
    case 'full_frame':
    case undefined:
      return '16:9 + blur fill'
    default:
      return LAYOUT_OPTIONS.find((o) => o.id === mode)?.title ?? '16:9 + blur fill'
  }
}

export function layoutOptionDisabled(
  opt: LayoutOption,
  ctx: { facecamLayout: FacecamLayoutState | null; reframeV2Enabled: boolean; aiExtras: boolean },
): boolean {
  if (opt.disabled) return !ctx.aiExtras
  if (isClipLayoutBeta(opt.id) && !ctx.reframeV2Enabled) return !ctx.aiExtras
  return false
}

export function layoutPickPayload(
  mode: LayoutOptionId,
  facecamLayout: FacecamLayoutState | null,
  edits: ClipEditsV2,
): { mode: LayoutOptionId; facecam?: ClipEditsV2['layout']['facecam'] } {
  const editsBox = edits.layout.facecam?.box
  const effectiveFacecam: FacecamLayoutState | null =
    editsBox && editsBox.w > 0 && editsBox.h > 0
      ? {
          facecam: editsBox,
          gameplay: edits.layout.facecam?.gameplay ?? facecamLayout?.gameplay ?? null,
          split: edits.layout.facecam?.split ?? facecamLayout?.split ?? 0.35,
          facecamPosition:
            edits.layout.facecam?.position ?? facecamLayout?.facecamPosition ?? 'top',
          layout: 'stack',
          confidence: facecamLayout?.confidence ?? 1,
          source: 'editor',
        }
      : facecamLayout
  const needsFacecamPick = mode === 'facecam_stack' || mode === 'facecam_pip'
  if (needsFacecamPick && effectiveFacecam?.facecam) {
    return {
      mode,
      facecam: {
        box: effectiveFacecam.facecam,
        gameplay: effectiveFacecam.gameplay ?? undefined,
        split: effectiveFacecam.split ?? 0.35,
        position: effectiveFacecam.facecamPosition ?? 'top',
        pipCorner: edits.layout.facecam?.pipCorner ?? 'BR',
      },
    }
  }
  if (needsFacecamPick) {
    return {
      mode,
      facecam: {
        box: { ...DEFAULT_FACECAM_BOX },
        gameplay: { ...DEFAULT_GAMEPLAY_BOX },
        split: 0.35,
        position: 'top',
        pipCorner: edits.layout.facecam?.pipCorner ?? 'BR',
      },
    }
  }
  return { mode }
}

export function visibleLayoutOptions(ctx: {
  reframeV2Enabled: boolean
  aiExtras: boolean
}): LayoutOption[] {
  return LAYOUT_OPTIONS.filter((l) => {
    if (l.disabled) return ctx.aiExtras
    if (isClipLayoutBeta(l.id) && !ctx.reframeV2Enabled) return ctx.aiExtras
    return true
  })
}
