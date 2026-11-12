/**
 * Batch 8 full-frame render QA math. The CLI supplies decoded RGB/audio bytes
 * from actual FFmpeg output; this module only computes deterministic metrics.
 */
export const B8_RENDER_QA_REVISION = 'b8-full-frame-v2' as const

export type B8FrameQA = {
  revision: typeof B8_RENDER_QA_REVISION
  expectedFrames: number
  previewFrames: number
  renderFrames: number
  checkedFrameCount: number
  durationMatch: boolean
  fullFrameParity: boolean
  maxFrameDifference: number
  p95FrameDifference: number
  blackFrames: number[]
  flashFrames: number[]
  firstLastNotBlack: boolean
  boundariesNotBlack: boolean
  noExcessFlashing: boolean
}

const finitePositiveInt=(n:number)=>Number.isInteger(n)&&n>0
const percentile=(values:number[],p:number)=>{
  if(!values.length)return Number.POSITIVE_INFINITY
  const sorted=[...values].sort((a,b)=>a-b)
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1))]!
}
function frameLuma(bytes:Uint8Array,offset:number,frameBytes:number):number{
  let total=0,pixels=0
  for(let i=offset;i<offset+frameBytes;i+=3){
    total+=bytes[i]!*0.2126+bytes[i+1]!*0.7152+bytes[i+2]!*0.0722
    pixels++
  }
  return pixels?total/pixels:0
}
function frameDifference(a:Uint8Array,b:Uint8Array,offset:number,frameBytes:number):number{
  let total=0
  for(let i=offset;i<offset+frameBytes;i++)total+=Math.abs(a[i]!-b[i]!)
  return frameBytes?total/frameBytes:Number.POSITIVE_INFINITY
}
export function summarizeB8FrameQA(input:{
  previewRgb:Uint8Array
  renderRgb:Uint8Array
  width:number
  height:number
  expectedFrames:number
  boundaryFrames?:readonly number[]
  blackLumaThreshold?:number
  parityP95Threshold?:number
  parityMaxThreshold?:number
  flashDeltaThreshold?:number
}):B8FrameQA{
  const {previewRgb,renderRgb}=input
  if(!finitePositiveInt(input.width)||!finitePositiveInt(input.height)||
     !finitePositiveInt(input.expectedFrames))
    throw new Error('Invalid full-frame QA geometry')
  const frameBytes=input.width*input.height*3
  if(previewRgb.length%frameBytes||renderRgb.length%frameBytes)
    throw new Error('Decoded RGB stream is not frame-aligned')
  const previewFrames=previewRgb.length/frameBytes
  const renderFrames=renderRgb.length/frameBytes
  const checkedFrameCount=Math.min(previewFrames,renderFrames,input.expectedFrames)
  const blackThreshold=input.blackLumaThreshold??7
  const p95Threshold=input.parityP95Threshold??12
  const maxThreshold=input.parityMaxThreshold??28
  const flashThreshold=input.flashDeltaThreshold??80
  const black=new Set<number>(),flash=new Set<number>()
  const differences:number[]=[],renderLuma:number[]=[]
  for(let frame=0;frame<checkedFrameCount;frame++){
    const offset=frame*frameBytes
    differences.push(frameDifference(previewRgb,renderRgb,offset,frameBytes))
    const p=frameLuma(previewRgb,offset,frameBytes)
    const r=frameLuma(renderRgb,offset,frameBytes)
    renderLuma.push(r)
    if(p<=blackThreshold||r<=blackThreshold)black.add(frame)
  }
  for(let i=2;i<renderLuma.length;i++){
    const a=renderLuma[i-1]!-renderLuma[i-2]!
    const b=renderLuma[i]!-renderLuma[i-1]!
    if(Math.abs(a)>=flashThreshold&&Math.abs(b)>=flashThreshold&&Math.sign(a)!==Math.sign(b))
      flash.add(i-1)
  }
  const maxFrameDifference=differences.length?Math.max(...differences):Number.POSITIVE_INFINITY
  const p95FrameDifference=percentile(differences,.95)
  const durationMatch=previewFrames===input.expectedFrames&&
    renderFrames===input.expectedFrames
  const fullFrameParity=durationMatch&&checkedFrameCount===input.expectedFrames&&
    p95FrameDifference<=p95Threshold&&maxFrameDifference<=maxThreshold
  const firstLast=[0,input.expectedFrames-1].filter(frame=>frame<checkedFrameCount)
  const boundaries=[...new Set(input.boundaryFrames??[])].filter(frame=>frame>=0&&frame<checkedFrameCount)
  return {
    revision:B8_RENDER_QA_REVISION,
    expectedFrames:input.expectedFrames,previewFrames,renderFrames,checkedFrameCount,
    durationMatch,fullFrameParity,maxFrameDifference,p95FrameDifference,
    blackFrames:[...black],flashFrames:[...flash],
    firstLastNotBlack:firstLast.length===2&&firstLast.every(frame=>!black.has(frame)),
    boundariesNotBlack:boundaries.every(frame=>!black.has(frame)&&
      (frame===0||!black.has(frame-1))),
    noExcessFlashing:flash.size===0,
  }
}

export type B8AudioQA = {
  previewWindows:number
  renderWindows:number
  envelopeDifference:number
  contentParity:boolean
}
export function summarizeB8AudioEnvelopeQA(
  preview:readonly number[],render:readonly number[],threshold=.14,
):B8AudioQA{
  if(!preview.length||!render.length||!Number.isFinite(threshold)||threshold<=0)
    return {previewWindows:preview.length,renderWindows:render.length,
      envelopeDifference:Number.POSITIVE_INFINITY,contentParity:false}
  const count=Math.min(preview.length,render.length)
  const pScale=Math.max(...preview.slice(0,count),1)
  const rScale=Math.max(...render.slice(0,count),1)
  let total=0
  for(let i=0;i<count;i++)total+=Math.abs(preview[i]!/pScale-render[i]!/rScale)
  const difference=total/count
  return {
    previewWindows:preview.length,renderWindows:render.length,
    envelopeDifference:difference,
    contentParity:Math.abs(preview.length-render.length)<=1&&difference<=threshold,
  }
}
