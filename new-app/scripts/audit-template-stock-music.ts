#!/usr/bin/env node
/**
 * Audit source evidence, bytes and duration for first-party template soundtrack
 * candidates. No license claims are inferred from stock search labels.
 * Output is a PROPOSAL, never automatically imported into runtime releases.
 */
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import type { TemplateAudioAssetLicense } from '../lib/clips/real-video-templates/music-license-manifest'

type StockApproval = {
  id:string
  localFile:string
  rightsProofFile:string
  rightsProofSha256:string
  origin:string
  author:string
  license:string
  revision:string
  commercialUse:boolean
  exportAllowed:boolean
  redistributionAllowed:boolean
  attribution?:string
  humanReviewer:string
  reviewedAt:string
}
const root=resolve(process.cwd(),'public')
const input=resolve(process.cwd(),process.argv[2]??'build/real-video-templates/b8/stock-audit-input.json')
const output=resolve(process.cwd(),process.argv[3]??'build/real-video-templates/b8/stock-audit.proposed.json')
const HASH=/^[a-f0-9]{64}$/i
function localUrl(raw:string):string{
  if(typeof raw!=='string'||!/^\/(?!\/)[\w./-]+$/.test(raw)||raw.includes('..'))
    throw new Error('Expected a local, nontraversal /public file path')
  const file=resolve(root,'.'+raw)
  if(!file.startsWith(root+sep)||!existsSync(file))throw new Error('Missing pinned file: '+raw)
  return file
}
async function hash(file:string):Promise<string>{
  const h=createHash('sha256')
  for await(const chunk of createReadStream(file))h.update(chunk)
  return h.digest('hex')
}
function durationFrames(file:string):number{
  const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration',
    '-of','default=noprint_wrappers=1:nokey=1',file],{
    encoding:'utf8',timeout:30000,maxBuffer:4096,
  })
  const seconds=Number(probe.stdout?.trim())
  if(probe.status!==0||!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Audio does not have a verified decodable duration')
  return Math.round(seconds*30)
}
async function run(){
  if(!existsSync(input))throw new Error('No candidate rights-provenance input: '+input)
  const records=JSON.parse(readFileSync(input,'utf8')) as StockApproval[]
  if(!Array.isArray(records)||!records.length)throw new Error('No stock music evidence to audit')
  const ids=new Set<string>(),manifest:TemplateAudioAssetLicense[]=[]
  for(const row of records){
    if(!row||!/^[A-Za-z0-9_-]{2,80}$/.test(row.id)||ids.has(row.id)||
       !/^https:\/\//.test(row.origin)||!row.author?.trim()||
       !row.license?.trim()||!row.revision?.trim()||
       !row.commercialUse||!row.exportAllowed||
       !row.humanReviewer?.trim()||!/^20\d\d-\d\d-\d\d$/.test(row.reviewedAt)||
       !HASH.test(row.rightsProofSha256))
      throw new Error('Rights review or pinned source missing for '+row?.id)
    ids.add(row.id)
    const proof=await hash(localUrl(row.rightsProofFile))
    if(proof!==row.rightsProofSha256.toLowerCase())
      throw new Error('Rights source document changed: '+row.id)
    const file=localUrl(row.localFile)
    manifest.push({
      id:row.id,kind:'music',origin:row.origin,author:row.author,
      license:row.license,revision:row.revision,
      sha256:await hash(file),verifiedDurationFrames:durationFrames(file),
      commercialUse:true,exportAllowed:true,
      redistributionAllowed:row.redistributionAllowed===true,
      attribution:row.attribution?.trim()||null,status:'verified',
    })
  }
  mkdirSync(dirname(output),{recursive:true})
  writeFileSync(output,JSON.stringify(manifest,null,2)+'\n')
  console.log('Prepared '+manifest.length+' content-hash-pinned first-party stock music records.')
  console.log('Coordinator must separately confirm evidence and update stock-music-approved.json.')
}
void run().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1})
