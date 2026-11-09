import type { MotionPlan } from './contract'

/**
 * Conservative social-safe graphic placement zones (normalized canvas).
 * These are intentional defaults; no platform-specific UI exclusion can be
 * guaranteed forever. All generated placement is checked against this rect.
 */
export function motionSafeRect(format: MotionPlan['format']) {
  if (format === '9:16') return { x: .12, y: .125, width: .58, height: .53 }
  return { x: .08, y: .08, width: .84, height: .84 }
}
