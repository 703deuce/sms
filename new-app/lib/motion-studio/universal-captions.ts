import type {UniversalCaption} from './universal-timeline'
const record=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{}
function ms(timestamp:string){
  const parts=timestamp.trim().replace(',', '.').split(':')
  if(parts.length<2||parts.length>3)return NaN
  const s=Number(parts.pop()),m=Number(parts.pop()),h=Number(parts.pop()||0)
  return ((h*60+m)*60+s)*1000
}
/** Read captions as a separate editable timeline track, never as picture pixels. */
export function readTimelineCaptions(source:string):UniversalCaption[]{
  const trimmed=source.trim()
  if(trimmed.startsWith('{')||trimmed.startsWith('[')){
    const raw:unknown=JSON.parse(trimmed)
    const entries=Array.isArray(raw)?raw:record(raw).cues
    if(!Array.isArray(entries))return []
    return entries.slice(0,20000).flatMap((v,i)=>{
      const cue=record(v)
      const startMs=Number(cue.startMs??cue.start??NaN)
      const endMs=Number(cue.endMs??cue.end??NaN)
      const text=typeof cue.text==='string'?cue.text:typeof cue.w==='string'?cue.w:''
      return Number.isFinite(startMs)&&Number.isFinite(endMs)&&endMs>startMs&&text
        ?[{id:String(cue.id||i),startMs,endMs,text,style:record(cue.style)}]:[]
    })
  }
  // Standard WebVTT and SRT time ranges; separate cue text is retained.
  return trimmed.replace(/^WEBVTT[^\n]*\n/,'').split(/\n\s*\n/)
    .flatMap((block,i)=>{
      const lines=block.trim().split(/\r?\n/)
      const at=lines.findIndex(line=>line.includes('-->'))
      if(at<0)return []
      const times=lines[at]!.split('-->')
      const startMs=ms(times[0]||''),endMs=ms((times[1]||'').split(/\s/)[0]||'')
      const text=lines.slice(at+1).join('\n').trim()
      return Number.isFinite(startMs)&&Number.isFinite(endMs)&&endMs>startMs&&text
        ?[{id:String(i),startMs,endMs,text}]:[]
    })
}
