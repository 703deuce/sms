import test from 'node:test'
import assert from 'node:assert/strict'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runLeasedRender, uploadPrepared } from './run-leased-render.mjs'

test('storage parts require a receipt before commit', async t => {
  const chunks = []
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    chunks.push(await init.body.text())
    return new Response('', { headers: { etag: 'part-' + chunks.length } })
  })
  const parts = await uploadPrepared({ mode: 's3_multipart', s3Multipart: { partSize: 3,
    partUrls: [{ partNumber: 1, url: 'https://storage/1' }, { partNumber: 2, url: 'https://storage/2' }] } },
    new Blob(['abcdef']), 'text/plain')
  assert.deepEqual(chunks, ['abc', 'def'])
  assert.deepEqual(parts.map(p => p.etag), ['part-1', 'part-2'])
})

test('producer reassembles a playable MP4 and publishes v2 from a cold worker',
  { skip: !process.env.MOTION_STUDIO_PRODUCER_KIT }, async t => {
    const dir = await mkdtemp(path.join(tmpdir(), 'motion-proof-'))
    t.after(() => rm(dir, { recursive: true, force: true }))
    const run = promisify(execFile)
    const sourceFile = path.join(dir, 'original.mp4')
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=blue:s=96x64:r=10:d=1',
      '-f', 'lavfi', '-i', 'sine=frequency=300:duration=1', '-c:v', 'libx264', '-c:a', 'aac', sourceFile])
    const data = new Map()
    const sources = []
    function add(bytes, kind, mime) {
      const sha256 = createHash('sha256').update(bytes).digest('hex')
      const id = (kind === 'bundle' ? 'bnd_' : 'ast_') + sha256.slice(0, 32)
      data.set(id, bytes)
      sources.push({ id, storageId: 'stored' + sources.length, sha256, kind, mime, bytes: bytes.length })
      return id
    }
    const film = add(await readFile(sourceFile), 'video', 'video/mp4')
    const bundle = add(Buffer.from(JSON.stringify({files:{},engine:'clip'})), 'bundle', 'application/json')
    const format = {width:96,height:64,fps:10}
    const recipe = add(Buffer.from(JSON.stringify({format,totalFrames:10,encode:{crf:20},
      segments:[{id:'seg', source:{scene:'S01'}}],audio:{asset:film},themeBindings:{fade:'colors.primary'},
      post:[{f:'fade',t:'in',s:0,n:6,color:'$fade'}]})), 'project', 'application/json')
    const projectId = 'lease_proof'
    const document = {schema:'transovo.motion-project/1',projectId,version:1,parentVersion:null,
      createdAt:new Date().toISOString(),createdBy:{mode:'creative_production'},format,
      theme:{schema:'transovo.motion-theme/1',colors:{primary:'#000000'},fonts:{}},
      overrides:{schema:'transovo.edit-patch/1'},scenes:[{sceneId:'S01',bundle,editable:false,timeline:{},
        clip:{asset:film,renderKey:'old'}}],master:{asset:film,recipe,renderKey:'old'},assetRefs:[film,recipe,bundle]}
    const input = {schema:'transovo.motion-job/1',mode:'deterministic_render',projectId,baseVersion:1,
      edits:{schema:'transovo.edit-patch/1',theme:{colors:{primary:'#ffffff'}}},output:{master:true,previews:true}}
    const job = {id:'job1',versionId:'v1',projectId,input,producerDocument:document,sources,bundles:[],
      assetUrls:Object.fromEntries(sources.map(a=>[a.storageId,'https://storage.test/'+a.id]))}
    const json = value => Response.json(value)
    let master, complete, committed = false
    t.mock.method(globalThis,'fetch',async (target, options={})=>{
      const url = new URL(target)
      if(url.host === 'storage.test') {
        assert.equal(options.headers?.authorization, undefined)
        if(options.method === 'PUT') {
          master = Buffer.from(await options.body.arrayBuffer())
          return new Response(null,{status:200})
        }
        return new Response(data.get(url.pathname.slice(1)))
      }
      assert.equal(options.headers.authorization,'Bearer test-worker')
      const body = options.body && JSON.parse(options.body)
      if(!body) return json(job)
      assert.equal(body.leaseId,'lease1')
      if(body.action==='prepare') return json({mode:'signed_put',uploadId:'newMaster',signedPut:{url:'https://storage.test/output'}})
      if(body.action==='commit') {assert.ok(master); committed=true; return json({status:'ready'})}
      if(body.status==='complete'){assert.ok(committed);complete=body}
      return json({ok:true})
    })
    await runLeasedRender({action:'motion_studio_deterministic_render',workerId:'bot4',renderJobId:job.id,
      leaseId:'lease1',versionId:'v1'}, {origin:'https://app.test',workerId:'bot4',credential:'test-worker',
      kitRoot:process.env.MOTION_STUDIO_PRODUCER_KIT})
    assert.equal(complete.document.version,2)
    assert.equal(complete.document.parentVersion,1)
    assert.equal(document.theme.colors.primary,'#000000')
    assert.equal(complete.document.theme.colors.primary,'#ffffff')
    assert.equal(complete.document.scenes[0].clip.asset,film)
    assert.notEqual(complete.document.master.asset,film)
    assert.equal(complete.assets.find(a=>a.id===complete.document.master.asset).storageId,'newMaster')
    await writeFile(path.join(dir,'result.mp4'),master)
    await run('ffmpeg',['-v','error','-i',path.join(dir,'result.mp4'),'-f','null','-'])
    assert.ok(complete.durationMs >= 900 && complete.durationMs < 1200)
  })
