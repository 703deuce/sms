import {NextResponse} from 'next/server'

/** Best-effort browser milestones in the same Coolify runtime log as scene-host timings.
 * No signed URLs, scene contents, credentials or IP addresses are logged.
 */
export async function POST(request:Request){
  const origin=request.headers.get('origin')
  // Coolify/Traefik may expose an internal request.url to Next.js. Compare
  // against the trusted reverse-proxy public host, not 0.0.0.0:3000.
  const host=(request.headers.get('x-forwarded-host')||
    request.headers.get('host')||'').split(',')[0]?.trim()
  const proto=(request.headers.get('x-forwarded-proto')||
    new URL(request.url).protocol.slice(0,-1)).split(',')[0]?.trim()
  const expected=host&&proto==='https'?'https://'+host:new URL(request.url).origin
  if(!origin||origin!==expected)
    return NextResponse.json({error:'origin mismatch'},{status:403})
  const length=Number(request.headers.get('content-length')||'0')
  if(length>2048)return NextResponse.json({error:'payload too large'},{status:413})
  let data:unknown
  try{data=await request.json()}catch{return NextResponse.json({error:'invalid json'},{status:400})}
  if(!data||typeof data!=='object'||Array.isArray(data))
    return NextResponse.json({error:'invalid payload'},{status:400})
  const x=data as Record<string,unknown>
  const stage=typeof x.stage==='string'?x.stage:''
  const allowed=new Set(['project-mounted','project-response','session-request','session-response','scene-ready','first-frame-drawn','first-frame-visible'])
  if(!allowed.has(stage))return NextResponse.json({error:'invalid milestone'},{status:400})
  const ms=typeof x.elapsedMs==='number'&&Number.isFinite(x.elapsedMs)?
    Math.max(0,Math.min(120000,Math.round(x.elapsedMs))):null
  const requestMs=typeof x.requestMs==='number'&&Number.isFinite(x.requestMs)?
    Math.max(0,Math.min(120000,Math.round(x.requestMs))):null
  const projectId=typeof x.projectId==='string'&&/^msp_[A-Za-z0-9]{8,64}$/.test(x.projectId)?x.projectId:'unknown'
  console.info('[motion-studio:load]',{
    kind:'browser-milestone',projectId,stage,elapsedMs:ms,
    ...(requestMs!==null?{requestMs}:{}),
  })
  return new NextResponse(null,{status:204})
}
