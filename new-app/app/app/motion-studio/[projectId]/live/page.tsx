import {redirect} from 'next/navigation'
import {requireMotionStudioCaller} from '@/lib/server/motion-studio/auth'
import {openInEditor} from '@/lib/server/motion-studio/service'

/** Legacy live-editor link: preserve bookmarks, but enter the one Compact Editor. */
export default async function LiveVideoPage({params}:{
  params:Promise<{projectId:string}>
}){
  const {projectId}=await params
  let editorUrl:string|null=null
  try{
    const {workspaceId}=await requireMotionStudioCaller()
    const handoff=await openInEditor(workspaceId,projectId)
    editorUrl='/app/video-editor/'+encodeURIComponent(handoff.clipProjectId)+
      '/edit/'+encodeURIComponent(handoff.clipId)+'?motionStudio='+encodeURIComponent(projectId)
  }catch(error){
    console.warn('[motion-studio:ui] legacy_live_handoff_failed',{
      projectId,error:error instanceof Error?error.message:'unknown'})
  }
  redirect(editorUrl||'/app/motion-studio/'+encodeURIComponent(projectId)+'?view=workspace')
}
