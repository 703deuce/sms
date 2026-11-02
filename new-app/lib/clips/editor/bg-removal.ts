import type { ClipEditsV2 } from '@/lib/clips/edits'

export type BgRemovalBackground =
  | { type: 'blur'; amount: number }
  | { type: 'color'; color: string }
  | { type: 'image'; uploadId: string }
  | { type: 'none' }
export type BgRemoval = {
  enabled: boolean
  generationId?: string
  quality: 'standard' | 'detail'
  refine: { feather: number; choke: number }
  background: BgRemovalBackground
}
export const BG_DEFAULT: BgRemoval = {
  enabled: true,
  quality: 'standard',
  refine: { feather: 10, choke: 0 },
  background: { type: 'blur', amount: 50 },
}
const MULTI_VIDEO_LAYOUTS = new Set([
  'facecam_stack',
  'facecam_pip',
  'screen_pip',
  'stack',
  'split',
  'grid3',
  'grid4',
  'two_up',
])

/** NEXT_PUBLIC_* is inlined at build time; default OFF. */
export function bgRemovalUiEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_CLIP_EDITOR_BG_REMOVAL === '1' ||
    process.env.NEXT_PUBLIC_CLIP_EDITOR_BG_REMOVAL === 'true'
  )
}

const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d

export function normalizeBgRemoval(raw: unknown): BgRemoval | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const b = (o.background && typeof o.background === 'object' ? o.background : {}) as Record<string, unknown>
  const t = b.type === 'blur' || b.type === 'color' || b.type === 'image' || b.type === 'none' ? b.type : 'blur'
  let background: BgRemovalBackground
  if (t === 'color') {
    const c = String(b.color ?? '').replace(/^#/, '')
    background = { type: 'color', color: /^[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : '000000' }
  } else if (t === 'image') {
    background =
      typeof b.uploadId === 'string' && b.uploadId.length > 0 && b.uploadId.length <= 64
        ? { type: 'image', uploadId: b.uploadId }
        : { type: 'blur', amount: 50 }
  } else if (t === 'none') background = { type: 'none' }
  else background = { type: 'blur', amount: Math.round(num(b.amount, 0, 100, 50)) }
  const r = (o.refine && typeof o.refine === 'object' ? o.refine : {}) as Record<string, unknown>
  const out: BgRemoval = {
    enabled: o.enabled === true,
    quality: o.quality === 'detail' ? 'detail' : 'standard',
    refine: { feather: Math.round(num(r.feather, 0, 100, 10)), choke: Math.round(num(r.choke, -100, 100, 0)) },
    background,
  }
  if (typeof o.generationId === 'string' && o.generationId.length > 0 && o.generationId.length <= 64) {
    out.generationId = o.generationId
  }
  return out
}

export function bgRemovalBlockedReason(edits: ClipEditsV2): string | null {
  if (edits.sourceSegments?.length) return 'Not available with other video sources on the Video lane.'
  const mode = String(edits.layout?.mode ?? 'speaker_follow')
  if (mode === 'fit_blur' || mode === 'full_frame') return 'Not available in Fit / Full-frame layouts.'
  if (MULTI_VIDEO_LAYOUTS.has(mode)) return 'Not available in multi-video layouts.'
  const tmpl = (edits.layout as { template?: { id?: string } } | undefined)?.template
  if (tmpl?.id) return 'Not available with layout templates.'
  if ((edits.layout as { layoutSegments?: unknown[] } | undefined)?.layoutSegments?.length) {
    return 'Not available when the layout changes during the clip.'
  }
  if (edits.stabilize?.length) return 'Turn off Stabilize to remove the background.'
  return null
}

export function refineAlpha(a: number, feather: number, choke: number): number {
  void feather
  const t = (choke / 100) * 0.5
  const lo = Math.max(0, t)
  const hi = Math.min(1, 1 + t)
  return Math.min(1, Math.max(0, (a - lo) / Math.max(1e-6, hi - lo)))
}
