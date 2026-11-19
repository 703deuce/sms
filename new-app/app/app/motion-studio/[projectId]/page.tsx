import { redirect } from 'next/navigation'
import { MotionStudioWorkspace } from '../../../../components/motion-studio/motion-studio-workspace'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { projectOpenTarget,openInEditor } from '@/lib/server/motion-studio/service'

export const metadata = { title: 'Motion Studio' }

export default async function MotionStudioProjectRoute({ params, searchParams }: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ view?: string | string[] }>
}) {
  const { projectId } = await params
  const { view } = await searchParams
  // Finished live productions open in the existing Compact Editor.
  // `?view=workspace` retains the producer workspace / chat entrypoint.
  if (view !== 'workspace') {
    let target: 'compact' | 'workspace' = 'workspace'
    try {
      const { workspaceId } = await requireMotionStudioCaller()
      target = await projectOpenTarget(workspaceId, projectId)
    } catch (err) {
      console.warn('[motion-studio:ui] open_target_failed', { error: err instanceof Error ? err.message.slice(0, 120) : 'unknown' })
    }
    if (target === 'compact') {
      try {
        const {workspaceId}=await requireMotionStudioCaller()
        const handoff=await openInEditor(workspaceId,projectId)
        console.info('[motion-studio:ui] load', { step:'route',view:'compact_redirect' })
        redirect('/app/video-editor/'+encodeURIComponent(handoff.clipProjectId)+
          '/edit/'+encodeURIComponent(handoff.clipId)+'?motionStudio='+encodeURIComponent(projectId))
      }catch(error){
        // Next.js redirect() throws an internal control-flow signal.
        if(error&&typeof error==='object'&&'digest' in error&&
          String((error as {digest?:unknown}).digest).startsWith('NEXT_REDIRECT'))throw error
        console.warn('[motion-studio:ui] compact_open_failed',{projectId,
          error:error instanceof Error?error.message:'unknown'})
      }
    }
  }
  console.info('[motion-studio:ui] load', { step: 'route', view: 'workspace' })
  return <MotionStudioWorkspace projectId={projectId} />
}
