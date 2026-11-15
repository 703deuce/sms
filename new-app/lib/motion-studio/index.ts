import { createLiveMotionStudioClient, type MotionStudioClient } from './client'
import { createMockMotionStudioClient } from './mock-client'

export * from './types'
export * from './config'
export * from './format'
export { createLiveMotionStudioClient, MotionStudioHttpError, assetKindForFile, newIdempotencyKey } from './client'
export type { MotionStudioClient } from './client'
export { createMockMotionStudioClient } from './mock-client'
export { buildMotionTracks } from './timeline'

/**
 * Clean switch to the live backend: set NEXT_PUBLIC_MOTION_STUDIO_LIVE=1 once `/api/motion-studio/*`
 * is deployed. Until then every screen runs on the in-browser mock (no paid calls, no network).
 */
export function motionStudioLiveEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MOTION_STUDIO_LIVE === '1'
}

let singleton: MotionStudioClient | null = null
export function getMotionStudioClient(): MotionStudioClient {
  if (!singleton) singleton = motionStudioLiveEnabled() ? createLiveMotionStudioClient() : createMockMotionStudioClient()
  return singleton
}
