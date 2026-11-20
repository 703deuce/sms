'use client'
import {BookOpenText,Clapperboard,FileAudio,FileVideo2,Globe2,Music2,Paintbrush,SlidersHorizontal,Users,Volume2} from 'lucide-react'
import type {ProductionBrief} from '@/lib/motion-studio/production-brief'
const clock=(s:number)=>s>=60?`${Math.floor(s/60)}m ${s%60?String(s%60).padStart(2,'0')+'s':''}`.trim():`${s}s`
export function CreatorPlanSummary({brief}:{brief:ProductionBrief|undefined}){
 if(!brief)return null
 const narrator=brief.narration.mode==='talking_head'?'Your on-camera recording':
  brief.narration.mode==='uploaded_narration'?'Your uploaded narration':
  brief.narration.voiceName?brief.narration.voiceName:brief.narration.mode==='cloned_voice'?'Your saved voice':'AI-directed narrator'
 const music=brief.music.mode==='none'?'No score':brief.music.mode==='upload'?'Your uploaded soundtrack':'Original AI-composed score'
 const files=brief.inputs.reduce<Record<string,number>>((acc,item)=>({...acc,[item.role]:(acc[item.role]||0)+1}),{})
 const rows=[
  {icon:Clapperboard,label:'Format',value:`${brief.videoType.replace(/_/g,' ')} · ${clock(brief.durationSeconds)} · ${brief.aspectRatio} · ${brief.resolution}`},
  {icon:Volume2,label:'Narrator',value:narrator},
  {icon:Music2,label:'Soundtrack',value:music},
  {icon:BookOpenText,label:'Script',value:brief.script?(brief.script.handling==='exact'?'Use my words exactly':'AI may improve my draft'):'Producer writes the story'},
  ...(brief.audience?[{icon:Users,label:'Audience',value:brief.audience}]:[]),
  ...(brief.tone?.preset||brief.tone?.text?[{icon:SlidersHorizontal,label:'Tone',value:[brief.tone?.preset,brief.tone?.text].filter(Boolean).join(' · ')}]:[]),
  ...(brief.style.id!=='automatic'?[{icon:Paintbrush,label:'Style',value:brief.style.custom||brief.style.id}]:[]),
  ...(brief.referenceLinks?.length?[{icon:Globe2,label:'References',value:`${brief.referenceLinks.length} source links included in research`}]:[]),
  ...(Object.keys(files).length?[{icon:FileVideo2,label:'Your media',value:Object.entries(files).map(([role,count])=>`${count} ${role.replace(/_/g,' ')}`).join(' · ')}]:[]),
  ...(brief.commentary?[{icon:BookOpenText,label:'Your perspective',value:brief.commentary.text.slice(0,130)+(brief.commentary.text.length>130?'…':'')}]:[]),
 ]
 return <aside data-testid="ms-your-video-plan" aria-label="Your video plan" className="mx-auto mb-4 w-full max-w-5xl rounded-2xl border border-primary/20 bg-card p-5 shadow-sm">
  <div className="mb-4 flex items-start gap-3">
   <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Clapperboard className="size-5"/></span>
   <div className="flex-1"><h3 className="text-base font-semibold">Your video plan</h3><p className="mt-0.5 text-xs text-muted-foreground">Production has already started. Here’s how Transovo is following your direction.</p></div>
   <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">In production</span>
  </div>
  <p className="mb-4 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">{brief.prompt.slice(0,360)}</p>
  <div className="grid gap-3 sm:grid-cols-2">
   {rows.map(({icon:Icon,label,value},i)=><div key={i} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/30 p-3">
    <Icon className="mt-0.5 size-4 shrink-0 text-primary"/>
    <div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium capitalize">{value}</p></div>
   </div>)}
  </div>
  <p className="mt-4 text-xs text-muted-foreground">You can request specific changes in chat without rebuilding parts that already work.</p>
 </aside>
}
