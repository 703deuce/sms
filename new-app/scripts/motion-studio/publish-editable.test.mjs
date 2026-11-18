import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { publishEditable } from './publish-editable.mjs'
import { bundleUploads, uploadFramePack, unpackFrame, digest } from '../../../producer_handoff_kit/build/ms_producer_editable/producer/lib/frame-packs.mjs'

test('a scene pack restores every original byte and rejects a damaged frame',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'ms-pack-'))
  t.after(()=>rm(dir,{recursive:true,force:true}))
  const entries=[]
  for (let i=0;i<60;i++) {
    const name='frame'+i+'.png', file=path.join(dir,name)
    await writeFile(file,Buffer.alloc(i+1,i))
    entries.push([name,file])
  }
  const tasks=await bundleUploads(entries)
  assert.equal(tasks.length,1)
  let pack
  const members=await uploadFramePack({uploadBuffer:async data=>{
    pack=data; return {assetId:'pack',sha256:digest(data)}
  }},tasks[0].frames)
  for (let i=0;i<60;i++) assert.deepEqual(unpackFrame(pack,members[entries[i][0]]),Buffer.alloc(i+1,i))
  pack[0]^=255
  assert.throws(()=>unpackFrame(pack,members['frame0.png']),/integrity/)
})

test('an interrupted delivery resumes from committed receipts and publishes only when complete',async t=>{
  const directory=await mkdtemp(path.join(tmpdir(),'ms-resume-'))
  t.after(()=>rm(directory,{recursive:true,force:true}))
  await mkdir(path.join(directory,'blobs'))
  const assets={},ready=new Map(),puts=new Map()
  for (let i=0;i<12;i++){
    const bytes=Buffer.from('source '+i), sha256=digest(bytes)
    assets['id'+i]={sha256,bytes:bytes.length,filename:'file'+i,kind:i?'source':'video',mime:i?'text/plain':'video/mp4'}
    await writeFile(path.join(directory,'blobs',sha256),bytes)
  }
  await writeFile(path.join(directory,'package.json'),JSON.stringify({
    schema:'transovo.motion-package/1',document:{master:{asset:'id0'}},assets}))
  let blocked=true, published=0
  const pending=new Map()
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    if(options.method==='PUT'){
      const id=new URL(url).pathname.slice(1)
      puts.set(id,(puts.get(id)||0)+1)
      return new Response()
    }
    const b=JSON.parse(options.body)
    if(b.action==='receipts')return Response.json({receipts:[...ready.values()]})
    if(b.action==='prepare'){
      if(blocked && b.filename==='file10')return new Response('',{status:409})
      pending.set(b.filename,b)
      return Response.json({uploadId:b.filename,mode:'signed_put',signedPut:{url:'https://storage.test/'+b.filename}})
    }
    if(b.action==='commit') ready.set(b.uploadId,{...pending.get(b.uploadId),id:b.uploadId})
    if(b.action==='approveMaster') assert.ok(ready.has(b.uploadId))
    if(url.endsWith('/portable')){
      assert.equal(b.assets.length,12); published++
    }
    return Response.json({ok:true})
  })
  const args={directory,bundles:[],jobUrl:'https://example.test/jobs/a',token:'test'}
  await assert.rejects(()=>publishEditable(args),/409/)
  assert.equal(published,0)
  assert.ok(ready.size>0)
  blocked=false
  await publishEditable(args)
  assert.equal(published,1)
  assert.equal(puts.size,12)
  assert.ok([...puts.values()].every(n=>n===1))
})

test('an undeclared render cache is refused before transfer; an authored source sequence passes',async t=>{
  const {checkSceneInputs}=await import('./publish-editable.mjs')
  const dir=await mkdtemp(path.join(tmpdir(),'ms-inputs-'))
  t.after(()=>rm(dir,{recursive:true,force:true}))
  await mkdir(path.join(dir,'blobs'))
  const rel='frames/f_00001.png'
  for (const explicit of [false,true]) {
    const bytes=Buffer.from(JSON.stringify({sceneId:'S01',files:{[rel]:{asset:'ast_frame'}},
      authoredFrameInputs:explicit?[rel]:[]}))
    const sha256=digest(bytes)
    await writeFile(path.join(dir,'blobs',sha256),bytes)
    const check=checkSceneInputs({assets:{bnd_scene:{kind:'bundle',sha256},ast_frame:{filename:'f_00001.png'}}},dir)
    if(explicit) await check
    else await assert.rejects(check,/Repackage scene S01/)
  }
})
