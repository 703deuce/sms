/**
 * Safe, testable editor commands shared by Grokbot and the manual ClipEditsV2
 * editor. No arbitrary JSON merge, JavaScript evaluation, or secret tool calls.
 * The server applies optimistic version control before committing.
 */
import {randomUUID} from 'node:crypto'
import {normalizeEdits, type ClipEditsV2} from '@/lib/clips/edits'
import {DEFAULT_TEXT_STYLE,TEXT_MAX_ITEMS,TEXT_MAX_CHARS,TEXT_MIN_MS} from '@/lib/clips/editor/text-items'
import {PROP_SPECS,FX_PROPS,type KeyProp} from '@/lib/clips/editor/motion-schema'

export const AGENT_EDITOR_TOOLS=[
  {name:'inspect_timeline',description:'Read current tracks and editable operations',readOnly:true},
  {name:'add_text',description:'Insert an editable Text lane item',readOnly:false},
  {name:'set_text',description:'Rewrite text on an existing Text lane item',readOnly:false},
  {name:'move_text',description:'Move an existing title in the frame',readOnly:false},
  {name:'remove_text',description:'Remove one Text lane item',readOnly:false},
  {name:'split_video',description:'Add a non-destructive source-time Video lane split',readOnly:false},
  {name:'set_music_volume',description:'Adjust existing music loudness without replacing it',readOnly:false},
  {name:'set_video_effect',description:'Change one supported numeric video effect amount',readOnly:false},
] as const
export type AgentEditorTool=(typeof AGENT_EDITOR_TOOLS)[number]['name']
export const agentEditorTool=(v:unknown):v is AgentEditorTool=>
  typeof v==='string'&&AGENT_EDITOR_TOOLS.some(t=>t.name===v)
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
function err(m:string): never {throw new Error('Agent editor operation: '+m)}
const number=(v:unknown,lo:number,hi:number):number=>{
  if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)err('numeric parameter out of bounds')
  return v as number
}
const ident=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,128}$/.test(v)
export function applyAgentEditorOperation(args:{
  edits:ClipEditsV2
  bounds:{clipStartMs:number;clipEndMs:number}
  tool:AgentEditorTool
  parameters:unknown
}):ClipEditsV2{
  const {tool}=args
  if(tool==='inspect_timeline')err('read-only tool')
  const raw=obj(args.parameters)
  const edits=structuredClone(args.edits)
  const textItems=[...(edits.textItems||[])]
  const locate=()=>{
    if(!ident(raw.id))err('valid text item ID required')
    const index=textItems.findIndex(x=>x.id===raw.id)
    if(index<0)err('text item not found')
    return index
  }
  if(tool==='add_text'){
    const text=raw.text
    if(typeof text!=='string'||!text.trim()||text.length>TEXT_MAX_CHARS)
      err('text must be nonempty and within the title limit')
    if(textItems.length>=TEXT_MAX_ITEMS)err('maximum number of text items reached')
    const start=number(raw.startMs,0,args.bounds.clipEndMs)
    const end=number(raw.endMs,start+TEXT_MIN_MS,args.bounds.clipEndMs)
    const id=ident(raw.id)?String(raw.id):'ms_agent_'+cryptoRandomId()
    if(textItems.some(x=>x.id===id))err('text item ID already exists')
    textItems.push({id,text,startMs:Math.round(start),endMs:Math.round(end),
      x:raw.x===undefined?50:number(raw.x,0,100),
      y:raw.y===undefined?50:number(raw.y,0,100),
      style:{...DEFAULT_TEXT_STYLE}})
    edits.textItems=textItems
  }else if(tool==='set_text'){
    const index=locate(),text=raw.text
    if(typeof text!=='string'||!text.trim()||text.length>TEXT_MAX_CHARS)
      err('invalid text content')
    textItems[index]={...textItems[index]!,text}
    edits.textItems=textItems
  }else if(tool==='move_text'){
    const index=locate()
    if(raw.x===undefined&&raw.y===undefined)err('x or y required')
    const current=textItems[index]!
    textItems[index]={...current,
      x:raw.x===undefined?current.x:number(raw.x,0,100),
      y:raw.y===undefined?current.y:number(raw.y,0,100)}
    edits.textItems=textItems
  }else if(tool==='remove_text'){
    const index=locate(),id=textItems[index]!.id
    textItems.splice(index,1)
    edits.textItems=textItems
    edits.keyframes=(edits.keyframes||[]).filter(k=>k.target!=='text:'+id)
    edits.tracks=(edits.tracks||[]).map(t=>({...t,items:t.items?.filter(x=>x!==id)}))
  }else if(tool==='split_video'){
    const ms=Math.round(number(raw.sourceMs,args.bounds.clipStartMs+1,args.bounds.clipEndMs-1))
    edits.videoSplits=[...new Set([...(edits.videoSplits||[]),ms])].sort((a,b)=>a-b)
  }else if(tool==='set_music_volume'){
    if(!edits.audio?.music)err('no music track to adjust')
    edits.audio={...edits.audio,music:{...edits.audio.music,volume:number(raw.volume,0,1)}}
  }else if(tool==='set_video_effect'){
    if(typeof raw.effect!=='string'||!(FX_PROPS as readonly string[]).includes(raw.effect))
      err('unsupported video effect')
    const prop=raw.effect as KeyProp
    const spec=PROP_SPECS[prop]
    const intensity=number(raw.amount,spec.min,spec.max)
    const other=(edits.keyframes||[]).filter(k=>!(k.target==='video'&&k.prop===prop))
    edits.keyframes=[...other,{target:'video',prop,value:intensity,points:[]}]
  }else err('unsupported operation')
  // Reuse the editor's own normalizer and worker-compatible constraints.
  return normalizeEdits(edits,args.bounds)
}
const cryptoRandomId=()=>randomUUID()
// The persistent server pathway additionally checks the clip edit version; no
// client should ever use this pure function to bypass optimistic concurrency.
