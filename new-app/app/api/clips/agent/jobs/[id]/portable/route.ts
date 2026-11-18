import {authorizeClipAgentCallback,clipAgentError} from '@/lib/server/clips/agent-finish'
import {publishPortableVersion} from '@/lib/server/motion-studio/portable-projects'
import {getPrisma} from '@/lib/server/db'
import {toPrismaJson} from '@/lib/server/clips/prisma-json'
import {storageDriverName} from '@/lib/storage'

type Ctx={params:Promise<{id:string}>}
type Artifact={id:string;key:string;kind:string;filename:string;mime:string;bytes:number;
  state:string;sha256?:string}
const obj=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{}

/** The clip producer uses its own authenticated callback URL.
 * Registered bundles and live-project versions then enter exactly the same
 * browser playback path as any other Transovo project. No MP4 is created.
 */
export async function POST(request:Request,ctx:Ctx){
  try{
    const {id}=await ctx.params
    const job=await authorizeClipAgentCallback(id,request)
    if(['complete','failed','cancelled','dispatch_failed'].includes(job.status))
      return Response.json({error:'Clip job already finished'},{status:409})
    const body=obj(await request.json())
    const project=await getPrisma().clipProject.findFirst({
      where:{id:job.projectId,workspaceId:job.workspaceId,deletedAt:null},
      select:{id:true,title:true,createdById:true},
    })
    if(!project)return Response.json({error:'Clip project unavailable'},{status:404})
    const document=obj(body.document)
    // Match the original clip project id. This becomes the stable editor id.
    if(document.projectId!==job.projectId)
      return Response.json({error:'Live document must belong to this clip project'},{status:400})
    await getPrisma().motionStudioProject.upsert({
      where:{id:project.id},
      create:{id:project.id,workspaceId:job.workspaceId,userId:project.createdById,
        clipProjectId:project.id,title:project.title,workflow:'clip',
        director:'clip',brief:'Original clip with editable creative layers',
        settings:toPrismaJson({lengthMin:1,productionMode:'auto'}),
        idempotencyKey:'clip-portable-'+project.id,status:'review',stage:'review'},
      update:{},
    })
    const publishedAssets=Array.isArray(body.assets)?body.assets:[]
    const ready=(Array.isArray(job.artifacts)?job.artifacts:[]) as Artifact[]
    for(const entry of publishedAssets){
      const a=obj(entry)
      const uploadId=String(a.storageId||a.id||'')
      const item=ready.find(v=>v.id===uploadId&&v.state==='ready')
      if(!item) return Response.json({error:'Live asset not uploaded: '+uploadId},{status:409})
      if(typeof a.sha256!=='string'||a.sha256.length!==64||item.sha256!==a.sha256)
        return Response.json({error:'Live asset checksum mismatch: '+uploadId},{status:409})
      await getPrisma().clipUpload.upsert({
        where:{id:item.id},
        create:{id:item.id,workspaceId:job.workspaceId,key:item.key,
          filename:item.filename,bytes:BigInt(item.bytes),mime:item.mime,
          kind:'media',status:'COMPLETE',storageDriver:storageDriverName()},
        update:{},
      })
      await getPrisma().studioAsset.upsert({
        where:{id:item.id},
        create:{id:item.id,workspaceId:job.workspaceId,projectId:project.id,
          uploadId:item.id,kind:String(a.kind||item.kind),filename:item.filename,
          status:'ready',provenanceLog:toPrismaJson({source:'clip_live',
            sha256:item.sha256,verifiedSha256:true,jobId:id})},
        update:{status:'ready'},
      })
    }
    const published=await publishPortableVersion(job.workspaceId,project.id,{
      ...body,sourceJobId:id,
    })
    return Response.json({versionId:published.id,revision:published.revision,
      delivery:'live',status:'committed'})
  }catch(error){return clipAgentError(error)}
}
