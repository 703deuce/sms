import type { FormatSpec } from '@/lib/screenwriting/formats/types'

/** US Letter feature template (§2.1) — indents from FD Big-Fish ElementSettings. */
export const FEATURE_FORMAT_SPEC: FormatSpec = {
  key: 'feature',
  name: 'Feature',
  page: {
    widthIn: 8.5,
    heightIn: 11,
    marginTop: 1,
    marginBottom: 1,
    marginLeft: 1.5,
    marginRight: 1,
    headerOffset: 0.5,
    bodyLines: 54,
    linesPerInch: 6,
    charsPerInch: 10,
  },
  elements: {
    sceneHeading: { left: 1.5, right: 7.5, spaceBefore: 1, caps: true },
    action: { left: 1.5, right: 7.5, spaceBefore: 1, caps: false },
    character: { left: 3.38, right: 6.25, spaceBefore: 1, caps: true },
    parenthetical: { left: 2.88, right: 5.75, firstLineAdjust: -0.1, spaceBefore: 0, caps: false },
    dialogue: { left: 2.38, right: 6.25, spaceBefore: 0, caps: false },
    transition: { left: 4.38, right: 7.5, spaceBefore: 1, caps: true, align: 'right' },
    shot: { left: 1.5, right: 7.5, spaceBefore: 1, caps: true },
    general: { left: 1.5, right: 7.5, spaceBefore: 0, caps: false },
    lyrics: { left: 2.38, right: 6.25, spaceBefore: 0, caps: false },
    castList: { left: 1.5, right: 7.5, spaceBefore: 1, caps: false },
    centered: { left: 1.5, right: 7.5, spaceBefore: 1, caps: false, align: 'center' },
    actBreak: { left: 1.5, right: 7.5, spaceBefore: 1, caps: true, align: 'center' },
  },
}

export function getBuiltInFormatSpec(key: string): FormatSpec {
  if (key === 'feature') return FEATURE_FORMAT_SPEC
  return FEATURE_FORMAT_SPEC
}
