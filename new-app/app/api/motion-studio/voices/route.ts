import {NextResponse} from 'next/server'
import {requireMotionStudioCaller} from '@/lib/server/motion-studio/auth'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {listVoices,createClone} from '@/lib/server/motion-studio/voices'
export async function GET(request:Request){
 try{const {workspaceId,userId}=await requireMotionStudioCaller(request)
  return NextResponse.json(await listVoices(workspaceId,userId),{headers:{'Cache-Control':'private, no-store'}})
 }catch(error){return motionStudioJsonError(error)}
}
export async function POST(request:Request){
 try{const {workspaceId,userId}=await requireMotionStudioCaller(request)
  return NextResponse.json({voice:await createClone(workspaceId,userId,await request.json())},{status:201})
 }catch(error){return motionStudioJsonError(error)}
}
