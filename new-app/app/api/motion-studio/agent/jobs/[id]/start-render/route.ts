import { NextResponse } from 'next/server'
import { requireBotJob } from '@/lib/server/motion-studio/agent-bridge'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'

type Ctx={params:Promise<{id:string}>}
type Artifact={filename?:string;kind?:string;state?:string;key?:string}
const invalid=(message:string)=>new MotionStudioError('INVALID',message,400)
async function boundedJson(request:Request):Promise<Record<string,unknown>>{
  const max=8192
  const declared=Number(request.headers.get('content-length')||0)
  if(!Number.isFinite(declared)||declared>max)throw invalid('Render request too large')
  const reader=request.body?.getReader()
  if(!reader)throw invalid('Missing render request')
  const chunks:Uint8Array[]=[]
  let total=0
  while(true){
    const part=await reader.read()
    if(part.done)break
    total+=part.value.byteLength
    if(total>max){
      await reader.cancel()
      throw invalid('Render request too large')
    }
    chunks.push(part.value)
  }
  try{
    const buffer=Buffer.concat(chunks.map(x=>Buffer.from(x)))
    const body=JSON.parse(buffer.toString('utf8')) as unknown
    if(!body||typeof body!=='object'||Array.isArray(body))
      throw invalid('Invalid render request')
    return body as Record<string,unknown>
  }catch{throw invalid('Invalid render JSON')}
}
const privateWorkerAddress=(address:URL):boolean=>{
  const host=address.hostname.toLowerCase()
  const service=/^[a-z][a-z0-9-]{1,62}$/.test(host)&&host!=='localhost'
  const parts=host.split('.')
  const ipv4=parts.length===4&&parts.every(p=>p.length>0&&p.length<=3&&
    [...p].every(ch=>ch>='0'&&ch<='9')&&Number(p)<=255)
  const nums=parts.map(Number)
  const ip=ipv4&&(nums[0]===10||
    (nums[0]===192&&nums[1]===168)||
    (nums[0]===172&&nums[1]>=16&&nums[1]<=31)||
    (nums[0]===100&&nums[1]>=64&&nums[1]<=127))
  return address.protocol==='http:'&&!address.username&&!address.password&&
    address.pathname==='/'&&!address.search&&!address.hash&&(service||ip)
}

