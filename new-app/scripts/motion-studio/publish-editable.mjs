// Publish from an existing durable producer export. Re-running this command
// with the same package never invokes the creative agent or a render engine.
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { openAsBlob } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { uploadPrepared } from './run-leased-render.mjs'

async function retry(action) {
  for (let attempt=0;;attempt++) {
    try { return await action() } catch (error) {
      const status=error.status ?? Number(/HTTP (\d+)/.exec(error.message)?.[1])
      if (attempt>=3 || (status>=400 && status<500 && ![408,429].includes(status))) throw error
      await delay(300*2**attempt)
    }
  }
}

export async function publishEditable({directory,bundles,jobUrl,token,sourceJobId,complete=false}) {
  const endpoint=new URL(jobUrl)
  if (endpoint.protocol!=='https:' || !token) throw new Error('HTTPS job URL and job credential required')
  const api=async (suffix,body) => {
    const response=await fetch(endpoint.href+suffix,{method:body?'POST':'GET',redirect:'error',
      headers:{authorization:'Bearer '+token,'content-type':'application/json'},
      body:body?JSON.stringify(body):undefined})
    if (!response.ok) throw Object.assign(new Error('Producer request failed (HTTP '+response.status+')'),{status:response.status})
    return response.json()
  }
  const pkg=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'))
  if (pkg.schema!=='transovo.motion-package/1' || !Array.isArray(bundles)) throw new Error('Invalid producer export')
  const entries=Object.entries(pkg.assets)
  const records=[]
  const key=a=>JSON.stringify([a.sha256,a.kind,a.filename,a.bytes,a.mime])
  const ready=await retry(()=>api('/assets',{action:'receipts',sourceJobId}))
  const receipts=new Map(ready.receipts.map(a=>[key(a),a.id]))
  let next=0, completed=0, failure
  const progress=()=>api('/progress',{stage:'delivering',message:'Uploading editable files: '+completed+' / '+entries.length})
  let reported=0
  // Serialize telemetry: a slower earlier request must not overwrite a later count.
  let reporting=Promise.resolve()
  const report=()=>{reporting=reporting.then(async()=>{
    if (reported===completed) return
    reported=completed
    await progress().catch(()=>{})
  })}
  await retry(progress)
  const heartbeat=setInterval(()=>api('/checkpoint').catch(()=>{}),60000)
  try {
    async function upload([id,a]) {
      if (!/^[a-f0-9]{64}$/.test(a.sha256)) throw new Error('Invalid package digest')
      const mime=/^(text\/(html|x-python|x-shellscript|markdown|vtt))$/.test(a.mime)?'text/plain':a.mime
      const meta={...a,mime,kind:id.startsWith('bnd_')?'bundle':id.startsWith('fnt_')?'font':a.kind,
        filename:String(a.filename || id).slice(0,150).replace(/[^a-zA-Z0-9._-]/g,'_')}
      let storageId=receipts.get(key(meta))
      if (!storageId) {
        const blob=await openAsBlob(path.join(directory,'blobs',a.sha256),{type:a.mime})
        if (blob.size!==a.bytes) throw new Error('Package file size changed')
        storageId=await retry(async()=>{
          const prepared=await api('/assets',{action:'prepare',resume:true,kind:meta.kind,
            filename:meta.filename,mime:meta.mime,bytes:a.bytes,sha256:a.sha256})
          if (!prepared.exists) {
            const parts=await uploadPrepared(prepared,blob,meta.mime)
            await retry(()=>api('/assets',{action:'commit',uploadId:prepared.uploadId,parts}))
          }
          return prepared.uploadId
        })
      }
      records.push({id,storageId,kind:meta.kind,sha256:a.sha256})
      completed++
      report()
      return storageId
    }
    const masterId=pkg.document.master.asset
    const master=entries.find(([id])=>id===masterId)
    if (!master) throw new Error('Approved package has no master')
    const storageId=await upload(master)
    await retry(()=>api('/assets',{action:'approveMaster',uploadId:storageId,sourceJobId}))
    const others=entries.filter(([id])=>id!==masterId)
    await Promise.all(Array.from({length:Math.min(8,others.length)},async()=>{
      while (!failure && next<others.length) {
        try { await upload(others[next++]) } catch(error) { failure=error }
      }
    }))
    await reporting
    if (failure) throw failure
    records.sort((a,b)=>a.id.localeCompare(b.id))
    const version=await retry(()=>api('/portable',{document:pkg.document,assets:records,bundles}))
    if (complete) {
      const {stdout}=await promisify(execFile)('ffprobe',['-v','error','-show_entries','format=duration',
        '-of','default=nw=1:nk=1',path.join(directory,'blobs',master[1].sha256)])
      const durationMs=Math.round(Number(stdout)*1000)
      if (!Number.isSafeInteger(durationMs) || durationMs<=0) throw new Error('Invalid approved master duration')
      await retry(()=>api('/complete',{durationMs}))
    }
    return version
  } finally {clearInterval(heartbeat)}
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [directory,metadata]=process.argv.slice(2)
  if (!directory || !metadata) throw new Error('Expected a durable package directory and bundle metadata JSON file')
  const result=await publishEditable({directory,bundles:JSON.parse(await readFile(metadata,'utf8')),
    jobUrl:process.env.MOTION_STUDIO_JOB_URL,token:process.env.MOTION_STUDIO_JOB_TOKEN,
    sourceJobId:process.env.MOTION_STUDIO_RECOVERY_SOURCE_JOB,complete:process.argv[4]==='--complete'})
  console.log('Published editable version '+result.id)
}
