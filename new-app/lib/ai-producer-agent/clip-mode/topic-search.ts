/** Topic / prompt search over a grounded transcript. Used to find moments
 * about X and, when the user asks to compile them, stitch one Story.
 * Does not assign a story angle; it only matches the user's own request.
 */
import type {TimedWord} from './editorial-safety'
import type {ClipCandidate} from './candidates'
import type {SourcePassage} from './story-coverage'

const GENERIC=/^(?:create|make|find|build)\s+(?:one\s+)?(?:coherent\s+)?(?:narrative|story|clip)s?\b/i
const COMPILE=/\b(?:compil(?:e|ation)|every time|all the (?:times|moments)|stitch|highlight reel|one clip of)\b/i

export function topicQueryFromInstruction(instruction:string|null|undefined):string{
  const text=(instruction??'').replace(/\s+/g,' ').trim()
  if(!text||GENERIC.test(text)&&!COMPILE.test(text)&&text.length<80)return ''
  return text.slice(0,240)
}

export function instructionAsksToCompile(instruction:string|null|undefined):boolean{
  return COMPILE.test(instruction??'')
}

function normalize(s:string):string{
  return s.toLowerCase().replace(/[\u2018\u2019]/g,"'").replace(/[^a-z0-9' ]+/g,' ').replace(/\s+/g,' ').trim()
}

function termsOf(query:string):string[]{
  const stop=new Set(['the','a','an','and','or','of','to','for','in','on','with','about','that','this','from','into','make','one','clip','story','please','find','every','time','they','talk','talking','where','when','what'])
  return normalize(query).split(' ').filter(t=>t.length>=3&&!stop.has(t))
}

export function topicPassagesFromTranscript(
  words:readonly TimedWord[],
  query:string,
  range:[number,number],
  maxHits=12,
):SourcePassage[]{
  const terms=termsOf(query)
  if(!terms.length||!words.length)return []
  const scoped=words.filter(w=>w.e*1000>range[0]&&w.s*1000<range[1])
  const hits:SourcePassage[]=[]
  const window=24
  for(let i=0;i<scoped.length;i+=8){
    const slice=scoped.slice(i,i+window)
    const text=normalize(slice.map(w=>w.w).join(' '))
    const matched=terms.filter(t=>text.includes(t)).length
    if(matched<Math.min(2,terms.length))continue
    const startMs=Math.max(range[0],Math.round(slice[0]!.s*1000))
    const endMs=Math.min(range[1],Math.round(slice[slice.length-1]!.e*1000))
    if(endMs-startMs<3000)continue
    if(hits.some(h=>Math.max(0,Math.min(h.endMs,endMs)-Math.max(h.startMs,startMs))>8000))continue
    hits.push({startMs,endMs})
    if(hits.length>=maxHits)break
  }
  return hits
}

export function mergeTopicCandidates(
  candidates:readonly ClipCandidate[],
  passages:readonly SourcePassage[],
  range:[number,number],
  targetS:number,
):ClipCandidate[]{
  const extra:ClipCandidate[]=[]
  let index=candidates.length
  for(const p of passages){
    const peakMs=Math.round((p.startMs+p.endMs)/2)
    if(candidates.some(c=>Math.abs(c.peakMs-peakMs)<Math.max(8000,targetS*250)))continue
    const half=Math.max(90_000,targetS*1800)
    const startMs=Math.max(range[0],peakMs-half)
    const endMs=Math.min(range[1],peakMs+half)
    if(endMs-startMs<15_000)continue
    extra.push({index,startMs,endMs,peakMs,finderScore:72,label:'Topic match'})
    index++
  }
  return [...candidates,...extra]
}

export function whyThisClip(input:{
  logline?:string
  label?:string
  instruction?:string|null
  durationSeconds:number
  targetS:number
  distinctMoments?:number
}):string{
  const parts:string[]=[]
  if(input.logline)parts.push(input.logline.replace(/\s+/g,' ').trim())
  else if(input.label)parts.push(input.label.replace(/\s+/g,' ').trim())
  if(input.instruction&&topicQueryFromInstruction(input.instruction))
    parts.push('Matches the requested topic.')
  if((input.distinctMoments??0)>=2)
    parts.push('Stitches distinct source passages into one self-contained story.')
  if(Number.isFinite(input.durationSeconds)&&input.targetS>0){
    const delta=input.durationSeconds-input.targetS
    if(Math.abs(delta)>10)parts.push(`Natural length ${Math.round(input.durationSeconds)}s (requested ~${input.targetS}s).`)
  }
  return parts.join(' ').slice(0,400)
}
