#!/usr/bin/env node
import { existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs'
import { dirname,resolve } from 'node:path'
import {
  BATCH9_PHASE_B_VARIANT_TARGET,batch9PhaseAAnchorGate,batch9PhaseBWorkerIds,
} from '../lib/clips/real-video-templates/batch9-phase-b'
import type { B8Evidence } from '../lib/clips/real-video-templates/b8-factory'

const args=process.argv.slice(2)
const value=(name:string,fallback:string)=>{
  const i=args.indexOf(name)
  return i>=0&&args[i+1]?args[i+1]!:fallback
}
const evidencePath=resolve(process.cwd(),value('--evidence','build/real-video-templates/b8/evidence.json'))
const sourcePath=resolve(process.cwd(),value('--source','../build/b8-worker-contract.json'))
const outPath=resolve(process.cwd(),value('--out','../build/b9-phase-b-worker-contract.json'))
if(!existsSync(evidencePath))throw new Error('Phase B worker contract requires Phase A evidence: '+evidencePath)
const evidence=JSON.parse(readFileSync(evidencePath,'utf8')) as B8Evidence[]
const gate=batch9PhaseAAnchorGate(evidence)
if(!gate.ready)throw new Error('Phase B render multiplication blocked until all ten anchors are certified')
const source=JSON.parse(readFileSync(sourcePath,'utf8')) as {
  v:number;engine:string;fps:number;fixture:unknown;designs:Array<{id:string}>
}
if(source.v!==1||source.fps!==30||!Array.isArray(source.designs)||source.designs.length!==2000)
  throw new Error('Expected the complete Batch 8 2,000-design worker contract')
const wanted=new Set(batch9PhaseBWorkerIds())
const designs=source.designs.filter(row=>wanted.has(row.id))
if(designs.length!==BATCH9_PHASE_B_VARIANT_TARGET||
   new Set(designs.map(row=>row.id)).size!==BATCH9_PHASE_B_VARIANT_TARGET)
  throw new Error('Phase B contract did not resolve exactly 390 unique variants')
mkdirSync(dirname(outPath),{recursive:true})
writeFileSync(outPath,JSON.stringify({
  v:1,phase:'batch9-phase-b',sourceEngine:source.engine,fps:source.fps,
  fixture:source.fixture,phaseAAnchorsCertified:true,designs,
},null,2)+'\n')
console.log('Wrote '+designs.length+' certified-anchor-gated Phase B worker rows to '+outPath)
