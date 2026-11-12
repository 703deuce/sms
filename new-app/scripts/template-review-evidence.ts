#!/usr/bin/env node
import { existsSync,mkdirSync,readFileSync,renameSync,rmSync,writeFileSync } from 'node:fs'
import { dirname,resolve } from 'node:path'
import { applyTemplateHumanReviewsForCandidates,type TemplateHumanReview } from '../lib/clips/real-video-templates/review-evidence'
import { generateB8Candidates,type B8Candidate,type B8Evidence } from '../lib/clips/real-video-templates/b8-factory'
import {
  batch9PhaseAAnchorCandidates,batch9PhaseAAnchorGate,batch9PhaseBExpansionCandidates,
  batch9PhaseBReleaseGate,
} from '../lib/clips/real-video-templates/batch9-phase-b'

const args=process.argv.slice(2)
const value=(name:string,fallback:string)=>{
  const i=args.indexOf(name)
  return i>=0&&args[i+1]?args[i+1]!:fallback
}
const scope=value('--scope','batch8')
if(!['batch8','batch9a','batch9b'].includes(scope))
  throw new Error('--scope must be batch8, batch9a, or batch9b')
const root=scope==='batch8'?'b8':scope==='batch9a'?'b9a':'b9b'
const evidencePath=resolve(process.cwd(),value('--evidence','build/real-video-templates/'+root+'/evidence.json'))
const reviewsPath=resolve(process.cwd(),value('--reviews','build/real-video-templates/'+root+'/human-reviews.json'))
const candidates:readonly B8Candidate[]=scope==='batch8'?generateB8Candidates():
  scope==='batch9a'?batch9PhaseAAnchorCandidates():batch9PhaseBExpansionCandidates()
if(!existsSync(evidencePath))throw new Error('Missing machine evidence: '+evidencePath)
if(!existsSync(reviewsPath))throw new Error('Missing human review file: '+reviewsPath)
const evidence=JSON.parse(readFileSync(evidencePath,'utf8')) as B8Evidence[]
const payload=JSON.parse(readFileSync(reviewsPath,'utf8')) as {v:number;reviews:TemplateHumanReview[]}
if(payload.v!==1||!Array.isArray(payload.reviews))throw new Error('Human review file must be {v:1,reviews:[...]}')
const result=applyTemplateHumanReviewsForCandidates(evidence,payload.reviews,candidates)
if(result.rejected.length){
  console.error(JSON.stringify({rejected:result.rejected},null,2))
  process.exitCode=1
}else{
  mkdirSync(dirname(evidencePath),{recursive:true})
  const temp=evidencePath+'.tmp-'+process.pid
  try{
    writeFileSync(temp,JSON.stringify(result.evidence,null,2)+'\n','utf8')
    renameSync(temp,evidencePath)
  }finally{rmSync(temp,{force:true})}
  let gateReady:boolean|undefined
  let gateDetail:unknown
  if(scope==='batch9a'){
    gateDetail=batch9PhaseAAnchorGate(result.evidence)
    gateReady=(gateDetail as {ready:boolean}).ready
  }else if(scope==='batch9b'){
    const phaseAPath=value('--phase-a-evidence','build/real-video-templates/b9a/evidence.json')
    const phaseA=existsSync(resolve(process.cwd(),phaseAPath))
      ? JSON.parse(readFileSync(resolve(process.cwd(),phaseAPath),'utf8')) as B8Evidence[]:[]
    gateDetail=batch9PhaseBReleaseGate([...phaseA,...result.evidence])
    gateReady=(gateDetail as {ready:boolean}).ready
  }
  console.log(JSON.stringify({scope,reviewed:result.reviewed,
    evidencePassing:result.evidencePassing,releaseEligible:result.releaseEligible,
    ...(gateReady==null?{}:{gateReady,gateDetail})},null,2))
}
