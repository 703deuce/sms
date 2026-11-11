/**
 * Batch 8 static preflight. This is deliberately NOT proof of actual rendered
 * glyphs, contrast, safety or karaoke alignment. Renders are still mandatory.
 */
import { CLIP_FONT_MANIFEST, type FontGlyphCoverage } from '@/lib/clips/font-manifest'
import type { B8Candidate } from './b8-factory'
export type LegibilityFinding = {
  field:string
  probe:'authored'|'long_name'|'unicode'|'busy_background'
  severity:'block'|'review'
  code:string
  detail:string
}
const registry=new Map(CLIP_FONT_MANIFEST.map(f=>[f.id,f]))
const scripts:readonly [FontGlyphCoverage,RegExp][]=[
  ['arabic',/[\u0600-\u06FF]/u],
  ['devanagari',/[\u0900-\u097F]/u],
  ['thai',/[\u0E00-\u0E7F]/u],
  ['cjk',/[\u3400-\u9FFF]/u],
  ['cyrillic',/[\u0400-\u052F]/u],
  ['greek',/[\u0370-\u03FF]/u],
  ['emoji',/[\p{Extended_Pictographic}]/u],
]
export const B8_STRESS_TEXTS={
  long_name:'Alexandria Supercalifragilistic International Technologies',
  unicode:'مرحبا Привет नमस्ते 漢字 👋',
  busy_background:'White headline over white highlight with rapid motion',
} as const
type Probe=LegibilityFinding['probe']
function glyphScripts(text:string):FontGlyphCoverage[] {
  const found=scripts.filter(([,regex])=>regex.test(text)).map(([id])=>id)
  if(/[a-zA-Z\p{Script=Latin}]/u.test(text))found.unshift('latin')
  return [...new Set(found)]
}
const estimatedLineCapacity=(fontSize:number,widthPercent:number)=>
  Math.max(3,Math.floor((1080*widthPercent/100)/(fontSize*0.54)))
export function lintB8Legibility(candidate:B8Candidate):LegibilityFinding[] {
  const findings:LegibilityFinding[]=[]
  const add=(field:string,probe:Probe,severity:LegibilityFinding['severity'],
    code:string,detail:string)=>findings.push({field,probe,severity,code,detail})
  const aspect=candidate.family.aspects[0]
  const width=aspect==='9:16'?1080:aspect==='1:1'?1080:1920
  const height=aspect==='9:16'?1920:1080
  for(const field of candidate.family.texts){
    const font=registry.get(field.font)
    if(!font||!font.workerFile||!font.browserGitBlobSha1||!font.licenseFile) {
      add(field.id,'authored','block','missing_pinned_font','No verified browser/worker font bytes')
      continue
    }
    if(field.size<30) add(field.id,'authored','block','optical_font_too_small',
      'Less than 30px at 1080px authoring width')
    const capacity=estimatedLineCapacity(field.size,80)
    const text=Array.from(field.defaultText)
    const estimatedLines=Math.ceil(text.length/capacity)
    if(estimatedLines>3)add(field.id,'authored','block','default_overflow',
      'Authored default text may exceed three lines')
    if(field.durationFrames/30<(text.length/15))
      add(field.id,'authored','block','reading_time','Default text too fast for 15 chars/second')
    const inkWidth=Math.min(width*0.8,text.length*field.size*0.54)
    const left=field.x/100*width-inkWidth/2
    const right=field.x/100*width+inkWidth/2
    const estimatedHeight=Math.max(1,estimatedLines)*field.size*1.25
    const top=field.y/100*height-estimatedHeight/2
    const bottom=field.y/100*height+estimatedHeight/2
    if(left<width*0.07||right>width*0.93||top<height*.09||bottom>height*.89)
      add(field.id,'authored','review','possible_safe_zone_overflow',
        'Text bounding estimate exceeds 7% horizontal/9–11% vertical safe area; inspect real frames')
    for(const script of glyphScripts(field.defaultText)){
      if(!font.glyphCoverage.includes(script))
        add(field.id,'authored','block','missing_default_glyphs','Font lacks authored '+script+' glyphs')
    }
    const long=B8_STRESS_TEXTS.long_name
    const longest=long.split(/\s+/).sort((a,b)=>b.length-a.length)[0]!
    if(longest.length*field.size*.52>width*.8 || Array.from(long).length>field.maxChars ||
        Math.ceil(Array.from(long).length/capacity)>3)
      add(field.id,'long_name','review','stress_overflow',
        'Long-word/name text requires rendered overflow/line-break review')
    for(const script of glyphScripts(B8_STRESS_TEXTS.unicode)){
      if(!font.glyphCoverage.includes(script))
        add(field.id,'unicode','review','unicode_fallback_required',
          'Rendered frame must prove '+script+' glyph fallback, bidi direction and emoji')
    }
    add(field.id,'busy_background','review','rendered_contrast_needed',
      'Static font color is not evidence of 4.5:1 contrast over light/dark moving media')
  }
  const anchors=candidate.family.beatAnchors
  for(const slot of candidate.family.slots) {
    if(slot.startFrame<0||slot.durationFrames<9)
      add(slot.id,'authored','block','invalid_slot_duration','Shots must be at least 9 frames')
    if(slot.ordinal>1&&!anchors.includes(slot.startFrame))
      add(slot.id,'authored','review','unmarked_cut','Cut boundary lacks a beat anchor')
    if(slot.motion&&slot.motion.to.scale&&slot.motion.to.scale>125)
      add(slot.id,'authored','review','fast_zoom','Inspect strobing/flash and kinetic safety')
  }
  for(const graphic of candidate.family.graphics??[]){
    if(graphic.x<7||graphic.x>93||graphic.y<9||graphic.y>89)
      add(graphic.id,'authored','review','graphic_safe_zone',
        'Graphic placement may overlap platform safe zones')
  }
  return findings
}
