import {NextResponse} from 'next/server'
import {requireBotJob} from '@/lib/server/motion-studio/agent-bridge'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {createReadableSignedUrl} from '@/lib/storage'
import {MotionStudioError} from '@/lib/server/motion-studio/errors'

type Ctx={params:Promise<{id:string}>}
type Artifact={filename?:string;kind?:string;mime?:string;state?:string;key?:string;bytes?:number}
export async function GET(request:Request,ctx:Ctx){
  try{
    const {id}=await ctx.params
    const job=await requireBotJob(id,request)
    const filename=new URL(request.url).searchParams.get('filename')||''
    if(!/^[A-Za-z0-9_.-]{1,120}$/.test(filename))
      throw new MotionStudioError('INVALID','Invalid artifact filename',400)
    const entries=Array.isArray(job.artifacts)?job.artifacts as Artifact[]:[]
    const artifact=entries.find(a=>a.filename===filename&&a.state==='ready'&&
      ['bundle','video','audio','project','media'].includes(a.kind||'')&&
      typeof a.key==='string'&&a.key.startsWith(
        'ws/'+job.workspaceId+'/motion-studio/agent/'))
    if(!artifact||!artifact.key)
      return NextResponse.json({exists:false},{headers:{'Cache-Control':'private, no-store'}})
    const url=await createReadableSignedUrl(artifact.key,1800)
    return NextResponse.json({exists:true,url,bytes:artifact.bytes??null,
      kind:artifact.kind},{headers:{'Cache-Control':'private, no-store'}})
  }catch(error){return motionStudioJsonError(error)}
}
