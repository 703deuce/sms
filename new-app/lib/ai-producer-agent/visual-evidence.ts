import type { ClipWord } from '@/lib/clips/edits'

export type VisualMomentEvidence = {
  sourceRangeMs: [number,number]
  observation: string
  whyInteresting: string
  category: string
  spokenContext: string
  analysisTier: 'coarse_3s' | 'coarse_1fps' | 'focused_1fps'
}

/** Use only existing ASR words. These are source-relative timestamps for the
 * trimmed Gemini proxy (not made-up speech or a second transcription). */
export function timestampedAsrForVisual(
  words: ClipWord[], range: [number,number], maxChars = 60_000,
): string {
  const [start,end]=range
  const buckets: Array<{s:number;e:number;words:string[]}>= []
  for(const word of words) {
    const s=Math.round(word.s*1000),e=Math.round(word.e*1000)
    if(e<=start || s>=end || !word.w?.trim()) continue
    const position=Math.max(0,Math.floor((s-start)/5000))
    let bucket=buckets[buckets.length-1]
    if(!bucket || Math.floor((bucket.s-start)/5000)!==position) {
      bucket={s,e,words:[]}; buckets.push(bucket)
    }
    bucket.words.push(word.w)
    bucket.e=e
  }
  let result=''
  for(const bucket of buckets) {
    const line=`[${((bucket.s-start)/1000).toFixed(1)}s–${((bucket.e-start)/1000).toFixed(1)}s] ${bucket.words.join(' ')}\n`
    if(result.length+line.length>maxChars) break
    result+=line
  }
  return result || '(no ASR words in this range)'
}

function momentSpan(row:Record<string,unknown>,range:[number,number]):[number,number]|null {
  const start=Number(row.start_ms??(Number(row.start_s)*1000))
  const end=Number(row.end_ms??(Number(row.end_s)*1000))
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start) return null
  const s=Math.max(range[0],Math.round(start)),e=Math.min(range[1],Math.round(end))
  return e>s?[s,e]:null
}

function description(row:Record<string,unknown>) {
  return String(row.what_happened??row.visual_action??row.quote??row.description??'').trim().slice(0,650)
}

/** Never label a raw model observation a proven on-screen fact. */
export function visualMomentsWithAsr(
  raw:unknown, words:ClipWord[], range:[number,number],
  tier:'coarse_3s'|'coarse_1fps'|'focused_1fps', maxRows=30,
):VisualMomentEvidence[] {
  if(!Array.isArray(raw)) return []
  const evidence:VisualMomentEvidence[]=[]
  for(const row of raw) {
    if(!row||typeof row!=='object')continue
    const item=row as Record<string,unknown>
    const bounds=momentSpan(item,range), observation=description(item)
    if(!bounds||!observation)continue
    const context=words.filter(w=>w.e*1000>bounds[0]-1500 && w.s*1000<bounds[1]+1500)
      .map(w=>w.w).join(' ').slice(0,650)
    evidence.push({
      sourceRangeMs:bounds,observation,
      whyInteresting:String(item.why_it_works??'').slice(0,350),
      category:String(item.category??item.content_type??'moment').slice(0,90),
      spokenContext:context,analysisTier:tier,
    })
    if(evidence.length>=maxRows)break
  }
  return evidence
}

/** Diverse promising regions, chosen solely for detailed OBSERVATION rather
 * than forced inclusion in the final narrative. No invented source windows. */
export function chooseVisualFocusWindows(
  moments:unknown,range:[number,number],maxWindows=3,
):[number,number][] {
  if(!Array.isArray(moments))return []
  const scored=moments.filter((m):m is Record<string,unknown>=>!!m && typeof m==='object')
    .map(m=>({span:momentSpan(m,range),score:Number(m.score??m.gemini_score??0)}))
    .filter((m):m is {span:[number,number];score:number}=>m.span!==null)
    .sort((a,b)=>(Number.isFinite(b.score)?b.score:0)-(Number.isFinite(a.score)?a.score:0))
  const result:[number,number][]=[]
  for(const row of scored) {
    const mid=Math.round((row.span[0]+row.span[1])/2)
    const half=Math.min(16_000,Math.max(7000,Math.round((row.span[1]-row.span[0])/2)+3000))
    const lo=Math.max(range[0],mid-half),hi=Math.min(range[1],mid+half)
    if(hi-lo<1500||result.some(w=>Math.max(0,Math.min(hi,w[1])-Math.max(lo,w[0]))>0))continue
    result.push([lo,hi])
    if(result.length>=maxWindows)break
  }
  return result.sort((a,b)=>a[0]-b[0])
}
