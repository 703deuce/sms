import {NextResponse} from 'next/server'
import {z} from 'zod'
import {resolveWorkspaceId} from '@/lib/server/workspace'
import {getPrisma} from '@/lib/server/db'
import {jsonError} from '@/lib/server/api-error'
import {readStreamerAgentBatch,startStreamerAgentBatch,cancelStreamerAgentBatch}
  from '@/lib/server/streamer/agent-batch'

const start=z.object({
  projectId:z.string().min(1),
  mode:z.enum(['clip_moment_v1','clip_story_v1']),
  seconds:z.union([z.literal(30),z.literal(60),z.literal(90)]),
  action:z.literal('start').optional(),
  allWindows:z.boolean().optional(),
  selectedStartMin:z.number().int().min(0).optional(),
})
export async function POST(request:Request){
  try{
    const workspaceId=await resolveWorkspaceId()
    const body=await request.json()
    if(body?.action==='cancel'){
      const projectId=z.string().min(1).parse(body.projectId)
      return NextResponse.json({data:{
        canceled:await cancelStreamerAgentBatch(workspaceId,projectId)}})
    }
    const args=start.parse(body)
    return NextResponse.json({data:await startStreamerAgentBatch(workspaceId,
      args.projectId,args.mode,args.seconds,
      {allWindows:args.allWindows,selectedStartMin:args.selectedStartMin})})
  }catch(error){return jsonError(error,400)}
}
export async function GET(request:Request){
  try{
    const workspaceId=await resolveWorkspaceId()
    const projectId=new URL(request.url).searchParams.get('projectId')??''
    if(!projectId)return NextResponse.json({error:'projectId_required'},{status:400})
    const project=await getPrisma().clipProject.findFirst({
      where:{id:projectId,workspaceId,deletedAt:null},select:{settings:true},
    })
    if(!project)return NextResponse.json({error:'not_found'},{status:404})
    return NextResponse.json({data:readStreamerAgentBatch(project.settings)})
  }catch(error){return jsonError(error,400)}
}
