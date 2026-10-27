import 'server-only'
import { redirect } from 'next/navigation'
import { isT2vFeatureEnabled } from '@/lib/server/clips/feature-gates'

/** Redirect to Clips drive when AI Video is paused (pages stay in repo, not reachable). */
export function requireAiVideoPageEnabled(): void {
  if (!isT2vFeatureEnabled()) redirect('/app/clips')
}
