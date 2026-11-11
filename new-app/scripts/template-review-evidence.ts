#!/usr/bin/env node
import { existsSync,mkdirSync,readFileSync,renameSync,rmSync,writeFileSync } from 'node:fs'
import { dirname,resolve } from 'node:path'
import { applyTemplateHumanReviews,type TemplateHumanReview } from '../lib/clips/real-video-templates/review-evidence'
import type { B8Evidence } from '../lib/clips/real-video-templates/b8-factory'

const args=process.argv.slice(2)
const value=(name:string,fallback:string)=>{
  const i=args.indexOf(name)
  return i>=0&&args[i+1]?args[i+1]!:fallback
}
const evidencePath=resolve(process.cwd(),value('--evidence','build/real-video-templates/b8/evidence.json'))
const reviewsPath=resolve(process.cwd(),value('--reviews','build/real-video-templates/b8/human-reviews.json'))
if(!existsSync(evidencePath))throw new Error('Missing machine evidence: '+evidencePath)
if(!existsSync(reviewsPath))throw new Error('Missing human review file: '+reviewsPath)
const evidence=JSON.parse(readFileSync(evidencePath,'utf8')) as B8Evidence[]
const payload=JSON.parse(readFileSync(reviewsPath,'utf8')) as {v:number;reviews:TemplateHumanReview[]}
if(payload.v!==1||!Array.isArray(payload.reviews))throw new Error('Human review file must be {v:1,reviews:[...]}')
const result=applyTemplateHumanReviews(evidence,payload.reviews)
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
  console.log(JSON.stringify({reviewed:result.reviewed,fullyPassing:result.fullyPassing},null,2))
}
