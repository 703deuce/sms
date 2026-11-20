import {NextResponse} from 'next/server'
import {requireMotionStudioCaller} from '@/lib/server/motion-studio/auth'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {setDefaultVoice} from '@/lib/server/motion-studio/voices'
export async function POST(request:Request){
 try{const {workspaceId,userId}=await requireMotionStudioCaller(request)
  const data=await request.json() as {voiceId?:string|null;source?:'stock'|'cloned'}
  return NextResponse.json({defaultVoice:await setDefaultVoice(workspaceId,userId,
     data.voiceId||null,data.source==='stock'?'stock':'cloned')})
 }catch(error){return motionStudioJsonError(error)}
}
