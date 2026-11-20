import {NextResponse} from 'next/server'
import {requireMotionStudioCaller} from '@/lib/server/motion-studio/auth'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {renameOrDefault,deleteClone} from '@/lib/server/motion-studio/voices'
type Ctx={params:Promise<{id:string}>}
export async function PATCH(request:Request,{params}:Ctx){
 try{const {workspaceId,userId}=await requireMotionStudioCaller(request)
  const {id}=await params
  return NextResponse.json({voice:await renameOrDefault(workspaceId,userId,id,await request.json())})
 }catch(error){return motionStudioJsonError(error)}
}
export async function DELETE(request:Request,{params}:Ctx){
 try{const {workspaceId,userId}=await requireMotionStudioCaller(request)
  const {id}=await params;await deleteClone(workspaceId,userId,id)
  return NextResponse.json({deleted:true})
 }catch(error){return motionStudioJsonError(error)}
}
