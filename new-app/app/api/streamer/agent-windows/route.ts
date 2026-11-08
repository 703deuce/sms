import {NextResponse} from 'next/server'
import {z} from 'zod'
import {resolveWorkspaceId} from '@/lib/server/workspace'
import {getPrisma} from '@/lib/server/db'
import {jsonError} from '@/lib/server/api-error'
import {createAgentVideoWindow} from '@/lib/server/streamer/agent-window-source'

const requestSchema=z.object({
  parentProjectId:z.string().min(1),
  rangeStartMs:z.number().int().min(0),
  rangeEndMs:z.number().int().min(1),
})

export async function POST(request:Request){
  try{
    const workspaceId=await resolveWorkspaceId()
    const body=requestSchema.parse(await request.json())
    return NextResponse.json({data:await createAgentVideoWindow(workspaceId,body)})
  }catch(error){return jsonError(error,400)}
}

export async function GET(request:Request){
  try{
    const workspaceId=await resolveWorkspaceId()
    const projectId=new URL(request.url).searchParams.get('projectId')??''
    if(!projectId)return NextResponse.json({error:'projectId_required'},{status:400})
    const project=await getPrisma().clipProject.findFirst({
      where:{id:projectId,workspaceId,deletedAt:null,sourceKind:'stream_agent_window'},
      select:{id:true,status:true,error:true,rangeStartMs:true,rangeEndMs:true,
        uploadId:true,jobs:{where:{type:'STREAM_AGENT_PREPARE'},
          select:{status:true,error:true},take:1,orderBy:{createdAt:'desc'}}},
    })
    if(!project)return NextResponse.json({error:'not_found'},{status:404})
    return NextResponse.json({data:{
      projectId:project.id,status:project.status,
      ready:project.status==='READY'&&Boolean(project.uploadId),
      durationMs:project.rangeEndMs,
      error:project.error??project.jobs[0]?.error??null,
      jobStatus:project.jobs[0]?.status??null,
    }})
  }catch(err){return jsonError(err,400)}
}
