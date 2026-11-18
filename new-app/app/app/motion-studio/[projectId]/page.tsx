import { redirect } from 'next/navigation'
import { MotionStudioWorkspace } from '../../../../components/motion-studio/motion-studio-workspace'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { projectOpenTarget } from '@/lib/server/motion-studio/service'

export const metadata = { title: 'Motion Studio' }

export default async function MotionStudioProjectRoute({ params, searchParams }: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ view?: string | string[] }>
}) {
  const { projectId } = await params
  const { view } = await searchParams
  // A finished live (masterless) production opens in the browser editor, which plays the
  // portable version directly. `?view=workspace` keeps the old workspace reachable.
  if (view !== 'workspace') {
    let target: 'live' | 'workspace' = 'workspace'
    try {
      const { workspaceId } = await requireMotionStudioCaller()
      target = await projectOpenTarget(workspaceId, projectId)
    } catch (err) {
      console.warn('[motion-studio:ui] open_target_failed', { error: err instanceof Error ? err.message.slice(0, 120) : 'unknown' })
    }
    if (target === 'live') {
      console.info('[motion-studio:ui] load', { step: 'route', view: 'live_redirect' })
      redirect('/app/motion-studio/' + encodeURIComponent(projectId) + '/live')
    }
  }
  console.info('[motion-studio:ui] load', { step: 'route', view: 'workspace' })
  return <MotionStudioWorkspace projectId={projectId} />
}
