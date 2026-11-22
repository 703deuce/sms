/** Single source of truth for the producer's requested maximum clips. */
export function requestedProducerClipCount(input:unknown,settings:unknown):number{
  const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
  const request=Number(obj(input).maximumClips)
  const fallback=Number(obj(settings).autoGrokMaxClips)
  const n=Number.isSafeInteger(request)&&request>0?request:
    Number.isSafeInteger(fallback)&&fallback>0?fallback:5
  return Math.max(1,Math.min(30,n))
}
export function validProducerDiscoveryClipCount(v:unknown):v is number{
  return typeof v==='number'&&Number.isSafeInteger(v)&&v>=1&&v<=30
}
