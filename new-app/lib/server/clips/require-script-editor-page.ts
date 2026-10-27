import 'server-only'
import { redirect } from 'next/navigation'
import { isScriptEditorFeatureEnabled } from '@/lib/server/clips/feature-gates'

/** Redirect to Clips drive when script editor is paused (pages stay in repo, not reachable). */
export function requireScriptEditorPageEnabled(): void {
  if (!isScriptEditorFeatureEnabled()) redirect('/app/clips')
}
