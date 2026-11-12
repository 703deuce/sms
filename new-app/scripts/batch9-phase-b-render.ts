#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync,readFileSync } from 'node:fs'
import { dirname,resolve } from 'node:path'

const args=process.argv.slice(2)
const value=(name:string,fallback:string)=>{
  const i=args.indexOf(name)
  return i>=0&&args[i+1]?args[i+1]!:fallback
}
const numberArg=(name:string,fallback:number)=>{
  const n=Number(value(name,String(fallback)))
  if(!Number.isInteger(n)||n<0)throw new Error(name+' must be a non-negative integer')
  return n
}
const evidence=resolve(process.cwd(),value('--evidence','build/real-video-templates/b9a/evidence.json'))
const source=resolve(process.cwd(),value('--source','../build/b8-worker-contract.json'))
const contract=resolve(process.cwd(),value('--contract','../build/b9-phase-b-worker-contract.json'))
const shard=numberArg('--shard',0)
const shards=numberArg('--shards',10)
const limit=numberArg('--limit',0)
if(shards<1||shard>=shards)throw new Error('--shard must be smaller than --shards')
if(!existsSync(evidence))throw new Error('Phase B render requires certified Phase A evidence: '+evidence)
if(!existsSync(source))throw new Error('Phase B render requires the pinned Batch 8 worker fixture contract: '+source)

const contractRun=spawnSync('pnpm',[
  'templates:b9:phase-b:worker-contract',
  '--evidence',evidence,'--source',source,'--out',contract,
],{cwd:process.cwd(),stdio:'inherit'})
if(contractRun.status!==0)process.exit(contractRun.status??1)

const payload=JSON.parse(readFileSync(contract,'utf8')) as {
  v:number;phase:string;designs:Array<{id:string}>
  fixture:{musicFile:string;musicSha:string}
}
if(payload.v!==1||payload.phase!=='batch9-phase-b-live-anchor-v2'||payload.designs.length!==390)
  throw new Error('Refusing to render an incomplete/stale Phase B contract')
const music=resolve(dirname(contract),payload.fixture.musicFile)
if(!existsSync(music))throw new Error('Pinned Phase B soundtrack was not copied beside the contract')
const worker=resolve(process.cwd(),'../worker/scripts/render_batch8_factory_certification.py')
if(!existsSync(worker))throw new Error('Missing shared production worker certification renderer')
const out=resolve(process.cwd(),value('--out','../build/b9-phase-b-renders/shard-'+shard))
const renderArgs=[
  worker,'--contract',contract,'--music',music,'--out',out,
  '--shard',String(shard),'--shards',String(shards),'--production-smoke',
  ...(limit?['--limit',String(limit)]:[]),
]
const rendered=spawnSync('python',renderArgs,{cwd:resolve(process.cwd(),'..'),stdio:'inherit'})
if(rendered.status!==0)process.exit(rendered.status??1)
console.log('Rendered certified-anchor-gated Phase B shard '+shard+'/'+shards+' to '+out)
