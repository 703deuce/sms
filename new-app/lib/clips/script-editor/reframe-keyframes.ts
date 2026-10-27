import type { ReframeCropRect, ReframeKeyframe, ScriptAspect } from '@/lib/clips/script-edl/types'

export const DEFAULT_REFRAME_CROP: ReframeCropRect = { cx: 50, cy: 45, w: 56, h: 100 }

export function defaultCropForAspect(aspect: ScriptAspect): ReframeCropRect {
  if (aspect === '16:9') return { cx: 50, cy: 50, w: 100, h: 100 }
  if (aspect === '1:1') return { cx: 50, cy: 50, w: 56, h: 100 }
  if (aspect === '4:5') return { cx: 50, cy: 45, w: 80, h: 100 }
  return { cx: 50, cy: 45, w: 56, h: 100 }
}

export function cropAtSourceMs(
  keyframes: ReframeKeyframe[] | undefined,
  srcMs: number,
  fallback: ReframeCropRect,
): ReframeCropRect {
  const list = keyframes?.length ? [...keyframes].sort((a, b) => a.srcMs - b.srcMs) : []
  if (!list.length) return fallback
  if (srcMs <= list[0].srcMs) return list[0].crop
  const last = list[list.length - 1]
  if (srcMs >= last.srcMs) return last.crop
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i]
    const b = list[i + 1]
    if (srcMs >= a.srcMs && srcMs <= b.srcMs) {
      const t = (srcMs - a.srcMs) / Math.max(1, b.srcMs - a.srcMs)
      return {
        cx: a.crop.cx + (b.crop.cx - a.crop.cx) * t,
        cy: a.crop.cy + (b.crop.cy - a.crop.cy) * t,
        w: a.crop.w + (b.crop.w - a.crop.w) * t,
        h: a.crop.h + (b.crop.h - a.crop.h) * t,
      }
    }
  }
  return last.crop
}

/** CSS for cover-crop inside a box (percent-based focal point). */
export function cropToVideoStyle(crop: ReframeCropRect): {
  objectPosition: string
  transform: string
  transformOrigin: string
} {
  const scale = Math.max(100 / crop.w, 100 / crop.h)
  return {
    objectPosition: `${crop.cx}% ${crop.cy}%`,
    transform: `scale(${scale})`,
    transformOrigin: `${crop.cx}% ${crop.cy}%`,
  }
}
