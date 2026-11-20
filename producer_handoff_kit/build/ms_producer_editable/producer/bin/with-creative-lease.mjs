// Launch the existing producer command under the job lease. A stable directory
// lets a fresh process discover the approved package after a machine reboot.
import { spawn } from 'node:child_process'
import { mkdir, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'

const [command,...args]=process.argv.slice(2)
const url=new URL(process.env.MOTION_STUDIO_JOB_URL)
const token=process.env.MOTION_STUDIO_JOB_TOKEN
const job=/\/agent\/jobs\/(msaj_[a-zA-Z0-9_-]+)$/.exec(url.pathname)?.[1]
const root=process.env.MOTION_STUDIO_DURABLE_ROOT
if (!command || !token || url.protocol!=='https:' || !job || !root || !path.isAbsolute(root))
  throw new Error('A job assignment, persistent root and producer command are required')
const directory=path.join(root,job)
await mkdir(directory,{recursive:true,mode:0o700})
async function heartbeat() {
  const response=await fetch(url.href+'/checkpoint',{headers:{authorization:'Bearer '+token},
    signal:AbortSignal.timeout(12000),redirect:'error'})
  await response.body?.cancel()
  return response.status
}
const first=await heartbeat()
if (first!==200) throw new Error('Creative assignment unavailable (HTTP '+first+')')
const approved=path.join(directory,'approved')
let resume=true
try { await access(approved) } catch(error) {
  if (error.code!=='ENOENT') throw error
  resume=false
}
const publisher=fileURLToPath(new URL('./publish-editable.mjs',import.meta.url))
const child=spawn(resume?process.execPath:command,resume?
  [publisher,approved,path.join(approved,'bundles.json'),'--complete']:args,{stdio:'inherit',env:{...process.env,MOTION_STUDIO_JOB_DIR:directory}})
const stop=()=>child.kill('SIGTERM')
process.once('SIGTERM',stop)
process.once('SIGINT',stop)
const timer=setInterval(async()=>{
  try {const status=await heartbeat(); if (status===401 || status===403) stop()}
  catch { /* The next heartbeat retries transient network outages. */ }
},60000)
try {
  const [code]=await once(child,'exit')
  process.exitCode=code??1
} finally { clearInterval(timer) }
