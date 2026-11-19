// Submit a pre-registered or local private render bundle to isolated Modal.
// Credentials come from the environment only. No paid whole-run retries.
import {createHash} from 'node:crypto'
import {createReadStream} from 'node:fs'
import {openAsBlob} from 'node:fs'
import {stat} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {uploadPrepared} from './run-leased-render.mjs'

const id=process.env.MOTION_JOB_ID||''
const url=process.env.MOTION_JOB_URL||''
const token=process.env.MOTION_JOB_TOKEN||''
const mode=process.env.MOTION_MODE||''
const bundlePath=process.env.MOTION_BUNDLE_PATH||''
const bundleName=process.env.MOTION_BUNDLE_FILENAME||'render_bundle_v1.zip'
const segments=Number(process.env.MOTION_SEGMENT_FRAMES||300)
const estimate=Number(process.env.MOTION_ESTIMATE_USD_MICROS||0)
const app=process.env.MODAL_MOTION_APP_NAME||'transovo-motion-render'
if(!/^[A-Za-z0-9_-]{4,128}$/.test(id)||!url.startsWith('https://')||
   !new URL(url).pathname.endsWith('/jobs/'+id)||!token||
   !['cpu','gpu'].includes(mode)||!Number.isSafeInteger(segments)||segments<1||segments>600||
   !Number.isSafeInteger(estimate)||estimate<=0||
   !/^[A-Za-z0-9_.-]{1,120}\.zip$/.test(bundleName)||
   !process.env.MODAL_TOKEN_ID||!process.env.MODAL_TOKEN_SECRET)
  throw Error('Missing or invalid Modal submission configuration')

const auth={'Authorization':'Bearer '+token,'Content-Type':'application/json'}
async function api(method,suffix='',body=null,params={}){
  const target=new URL(url+suffix)
  for(const [k,v] of Object.entries(params))target.searchParams.set(k,String(v))
  const response=await fetch(target,{method,headers:auth,body:body?JSON.stringify(body):undefined,
    redirect:'error',cache:'no-store'})
  if(!response.ok)throw Error('Job API request failed: '+response.status)
  return response.json()
}
const guard=await api('GET','/modal-budget',null,{estimateUsdMicros:estimate})
if(!guard.allowed)throw Error('Modal monthly guard blocked submission')
if(bundlePath){
  const size=(await stat(bundlePath)).size
  if(size<=0||size>2_000_000_000)throw Error('Render bundle too large')
  const hash=createHash('sha256')
  for await (const block of createReadStream(bundlePath))hash.update(block)
  const prepared=await api('POST','/assets',{action:'prepare',filename:bundleName,
    kind:'project',mime:'application/zip',bytes:size,
    sha256:hash.digest('hex'),resume:true})
  if(!prepared.exists){
    const blob=await openAsBlob(bundlePath,{type:'application/zip'})
    const parts=await uploadPrepared(prepared,blob,'application/zip')
    await api('POST','/assets',{action:'commit',uploadId:prepared.uploadId,parts})
  }
}
const ready=await api('GET','/render-asset',null,{filename:bundleName})
if(!ready.exists)throw Error('The private job render bundle was not registered')
const scriptDir=path.dirname(fileURLToPath(import.meta.url))
const workerDir=path.resolve(scriptDir,'../../../worker')
const child=spawn('python3',['-m','modal_motion.submit'],{
  cwd:workerDir,env:{...process.env,MOTION_JOB_ID:id,MOTION_BUNDLE_FILENAME:bundleName,
    MOTION_MODE:mode,MOTION_SEGMENT_FRAMES:String(segments),
    MOTION_ESTIMATE_USD_MICROS:String(estimate),MODAL_MOTION_APP_NAME:app},
  stdio:['ignore','pipe','pipe']})
let output=''
child.stdout.on('data',d=>{output+=String(d).slice(0,1500)})
const code=await new Promise(resolve=>child.on('close',resolve))
if(code!==0)throw Error('Modal submit failed (details withheld to protect job credentials)')
const item=JSON.parse(output)
if(item.jobId!==id||typeof item.callId!=='string')throw Error('Unexpected Modal response')
console.log(JSON.stringify({jobId:id,callId:item.callId,statusUrl:url+'/render-status'}))
