import type { AuthoredMusicScheduleV1 } from './music-timing'
import { validateTemplateFamily, type TemplateFamilyV1 } from './sequence-contract'

export type B8BeatSyncResult = {
  family: TemplateFamilyV1
  oldBoundaries: number[]
  newBoundaries: number[]
  musicBeatFrames: number[]
  movedBoundaries: number
}

const nearest=(values:readonly number[],target:number)=>{
  let best=values[0]!,distance=Math.abs(best-target)
  for(const value of values){
    const next=Math.abs(value-target)
    if(next<distance){best=value;distance=next}
  }
  return best
}

/**
 * Re-time a Batch 8 structural family onto a real, pinned soundtrack beat grid.
 * Structure/order is unchanged: only output-clock boundaries and attached layer
 * windows move. No source media is flattened and the original family stays immutable.
 */
export function syncB8FamilyToMusic(
  rawFamily:TemplateFamilyV1,
  schedule:AuthoredMusicScheduleV1,
):B8BeatSyncResult{
  const family=validateTemplateFamily(rawFamily)
  if(schedule.v!==1||schedule.mode!=='beat-time'||!schedule.beats?.length||
     !Number.isInteger(schedule.durationFrames)||schedule.durationFrames<family.slots.length*9)
    throw new Error('Batch 8 beat sync requires a long enough pinned beat-time schedule')
  const musicBeatFrames=[...new Set(schedule.beats.map(frame=>frame+schedule.offsetFrames))]
    .filter(frame=>Number.isInteger(frame)&&frame>0&&frame<schedule.durationFrames)
    .sort((a,b)=>a-b)
  if(musicBeatFrames.length<family.slots.length)
    throw new Error('Soundtrack beat grid is too sparse for this template structure')
  const oldBoundaries=[0,...family.slots.map(slot=>slot.startFrame+slot.durationFrames)]
  const minimumTotal=family.slots.length*9
  const endCandidates=musicBeatFrames.filter(frame=>frame>=minimumTotal)
  if(!endCandidates.length)throw new Error('Soundtrack ends before minimum shot durations')
  const end=nearest(endCandidates,family.totalFrames)
  if(end>schedule.durationFrames)
    throw new Error('Beat-synced template exceeds soundtrack duration')
  const newBoundaries=[0]
  for(let i=1;i<oldBoundaries.length-1;i++){
    const previous=newBoundaries[i-1]!
    const remainingSlots=family.slots.length-i
    const target=Math.round(oldBoundaries[i]!/family.totalFrames*end)
    const candidates=musicBeatFrames.filter(frame=>
      frame>=previous+9&&frame<=end-remainingSlots*9)
    if(!candidates.length)throw new Error('Beat grid cannot preserve minimum shot lengths')
    newBoundaries.push(nearest(candidates,target))
  }
  newBoundaries.push(end)
  for(let i=1;i<newBoundaries.length;i++)
    if(newBoundaries[i]!-newBoundaries[i-1]!<9)
      throw new Error('Beat sync produced an unsafe shot duration')
  const mapFrame=(frame:number)=>{
    if(frame===family.totalFrames)return end
    let i=1
    while(i<oldBoundaries.length&&frame>=oldBoundaries[i]!)i++
    const oldA=oldBoundaries[i-1]!,oldB=oldBoundaries[i]!
    const newA=newBoundaries[i-1]!,newB=newBoundaries[i]!
    return newA+Math.round((frame-oldA)*(newB-newA)/(oldB-oldA))
  }
  const slots=family.slots.map((slot,index)=>{
    const startFrame=newBoundaries[index]!,durationFrames=newBoundaries[index+1]!-newBoundaries[index]!
    let transition=slot.transition
    if(transition!=='cut'){
      const scaled=Math.round(transition.durationFrames*durationFrames/slot.durationFrames)
      if(scaled<3||scaled>60)throw new Error('Beat sync makes a transition unsafe')
      transition={...transition,durationFrames:scaled}
    }
    return {...slot,startFrame,durationFrames,transition}
  })
  const texts=family.texts.map(text=>({...text,startFrame:mapFrame(text.startFrame),
    durationFrames:mapFrame(text.startFrame+text.durationFrames)-mapFrame(text.startFrame)}))
  const graphics=family.graphics?.map(graphic=>({...graphic,startFrame:mapFrame(graphic.startFrame),
    durationFrames:mapFrame(graphic.startFrame+graphic.durationFrames)-mapFrame(graphic.startFrame)}))
  const beatAnchors=family.beatAnchors.map(mapFrame)
  const phraseAnchors=family.phraseAnchors?.map(anchor=>({...anchor,frame:mapFrame(anchor.frame)}))
  const synced=validateTemplateFamily({...family,totalFrames:end,slots,texts,graphics,beatAnchors,phraseAnchors})
  const beatSet=new Set(musicBeatFrames)
  if(synced.slots.slice(1).some(slot=>!beatSet.has(slot.startFrame))||!beatSet.has(synced.totalFrames))
    throw new Error('Beat sync failed to land cuts on the pinned music grid')
  return {family:synced,oldBoundaries,newBoundaries,musicBeatFrames,
    movedBoundaries:newBoundaries.filter((frame,i)=>frame!==oldBoundaries[i]).length}
}
