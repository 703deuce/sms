import type { UserTemplateAssetManifestV1, UserTemplateDefinitionV1 } from '@/lib/clips/user-templates/contract'

function fail(message:string):never { throw new Error('Editable template gate: '+message) }
function isPlaceholder(v:string):boolean {
  return v === 'template_music' || /^template_slot_[1-9][0-9]*$/.test(v)
}
function walkPrivateRefs(value:unknown,path:string[]=[]):void {
  if(Array.isArray(value)){ value.forEach((v,i)=>walkPrivateRefs(v,[...path,String(i)])); return }
  if(!value||typeof value!=='object') return
  for(const [key,v] of Object.entries(value as Record<string,unknown>)){
    const next=[...path,key]
    if(typeof v==='string'&&/^(uploadId|generationId|assetId|refId)$/i.test(key)&&!isPlaceholder(v))
      fail('public definition still contains a private asset reference at '+next.join('.'))
    if(typeof v==='string'&&key==='font'&&v.startsWith('user:'))
      fail('uploaded private fonts cannot be published without verified redistribution rights')
    walkPrivateRefs(v,next)
  }
}

export function assertUserTemplateEditableStructure(
  definition:UserTemplateDefinitionV1,
  manifest:UserTemplateAssetManifestV1,
  opts:{public?:boolean}={},
):void {
  if(definition.v!==1||manifest.v!==1) fail('unsupported definition version')
  const edits=definition.snapshot?.edits
  if(!edits||edits.v!==2) fail('authoritative ClipEditsV2 snapshot is missing')
  if(!Number.isFinite(definition.snapshot.clipStartMs)||!Number.isFinite(definition.snapshot.clipEndMs)||
      definition.snapshot.clipEndMs<=definition.snapshot.clipStartMs)
    fail('invalid authoritative clip range')
  if(definition.slots.length!==manifest.slots.length) fail('slot manifest does not match the definition')
  const slotIds=new Set<string>(),ordinals=new Set<number>()
  for(const slot of definition.slots){
    if(!/^slot_[1-9][0-9]*$/.test(slot.id)||slotIds.has(slot.id)) fail('slot ids must be unique numbered slots')
    if(!Number.isInteger(slot.ordinal)||slot.ordinal<1||ordinals.has(slot.ordinal)) fail('slot ordinals must be unique')
    if(!Number.isFinite(slot.minDurationMs)||slot.minDurationMs<1) fail('slot duration requirement is invalid')
    slotIds.add(slot.id);ordinals.add(slot.ordinal)
  }
  for(let i=1;i<=ordinals.size;i++) if(!ordinals.has(i)) fail('slot ordinals must be contiguous')
  const manifestSlots=new Map(manifest.slots.map(s=>[s.id,JSON.stringify(s)]))
  for(const slot of definition.slots)
    if(manifestSlots.get(slot.id)!==JSON.stringify(slot)) fail('slot manifest changed independently of the editable definition')

  const sources=new Map((edits.sources??[]).map(s=>[s.id,s]))
  const sourceSegments=edits.sourceSegments??[]
  const inserts=edits.inserts??[]
  const broll=new Map((edits.broll??[]).map(b=>[b.id,b]))
  let mainSlots=0
  for(const slot of definition.slots){
    if(slot.target.kind==='main'){mainSlots++;continue}
    if(slot.target.kind==='source'){
      const src=sources.get(slot.target.sourceId)
      if(!src) fail(slot.id+' lost its editable media-source object')
      if(src.ref!=='upload'||src.refId!=='template_'+slot.id) fail(slot.id+' is not backed by a replaceable source placeholder')
      const used=sourceSegments.some(s=>s.sourceId===src.id)||inserts.some(i=>i.sourceId===src.id)
      if(!used) fail(slot.id+' has no real source segment/insert on the timeline')
    }else{
      const item=broll.get(slot.target.itemId)
      if(!item||item.source!=='upload'||item.uploadId!=='template_'+slot.id)
        fail(slot.id+' lost its separate editable overlay item')
    }
  }
  if(mainSlots>1) fail('only one main-source slot is allowed')
  if(opts.public&&mainSlots!==1) fail('public templates require a replaceable main-source clip')

  const textItems=new Map((edits.textItems??[]).map(t=>[t.id,t]))
  const fields=new Set<string>()
  for(const field of definition.textFields){
    if(fields.has(field.id)) fail('editable text field ids must be unique')
    fields.add(field.id)
    const item=textItems.get(field.itemId)
    if(!item||item.kind) fail(field.id+' no longer maps to a real editable text layer')
    if(item.text!==field.exampleText) fail(field.id+' example text no longer matches the pinned revision')
  }

  for(const transition of edits.transitions??[]){
    if(!Number.isFinite(transition.srcMs)||transition.srcMs<=definition.snapshot.clipStartMs||
        transition.srcMs>=definition.snapshot.clipEndMs)
      fail('transition is not attached to a real in-range cut boundary')
  }
  const sfxIds=new Set((edits.audio?.sfx??[]).map(s=>s.generationId))
  for(const keyframe of edits.keyframes??[]){
    if(keyframe.target.startsWith('text:')&&!textItems.has(keyframe.target.slice(5)))
      fail('text keyframe target is missing its editable text layer')
    if(keyframe.target.startsWith('broll:')&&!broll.has(keyframe.target.slice(6)))
      fail('overlay keyframe target is missing its editable layer')
    if(keyframe.target==='music'&&!edits.audio?.music)
      fail('music keyframes exist without an independent music track')
    if(keyframe.target.startsWith('sfx:')&&!sfxIds.has(keyframe.target.slice(4)))
      fail('SFX keyframes exist without their independent audio item')
  }
  for(const segment of sourceSegments){
    if(segment.endMs<=segment.startMs) fail('source segment has no editable duration')
    if(segment.playback){
      const frames=segment.playback.pieces.reduce((n,p)=>n+p.frames,0)
      if(frames!==segment.playback.outputFrames) fail('slot-local speed/hold plan no longer spans its authored output')
    }
  }
  const preview=definition.previewRange
  const duration=definition.snapshot.clipEndMs-definition.snapshot.clipStartMs
  if(!preview||preview.startMs<0||preview.endMs<=preview.startMs||preview.endMs>duration)
    fail('preview range is outside the pinned revision')

  if(manifest.musicPolicy==='replace'){
    if(!edits.audio?.music||edits.audio.music.uploadId!=='template_music'||edits.audio.music.generationId!=='template_music')
      fail('replaceable music must remain a real independent music item')
  }else if(manifest.musicPolicy==='mute'&&edits.audio?.music)
    fail('muted template policy still contains a music item')

  if(opts.public){
    if(manifest.decorative.length) fail('public definition contains private decorative dependencies')
    if(edits.audio?.sfx?.length||edits.audio?.studioSound)
      fail('SFX/Studio Sound need redistribution clearance before public publication')
    walkPrivateRefs(edits)
  }
}
