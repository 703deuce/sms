import { describe, expect, it } from 'vitest'
import { assignSelectionInOrder, fillProgress, materializeStudioDraft, moveSelection, newStudioDraft } from '@/lib/clips/real-video-templates/slot-workflow'
import type { TemplateAsset, TemplateFamilyV1 } from '@/lib/clips/real-video-templates/sequence-contract'
const image = (id: string): TemplateAsset => ({ id, kind: 'image', license: { id:'owned', provenance:'user-owned', reference:'user_upload' } })
const video = (id: string, durationFrames: number): TemplateAsset => ({ ...image(id), kind: 'video', durationFrames })
const family = (n: number): TemplateFamilyV1 => ({
  schemaVersion:1, familyId:'story', revision:1,title:'Story',tags:[],aspects:['9:16'],fps:30,
  totalFrames: n * 60,
  slots: Array.from({length:n},(_,i)=>({id:'s'+i,ordinal:i+1,role:'support' as const,media:'either' as const,
    startFrame:i*60,durationFrames:60,fit:'cover' as const,sourceAudio:'mute' as const,transition:'cut' as const})),
  texts:[{id:'headline',defaultText:'Hello',maxChars:40,startFrame:0,durationFrames:60,x:50,y:50,font:'Montserrat',size:48,color:'#ffffff'}],beatAnchors:[0],
})
describe('Batch 4 standalone slot fulfillment', () => {
  it('autofills in exact selection order without invented media, including 30 slots', () => {
    const f=family(30), assets=Array.from({length:30},(_,i)=>image('photo_'+i))
    const { draft,used,rejected }=assignSelectionInOrder(newStudioDraft('release','draft_01234567'),f,assets)
    expect(used).toBe(30);expect(rejected).toHaveLength(0)
    expect(fillProgress(f,draft)).toEqual({filled:30,total:30})
    expect(materializeStudioDraft(f,draft,'instance1').choices.media.s29?.id).toBe('photo_29')
  })
  it('does not silently time-stretch short video', () => {
    const f=family(1);const assigned=assignSelectionInOrder(newStudioDraft('release','draft_01234567'),f,[video('short',32)]).draft
    expect(() => materializeStudioDraft(f,assigned,'instance1')).toThrow('too short')
  })
  it('explicit loop fills exact frames with real repeated source segments', () => {
    const f=family(1);let draft=assignSelectionInOrder(newStudioDraft('release','draft_01234567'),f,[video('short',32)]).draft
    draft={...draft,slots:{...draft.slots,s0:{...draft.slots.s0!,remedy:'loop'}}}
    const out=materializeStudioDraft(f,draft,'instance1')
    expect(out.family.slots.reduce((sum,s)=>sum+s.durationFrames,0)).toBe(60)
    expect(out.family.slots.length).toBe(2)
    expect(out.family.slots[1]?.transition).toBe('cut')
    expect(Object.values(out.choices.media).map(a=>a.id)).toEqual(['short','short'])
  })
  it('explicit hold uses a separately owned image; fails closed without it', () => {
    const f=family(1);let draft=assignSelectionInOrder(newStudioDraft('release','draft_01234567'),f,[video('short',30)]).draft
    draft={...draft,slots:{s0:{...draft.slots.s0!,remedy:'hold'}}}
    expect(()=>materializeStudioDraft(f,draft,'instance1')).toThrow('captured still')
    draft.slots.s0!.holdAsset=image('still1')
    const out=materializeStudioDraft(f,draft,'instance1')
    expect(out.family.slots.map(s=>s.media)).toEqual(['video','image'])
    expect(out.choices.media[out.family.slots[1]!.id]?.id).toBe('still1')
  })

  it('preserves authored source transforms and honors explicit source-audio unmute', () => {
    const f=family(1)
    f.slots[0] = { ...f.slots[0]!, transform: { x: 12, y: -9, scale: 130 },
      sourceAudio: 'mute', media: 'video' }
    let d=assignSelectionInOrder(newStudioDraft('release','draft_01234567'),f,[video('clip',180)]).draft
    d={...d,slots:{s0:{...d.slots.s0!, muteSourceAudio:false}}}
    const compiled=materializeStudioDraft(f,d,'instance1')
    expect(compiled.family.slots[0]!.transform).toMatchObject({x:12,y:-9,scale:130})
    expect(compiled.family.slots[0]!.sourceAudio).toBe('source')
    d.slots.s0!.focalX=70
    expect(materializeStudioDraft(f,d,'instance1').family.slots[0]!.transform?.x).toBe(2)
  })
  it('honors Batch 6 piecewise playback source bounds, rather than assuming 1x speed', () => {
    const f = family(1)
    f.slots[0] = { ...f.slots[0]!, media: 'video',
      playback: { pieces: [{ kind: 'play', frames: 60, rate: 0.5 }] } }
    const d = assignSelectionInOrder(newStudioDraft('release','draft_01234567'),
      f,[video('slow_playback',40)]).draft
    const result = materializeStudioDraft(f,d,'instance1')
    expect(result.family.slots).toHaveLength(1)
    expect(result.family.slots[0]?.playback?.pieces[0]).toMatchObject({ kind: 'play', rate: 0.5 })
    expect(result.choices.media.s0?.id).toBe('slow_playback')
    const unsupported = { ...d, slots: { s0: { ...d.slots.s0!, remedy: 'loop' as const } } }
    expect(() => materializeStudioDraft(f,unsupported,'instance1')).toThrow('Loop/Hold')
    const short = assignSelectionInOrder(newStudioDraft('release','draft_01234567'),
      f,[video('too_short',12)]).draft
    expect(() => materializeStudioDraft(f,short,'instance1')).toThrow('longer source')
  })
  it('fills empty slots in ordinal order even when family slot array is shuffled', () => {
    const f = family(4)
    f.slots = [...f.slots].reverse()
    const assets = [image('a'), image('b'), image('c'), image('d')]
    const { draft, used } = assignSelectionInOrder(newStudioDraft('release', 'draft_01234567'), f, assets)
    expect(used).toBe(4)
    expect(draft.slots.s0?.asset.id).toBe('a')
    expect(draft.slots.s1?.asset.id).toBe('b')
    expect(draft.slots.s2?.asset.id).toBe('c')
    expect(draft.slots.s3?.asset.id).toBe('d')
  })
  it('rejects still photos in variable-speed slots before compilation', () => {
    const f = family(1)
    f.slots[0] = { ...f.slots[0]!,
      playback: { pieces: [{ kind: 'hold', frames: 60 }] } }
    const selection = assignSelectionInOrder(newStudioDraft('release','draft_01234567'),f,[image('still')])
    expect(selection.used).toBe(0)
    expect(selection.rejected.map(asset => asset.id)).toEqual(['still'])
  })
  it('rejects wrong media, overflow and invalid focal point', () => {
    const f=family(1)
    let d=assignSelectionInOrder(newStudioDraft('release','draft_01234567'),f,[image('pic')]).draft
    d.slots.s0!.focalX=110
    expect(()=>materializeStudioDraft(f,d,'instance1')).toThrow('focal')
    expect(moveSelection([1,2,3],0,2)).toEqual([2,3,1])
    expect(moveSelection([1,2,3],-1,2)).toEqual([1,2,3])
  })
})
