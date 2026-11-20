'use client'
import {AudioLines,BookOpenText,Clapperboard,Globe2,Link2,Mic2,Music2,Plus,SlidersHorizontal,Target,Trash2,Upload,Video} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Textarea} from '@/components/ui/textarea'
import {CreatorVoicePicker,type VoiceSelection} from './creator-voice-picker'
import type {MotionStudioClient} from '@/lib/motion-studio/client'
import type {InputRole} from '@/lib/motion-studio/production-brief'

export type CustomizeValues={
 scriptHandling:'exact'|'improve';commentary:string
 links:{url:string;note:string}[]
 audience:string;tonePreset:string;toneText:string
 sourceText:string;preferPrimaryFootage:boolean;preferOriginalInterviews:boolean;preferDocuments:boolean;domains:string
 musicMode:'elevenlabs'|'upload'|'none';musicPlacement:string
 narrationMode:'ai_voice'|'cloned_voice'|'uploaded_narration'|'talking_head'
 voice:VoiceSelection|null
}
export const DEFAULT_CUSTOMIZE:CustomizeValues={
 scriptHandling:'exact',commentary:'',links:[],audience:'',tonePreset:'',toneText:'',
 sourceText:'',preferPrimaryFootage:false,preferOriginalInterviews:false,preferDocuments:false,
 domains:'',musicMode:'elevenlabs',musicPlacement:'',narrationMode:'ai_voice',voice:null
}
const roleChoices:{id:InputRole;label:string;detail:string}[]=[
 {id:'footage',label:'Film footage',detail:'Use this clip in the film'},
 {id:'photo',label:'Photo / still',detail:'Use this still picture'},
 {id:'talking_head',label:'On-camera narration',detail:'Preserve my picture and original sound'},
 {id:'narration',label:'My voiceover',detail:'Use my recorded speech'},
 {id:'music',label:'My music',detail:'Use this track as the score'},
 {id:'reference',label:'Visual inspiration',detail:'Style and direction only'},
 {id:'script',label:'Script',detail:'Read as written or improve'},
 {id:'logo',label:'Brand logo',detail:'Apply brand identity'},
]
export const attachmentRoleChoices=(mime:string)=>roleChoices.filter(item=>
 item.id==='footage'||item.id==='talking_head'?mime.startsWith('video/'):
 item.id==='photo'||item.id==='logo'?mime.startsWith('image/'):
 item.id==='narration'||item.id==='music'?mime.startsWith('audio/'):
 item.id==='reference'?mime.startsWith('image/')||mime.startsWith('video/'):
 item.id==='script'?!mime.startsWith('video/')&&!mime.startsWith('image/')&&!mime.startsWith('audio/'):false
)
const surface='rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6'
const title='flex items-center gap-3 text-base font-semibold'
const control='h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15'
function Block({icon:Icon,title:heading,detail,children}:{icon:typeof Music2;title:string;detail:string;children:React.ReactNode}){
 return <section className={surface}>
  <div className="mb-5 flex items-start gap-3">
   <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"><Icon className="size-5" aria-hidden/></span>
   <div><h3 className={title}>{heading}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{detail}</p></div>
  </div>
  {children}
 </section>
}
export function CreatorCustomize({client,value,onChange,script,onScript,onFiles,onError}:{
 client:MotionStudioClient;value:CustomizeValues;onChange:(next:CustomizeValues)=>void
 script:string;onScript:(s:string)=>void
 onFiles:(files:FileList|null,role?:InputRole)=>void
 onError:(s:string)=>void
}){
 const patch=(p:Partial<CustomizeValues>)=>onChange({...value,...p})
 const narrationFile=value.narrationMode==='talking_head'?'talking_head':'narration'
 return <div className="space-y-4" data-testid="ms-customize-sections">
  <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
   <SlidersHorizontal className="size-4 shrink-0 text-primary"/>
   These details are optional. Add as much direction as you like; Transovo handles the rest.
  </div>
  <Block icon={BookOpenText} title="Your script" detail="Bring your own words, or let the producer shape your story.">
   <Textarea aria-label="Custom script" value={script} rows={6} onChange={e=>onScript(e.target.value)}
    placeholder="Paste your script, outline, or exact lines here…" className="min-h-36 text-sm"/>
   <div className="mt-3 grid gap-2 sm:grid-cols-2">
    {[{id:'exact',name:'Follow word for word',detail:'Preserve my narration exactly'},
      {id:'improve',name:'Improve my draft',detail:'Refine the language without changing meaning'}].map(option=>
     <button key={option.id} type="button" onClick={()=>patch({scriptHandling:option.id as 'exact'|'improve'})}
      className={`rounded-xl border p-3 text-left transition-colors ${value.scriptHandling===option.id?'border-primary/60 bg-primary/10':'border-border hover:border-primary/30'}`}>
      <span className="text-sm font-medium">{option.name}</span><span className="mt-1 block text-xs text-muted-foreground">{option.detail}</span>
     </button>)}
   </div>
   <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-primary"><Upload className="size-4"/>Attach a script file<input type="file" accept=".txt,.md,.doc,.docx,.pdf" className="sr-only" onChange={e=>{onFiles(e.target.files,'script');e.target.value=''}}/></label>
  </Block>
  <Block icon={Clapperboard} title="Your perspective" detail="Add a personal viewpoint the film should communicate in your voice.">
   <Textarea value={value.commentary} aria-label="Personal commentary" onChange={e=>patch({commentary:e.target.value})}
    placeholder="Here's what I think about this story, and why it matters…" rows={4}/>
   <p className="mt-2 text-xs text-muted-foreground">Your take stays your opinion in the film; it is not treated as a verified fact.</p>
  </Block>
  <Block icon={Globe2} title="Research and references" detail="Direct the research with specific articles, interviews, primary sources, or websites.">
   <div className="space-y-3">
    {value.links.map((link,i)=><div key={i} className="flex items-start gap-2 rounded-xl border border-border bg-background/50 p-3">
     <Link2 className="mt-3 size-4 shrink-0 text-primary"/>
     <div className="min-w-0 flex-1 space-y-2">
      <input type="url" value={link.url} placeholder="https://example.com/article" aria-label={`Reference URL ${i+1}`} className={control}
       onChange={e=>patch({links:value.links.map((x,j)=>j===i?{...x,url:e.target.value}:x)})}/>
      <input value={link.note} placeholder="Optional note: why this source matters" aria-label={`Reference note ${i+1}`} className={control}
       onChange={e=>patch({links:value.links.map((x,j)=>j===i?{...x,note:e.target.value}:x)})}/>
     </div>
     <button aria-label="Remove reference" className="mt-2 rounded p-2 hover:bg-muted" onClick={()=>patch({links:value.links.filter((_,j)=>j!==i)})}><Trash2 className="size-4"/></button>
    </div>)}
    <Button type="button" size="sm" variant="outline" disabled={value.links.length>=25}
      onClick={()=>patch({links:[...value.links,{url:'',note:''}]})}><Plus className="mr-1 size-4"/>Add source link</Button>
   </div>
   <div className="mt-5 border-t border-border pt-4">
    <label className="mb-2 block text-sm font-medium">Source preferences</label>
    <Textarea rows={2} value={value.sourceText} onChange={e=>patch({sourceText:e.target.value})}
      placeholder="Prefer original interviews, historical documents, official channels…" aria-label="Source instructions"/>
    <div className="mt-3 flex flex-wrap gap-2">
     {([['preferPrimaryFootage','Original footage'],['preferOriginalInterviews','First-person interviews'],['preferDocuments','Primary documents']] as const).map(([key,label])=>
      <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs transition-colors ${value[key]?'border-primary/50 bg-primary/10':'border-border'}`}>
       <input type="checkbox" checked={value[key]} onChange={e=>patch({[key]:e.target.checked})} className="accent-primary"/>{label}
      </label>)}
    </div>
    <input value={value.domains} onChange={e=>patch({domains:e.target.value})} className={`mt-3 ${control}`} aria-label="Preferred domains" placeholder="Preferred domains, separated by commas"/>
   </div>
  </Block>
  <Block icon={Mic2} title="Narration and voice" detail="Choose a narrator, use your own voiceover, or put yourself on camera.">
   <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
    {([{id:'ai_voice',name:'AI narrator',description:'Studio voices'},
       {id:'cloned_voice',name:'My voice',description:'Saved voice clone'},
       {id:'uploaded_narration',name:'Upload voiceover',description:'Your recording'},
       {id:'talking_head',name:'On camera',description:'Your video and audio'}] as const).map(mode=>
      <button key={mode.id} type="button" onClick={()=>patch({narrationMode:mode.id})}
       className={`min-h-24 rounded-xl border p-3 text-left transition-colors ${value.narrationMode===mode.id?'border-primary/60 bg-primary/10':'border-border hover:border-foreground/20'}`}>
       <span className="block text-sm font-semibold">{mode.name}</span><span className="mt-2 block text-xs text-muted-foreground">{mode.description}</span>
      </button>)}
   </div>
   {value.narrationMode==='ai_voice'||value.narrationMode==='cloned_voice'?
    <div className="mt-5 border-t border-border/60 pt-5"><CreatorVoicePicker client={client} value={value.voice}
      onChange={voice=>patch({voice,narrationMode:voice?.voiceSource==='cloned'?'cloned_voice':'ai_voice'})}
      onError={onError}/></div>:
    <label className="mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 text-center">
     {value.narrationMode==='talking_head'?<Video className="size-7 text-primary"/>:<AudioLines className="size-7 text-primary"/>}
     <span className="text-sm font-semibold">{value.narrationMode==='talking_head'?'Add your talking-head video':'Add your recorded narration'}</span>
     <span className="max-w-md text-xs text-muted-foreground">{value.narrationMode==='talking_head'?'We preserve your original picture and sound and add researched cutaways.':'Your recording becomes the timing and performance of the film.'}</span>
     <input type="file" className="sr-only" accept={value.narrationMode==='talking_head'?'video/*':'audio/*'} onChange={e=>{onFiles(e.target.files,narrationFile);e.target.value=''}}/>
    </label>}
  </Block>
  <Block icon={Music2} title="Music and soundtrack" detail="Give the story its own score, use your track, or go without music.">
   <div className="grid gap-2 sm:grid-cols-3">
    {([{id:'elevenlabs',name:'AI-composed score',detail:'ElevenLabs finds the mood, cues, and transitions'},
       {id:'upload',name:'Use my music',detail:'Build the edit around a soundtrack you provide'},
       {id:'none',name:'No music',detail:'No musical score in the video'}] as const).map(option=>
      <button key={option.id} type="button" onClick={()=>patch({musicMode:option.id})}
       className={`rounded-xl border p-3 text-left ${value.musicMode===option.id?'border-primary/60 bg-primary/10':'border-border hover:border-foreground/20'}`}>
       <span className="block text-sm font-semibold">{option.name}</span><span className="mt-2 block text-xs text-muted-foreground">{option.detail}</span>
      </button>)}
   </div>
   {value.musicMode==='upload'?<label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-primary"><Upload className="size-4"/>Upload music file<input type="file" accept="audio/*" className="sr-only" onChange={e=>{onFiles(e.target.files,'music');e.target.value=''}}/></label>:null}
   {value.musicMode!=='none'?<Textarea rows={2} className="mt-4" aria-label="Music placement notes" value={value.musicPlacement} onChange={e=>patch({musicPlacement:e.target.value})}
    placeholder="Optional: open on the beat, quiet under interviews, bring the music back for the outro…"/>:null}
  </Block>
  <Block icon={Target} title="Audience and tone" detail="Tell the producer who will watch, and how the finished video should feel.">
   <label className="block text-sm font-medium">Who is this for?<input value={value.audience} onChange={e=>patch({audience:e.target.value})} className={`mt-2 ${control}`}
     placeholder="e.g. YouTube documentary viewers, new customers, longtime fans"/></label>
   <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <label className="text-sm font-medium">Tone
     <select className={`mt-2 ${control}`} value={value.tonePreset} onChange={e=>patch({tonePreset:e.target.value})}>
      <option value="">AI decides</option>{['serious','conversational','investigative','educational','humorous','dramatic','custom'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
     </select>
    </label>
    <label className="text-sm font-medium">Additional direction<input className={`mt-2 ${control}`} value={value.toneText} onChange={e=>patch({toneText:e.target.value})}
     placeholder="e.g. confident, warm, thoughtful"/></label>
   </div>
  </Block>
 </div>
}