/** Job-scoped authenticated producer submission; never exposes the private worker address. */
export async function POST(request:Request,ctx:Ctx){
  try{
    const {id}=await ctx.params
    const job=await requireBotJob(id,request)
    if(['complete','failed','cancelled','dispatch_failed'].includes(job.status))
      throw new MotionStudioError('CONFLICT','Render assignment is already closed.',409)
    const body=await boundedJson(request)
    const bundle=body.bundle
    const frames=body.segmentFrames??150
    if(typeof bundle!=='string'||!/^[A-Za-z0-9_.-]{1,120}\.zip$/.test(bundle)||
       typeof frames!=='number'||!Number.isSafeInteger(frames)||frames<1||frames>600||
       (body.benchmarkOnly!==undefined&&typeof body.benchmarkOnly!=='boolean'))
      throw invalid('Invalid render request')
    const artifacts=Array.isArray(job.artifacts)?job.artifacts as Artifact[]:[]
    if(!artifacts.some(a=>a.filename===bundle&&a.state==='ready'&&
       ['project','bundle'].includes(a.kind||'')&&typeof a.key==='string'))
      throw new MotionStudioError('CONFLICT','Render bundle must be uploaded before submission.',409)
    const configured=process.env.RENDER_WORKER_URL
    const secret=process.env.RENDER_HOST_SECRET
    if(!configured||!secret||secret.length<32)
      throw new MotionStudioError('INTERNAL','Private render worker is not configured.',503)
    const upstream=new URL(configured)
    // Only an internal HTTP address is accepted. Never route to a public domain.
    if(!privateWorkerAddress(upstream))
      throw new MotionStudioError('INTERNAL','Private render worker address is invalid.',503)
    const auth=request.headers.get('authorization')||''
    const token=auth.startsWith('Bearer ')?auth.slice(7):''
    if(!token)throw new MotionStudioError('UNAUTHENTICATED','Producer token missing.',401)
    const origin=process.env.MOTION_STUDIO_AGENT_PUBLIC_URL||'https://transovo.ai'
    const trusted=new URL(origin)
    if(trusted.protocol!=='https:'||trusted.hostname!=='transovo.ai'||
       trusted.username||trusted.password)
      throw new MotionStudioError('INTERNAL','Public job API must use https://transovo.ai.',503)
    const endpoint=new URL('/api/motion-studio/agent/jobs/'+encodeURIComponent(id),trusted.origin)
    const timeout=AbortSignal.timeout(25000)
    let response:Response
    try{
      response=await fetch(new URL('/enqueue',upstream),{
        method:'POST',signal:timeout,redirect:'error',cache:'no-store',
        headers:{'Content-Type':'application/json','X-Render-Host-Secret':secret},
        body:JSON.stringify({jobId:id,jobUrl:endpoint.href,token,
          segmentFrames:frames,bundle,benchmarkOnly:body.benchmarkOnly===true}),
      })
    }catch{
      throw new MotionStudioError('INTERNAL','Private render worker unavailable.',503)
    }
    if(!response.ok){
      // Do not forward internal responses, tokens or worker diagnostics.
      throw new MotionStudioError('INTERNAL',
        response.status===409?'Render assignment is already closed.':'Private render worker refused the job.',
        response.status===409?409:503)
    }
    const result=await response.json() as Record<string,unknown>
    if(result.jobId!==id||result.queued!==true)
      throw new MotionStudioError('INTERNAL','Unexpected render worker acknowledgement.',503)
    return NextResponse.json({jobId:id,backend:'self_hosted',queued:true,
      alreadyExists:result.alreadyExists===true,stage:result.stage||'queued'},
      {headers:{'Cache-Control':'private, no-store'}})
  }catch(error){return motionStudioJsonError(error)}
}

/** Operator/producer job-scoped status probe to make uncertain submissions safe. */
export async function GET(request:Request,ctx:Ctx){
  try{
    const {id}=await ctx.params
    await requireBotJob(id,request)
    const configured=process.env.RENDER_WORKER_URL
    const secret=process.env.RENDER_HOST_SECRET
    if(!configured||!secret||secret.length<32)
      throw new MotionStudioError('INTERNAL','Private render worker is not configured.',503)
    const worker=new URL(configured)
    if(!privateWorkerAddress(worker))
      throw new MotionStudioError('INTERNAL','Private render worker address is invalid.',503)
    let response:Response
    try{
      response=await fetch(new URL('/jobs/'+encodeURIComponent(id),worker),{
        headers:{'X-Render-Host-Secret':secret},cache:'no-store',redirect:'error',
        signal:AbortSignal.timeout(25000),
      })
    }catch{
      throw new MotionStudioError('INTERNAL','Private render worker unavailable.',503)
    }
    if(!response.ok)throw new MotionStudioError('INTERNAL','Private worker status unavailable.',503)
    const raw=await response.json() as Record<string,unknown>
    const stage=typeof raw.stage==='string'?raw.stage:'unknown'
    const allowed=['unknown','queued','running','rendering','qa_pass','qa_fail',
                   'uploaded','completed','failed','cancelled']
    if(raw.jobId!==id||!allowed.includes(stage))
      throw new MotionStudioError('INTERNAL','Invalid private render status.',503)
    return NextResponse.json({jobId:id,backend:'self_hosted',stage,
       queuePosition:typeof raw.position==='number'?raw.position:null},
      {headers:{'Cache-Control':'private, no-store'}})
  }catch(error){return motionStudioJsonError(error)}
}
