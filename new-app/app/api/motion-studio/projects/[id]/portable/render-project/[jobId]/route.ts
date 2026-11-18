import {NextResponse} from 'next/server'
import {requireMotionStudioCaller} from '@/lib/server/motion-studio/auth'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {customerDeterministicJob} from '@/lib/server/motion-studio/deterministic-jobs'
import {getPrisma} from '@/lib/server/db'
import {createReadableSignedUrl} from '@/lib/storage'
import { pollingRoute } from '@/lib/server/db-read-gate'
type Ctx={params:Promise<{id:string;jobId:string}>}
export const GET = pollingRoute(async function GET(request:Request,ctx:Ctx){
  try{
    const {id:projectId,jobId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    const job=await customerDeterministicJob(workspaceId,projectId,jobId)
    let downloadUrl:string|null=null
    if(job.status==='complete'&&job.resultAssetId){
      const asset=await getPrisma().studioAsset.findFirst({
        where:{id:job.resultAssetId,workspaceId,projectId,status:'ready'},
        select:{uploadId:true},
      })
      const upload=asset?await getPrisma().clipUpload.findFirst({
        where:{id:asset.uploadId,workspaceId,status:{in:['READY','COMPLETE']}},
        select:{key:true,mime:true},
      }):null
      if(upload?.mime==='video/mp4')
        downloadUrl=await createReadableSignedUrl(upload.key,900).catch(()=>null)
    }
    return NextResponse.json({job,downloadUrl},{headers:{'Cache-Control':'private, no-store'}})
  }catch(e){return motionStudioJsonError(e)}
})
