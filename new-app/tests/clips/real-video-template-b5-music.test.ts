import { describe, expect, it } from 'vitest'
import {
  assertAudioLicense, pinMusicSchedule, distributeFrameBoundaries,
  previewMusicReplacement, acceptMusicResync,
  type AudioLicenseRecord, type TemplateTimingV1,
} from '@/lib/clips/real-video-templates/music-timing'

const sha = 'a'.repeat(64)
const license: AudioLicenseRecord = {
  assetId: 'owned-1', origin: 'user-upload', author: 'creator', license: 'user-owned',
  revision: 'ack:2026-11-11', sha256: sha,
  commercialUse: true, exportAllowed: true, redistributionAllowed: false,
  verifiedDurationFrames: 3600, verifiedAt: '2026-11-11T12:00:00Z',
}
const timing: TemplateTimingV1 = {
  v: 1, fps: 30, totalFrames: 900, minShotFrames: 9, minTextFrames: 15,
  boundaries: Array.from({length:31},(_,i)=>i*30),
  windows: [
    {id:'title',kind:'text',startFrame:0,endFrame:90},
    {id:'fx',kind:'fx',startFrame:29,endFrame:34},
    {id:'fade',kind:'audio-fade',startFrame:880,endFrame:900},
  ],
}
const pinned=(bpm:number) => pinMusicSchedule({
  assetId:'owned-1',license,
  mode:'beat-time', grid:{bpm,beatsMs:Array.from({length:100},(_,i)=>i*60000/bpm)},
})

describe('real video template B5 music rights and frame timing',()=>{
  it('rejects missing duration, missing hash, disallowed commercial/export and unacknowledged user music',()=>{
    expect(()=>assertAudioLicense({...license,sha256:''})).toThrow(/provenance/)
    expect(()=>assertAudioLicense({...license,verifiedDurationFrames:0})).toThrow(/duration/)
    expect(()=>assertAudioLicense({...license,commercialUse:false})).toThrow(/rights/)
    expect(()=>assertAudioLicense({...license,exportAllowed:false})).toThrow(/rights/)
    expect(()=>assertAudioLicense({...license,revision:'no-ack'})).toThrow(/acknowledgment/)
    expect(()=>assertAudioLicense(license)).not.toThrow()
  })
  it('pins exact 120/90 BPM source frames, off-grid offset and keeps one hash',()=>{
    const fast=pinned(120),slow=pinned(90)
    expect(fast.beats.slice(0,4)).toEqual([0,15,30,45])
    expect(slow.beats.slice(0,4)).toEqual([0,20,40,60])
    expect(pinMusicSchedule({assetId:'owned-1',license,mode:'beat-time',
      grid:{bpm:120,beatsMs:[13,513,1013]},offsetFrames:7}).beats).toEqual([0,15,30])
    expect(fast.sha256).toBe(sha)
  })
  it('fails closed for silence and missing song identity',()=>{
    expect(()=>pinMusicSchedule({assetId:'owned-1',license,mode:'beat-time',grid:{bpm:0,beatsMs:[]}}))
      .toThrow(/No confident beat/)
    expect(()=>pinMusicSchedule({assetId:'missing',license,mode:'fixed-time',grid:{bpm:0,beatsMs:[]}}))
      .toThrow(/identity/)
  })
  it('quantizes 30 slots cumulatively with no duration drift',()=>{
    const b=distributeFrameBoundaries(Array.from({length:30},(_,i)=>i%3===0?1.37:0.83),901,9)
    expect(b).toHaveLength(31)
    expect(b[0]).toBe(0)
    expect(b[30]).toBe(901)
    expect(b.slice(1).every((n,i)=>n-b[i]!>=9)).toBe(true)
    expect(()=>distributeFrameBoundaries(Array(30).fill(1),200,9)).toThrow(/Impossible/)
  })
  it('keeps timing by default; cancel does not mutate; re-sync provides one undo record',()=>{
    const before=structuredClone(timing)
    const old=pinned(120),next=pinned(90)
    const keep=previewMusicReplacement({timing,previous:old,replacement:next,license})
    expect(keep.newDurationFrames).toBe(900)
    expect(keep.movedBoundaries).toBe(0)
    const preview=previewMusicReplacement({timing,previous:old,replacement:next,license,choice:'re-sync'})
    expect(preview.newDurationFrames).toBe(1200)
    expect(preview.proposed.boundaries.at(-1)).toBe(1200)
    expect(preview.proposed.windows[0]?.endFrame).toBe(120)
    const undo=acceptMusicResync(preview)
    expect(undo.before).toEqual(before)
    expect(undo.after).toEqual(preview.proposed)
    expect(timing).toEqual(before)
  })
  it('does not silently move off-grid cuts or fade windows',()=>{
    const bad={...timing,boundaries:[0,31,...timing.boundaries.slice(2)]}
    expect(()=>previewMusicReplacement({timing:bad,previous:pinned(120),
      replacement:pinned(90),license,choice:'re-sync'})).toThrow(/Off-grid/)
    const aligned=previewMusicReplacement({timing,previous:pinned(120),
      replacement:pinned(90),license,choice:'re-sync'})
    expect(aligned.proposed.windows.find(w=>w.id==='fade')).toEqual({
      id:'fade',kind:'audio-fade',startFrame:1173,endFrame:1200,
    })
  })
  it('rejects unapproved protected anchors, lyric mismatches, short tracks and implausible tempos',()=>{
    const old=pinned(120)
    const replacement=pinned(90)
    expect(()=>previewMusicReplacement({timing,previous:old,replacement:{...replacement,durationFrames:100},license,choice:'re-sync'}))
      .toThrow(/modified/)
    expect(()=>previewMusicReplacement({timing,previous:old,replacement:{...replacement,bpm:25},license,choice:'re-sync'}))
      .toThrow(/Tempo/)
    const protectedOld={...old,protectedAnchors:[{id:'cut',frame:60,approved:true as const}]}
    expect(()=>previewMusicReplacement({timing,previous:protectedOld,replacement,license,choice:'re-sync'}))
      .toThrow(/Protected/)
    const lyricOld={...old,phrases:[{id:'verse',frame:10,kind:'lyric' as const}]}
    expect(()=>previewMusicReplacement({timing,previous:lyricOld,replacement,license,choice:'re-sync'}))
      .toThrow(/lyric/)
    expect(()=>previewMusicReplacement({timing,previous:old,
      replacement:{...replacement,sha256:'b'.repeat(64)},license,choice:'re-sync'}))
      .toThrow(/modified/)
  })
})
