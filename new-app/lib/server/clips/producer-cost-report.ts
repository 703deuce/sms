import 'server-only'
const number=(v:unknown,max=1e9)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max?v:0
const label=(v:unknown,max=80)=>typeof v==='string'&&/^[a-zA-Z0-9 _.:+-]+$/.test(v)&&v.length<=max?v:''
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const date=(v:unknown)=>typeof v==='string'&&v.length<=40&&!Number.isNaN(Date.parse(v))
  ?new Date(v).toISOString():null
const usage=(v:unknown)=>{const x=object(v);return {
  percent:number(x.percent,100),tokens:number(x.tokens,1e12),costUsd:number(x.costUsd,1e7),
}}
/** Allowlists only numeric/time/label fields. Never persists URLs, paths, tokens or free text. */
export function normalizeProducerCostReport(raw:unknown,jobId:string){
  const r=object(raw)
  if(r.schema!=='transovo.clip-job-report/1'||r.jobId!==jobId)throw new Error('Invalid job report identity')
  const startedAt=date(r.startedAt),finishedAt=date(r.finishedAt)
  if(!startedAt||!finishedAt||Date.parse(finishedAt)<Date.parse(startedAt))
    throw new Error('Invalid job report timestamps')
  if(!Array.isArray(r.steps)||!Array.isArray(r.clips)||r.steps.length>200||r.clips.length>15)
    throw new Error('Invalid job report steps or clips')
  return {schema:'transovo.clip-job-report/1',jobId,startedAt,finishedAt,
    wallMs:number(r.wallMs,24*60*60_000),
    steps:r.steps.map(value=>{const x=object(value);return {
      name:label(x.name),ms:number(x.ms,24*60*60_000),provider:label(x.provider),
      paidUsd:number(x.paidUsd,1e7),units:number(x.units,1e12),
    }}),
    clips:r.clips.map(value=>{const x=object(value);return {
      sourceStartMs:number(x.sourceStartMs,24*60*60_000),
      sourceEndMs:number(x.sourceEndMs,24*60*60_000),
      durationMs:number(x.durationMs,600_000),renderMs:number(x.renderMs,24*60*60_000),
      bytes:number(x.bytes,2e9),
    }}),
    paidUsdTotal:number(r.paidUsdTotal,1e7),
    transcriptionUsd:number(r.transcriptionUsd,1e7),
    aiUsage:{start:usage(object(r.aiUsage).start),end:usage(object(r.aiUsage).end)},
  }
}
