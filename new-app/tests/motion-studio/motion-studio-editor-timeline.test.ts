import { describe, expect, it } from 'vitest'
import { agentCanvasVideoLayout, buildMotionStudioEditorEdits, buildLiveMotionStudioEditorEdits, sceneSplitsMs } from '@/lib/motion-studio/editor-timeline'
import type {MsPortableManifest} from '@/lib/motion-studio/portable-contract'
import type { ClipMotionStudioExt } from '@/lib/clips/edits'

const ext: ClipMotionStudioExt = {
  v: 1, projectId: 'ms1', timelineVersion: 1, durationMs: 20000, fps: 30, tracks: [],
  segments: [{ startMs: 0, endMs: 6000 }, { startMs: 6000, endMs: 11000 }, { startMs: 11000, endMs: 20000 }],
}
const markers = [{ id: 'ms_ch_1', ms: 500, color: 'purple' as const, label: 'The setup', chapter: true as const }]

describe('Motion Studio -> Compact Editor timeline', () => {
  it('splits the Video lane at every scene / footage insert and puts the score on the Music lane', () => {
    const e = buildMotionStudioEditorEdits({ base: null, durationMs: 20000, patch: { markers, motionStudio: ext }, musicUploadId: 'msmuA', lastPlacedMusicUploadId: null })
    expect(e.trim).toEqual({ in: 0, out: 20000 })
    expect(e.videoSplits).toEqual([6000, 11000])
    expect(e.audio?.music).toMatchObject({ uploadId: 'msmuA', generationId: 'msmuA', volume: 1, startMs: 0, endMs: 20000 })
    expect(e.markers).toEqual(markers)
    expect(e.layout?.mode).toBe('full_frame')
  })

  it('re-sync keeps user edits, the user\'s own music and a music removal', () => {
    const first = buildMotionStudioEditorEdits({ base: null, durationMs: 20000, patch: { markers, motionStudio: ext }, musicUploadId: 'msmuA', lastPlacedMusicUploadId: null })
    const userTweaked = { ...first, markers: [...(first.markers ?? []), { id: 'u1', ms: 9000, color: 'red' as const }],
      audio: { ...first.audio!, music: { ...first.audio!.music!, volume: 0.4 } } }
    const v2 = { ...ext, timelineVersion: 2, segments: [{ startMs: 0, endMs: 7000 }, { startMs: 7000, endMs: 21000 }] }
    const again = buildMotionStudioEditorEdits({ base: userTweaked, durationMs: 21000, patch: { markers, motionStudio: v2 }, musicUploadId: 'msmuB', lastPlacedMusicUploadId: 'msmuA' })
    expect(again.videoSplits).toEqual([7000])
    expect(again.audio?.music).toMatchObject({ uploadId: 'msmuB', volume: 0.4, endMs: 21000 })
    expect(again.markers?.map(m => m.id)).toEqual(['ms_ch_1', 'u1'])

    const own = { ...first, audio: { music: { generationId: 'up_mine', uploadId: 'up_mine', volume: 0.7 }, sfx: [] } }
    expect(buildMotionStudioEditorEdits({ base: own, durationMs: 20000, patch: { motionStudio: ext }, musicUploadId: 'msmuB', lastPlacedMusicUploadId: 'msmuA' }).audio?.music?.uploadId).toBe('up_mine')

    const removed = { ...first, audio: { music: null, sfx: [] } }
    expect(buildMotionStudioEditorEdits({ base: removed, durationMs: 20000, patch: { motionStudio: ext }, musicUploadId: 'msmuB', lastPlacedMusicUploadId: 'msmuA' }).audio?.music).toBeNull()
  })

  it('a producer refresh keeps the customer trim, canvas and own splits (ChatGPT audit #2)', () => {
    const first = buildMotionStudioEditorEdits({ base: null, durationMs: 10000, patch: { motionStudio: { ...ext, durationMs: 10000, segments: [{ startMs: 0, endMs: 10000 }] } }, musicUploadId: null, lastPlacedMusicUploadId: null })
    const customer = { ...first, aspectRatio: '9:16' as const, trim: { in: 1000, out: 9000 }, videoSplits: [3500] }
    const v2 = { ...ext, durationMs: 10000, timelineVersion: 2, segments: [{ startMs: 0, endMs: 5000 }, { startMs: 5000, endMs: 10000 }] }
    const again = buildMotionStudioEditorEdits({ base: customer, durationMs: 10000, patch: { motionStudio: v2 }, musicUploadId: null, lastPlacedMusicUploadId: null })
    expect(again.aspectRatio).toBe('9:16')
    expect(again.trim).toEqual({ in: 1000, out: 9000 })
    expect(again.videoSplits).toEqual([3500, 5000])
  })

  it('keeps a 3:11 eight-scene film on the full canvas, including baked narration', () => {
    const durationMs = 191_000
    const boundaries = [0, 10_000, 33_000, 56_000, 78_000, 102_000, 129_000, 156_000, durationMs]
    const fullFilm: ClipMotionStudioExt = {
      ...ext, durationMs,
      segments: boundaries.slice(0, -1).map((startMs, i) => ({ startMs, endMs: boundaries[i + 1]! })),
    }
    const edits = buildMotionStudioEditorEdits({
      base: null, durationMs, patch: { motionStudio: fullFilm },
      musicUploadId: null, lastPlacedMusicUploadId: null,
    })
    expect(edits.trim).toEqual({ in: 0, out: 191_000 })
    expect(edits.videoSplits).toEqual(boundaries.slice(1, -1))
    expect((edits.videoSplits?.length ?? 0) + 1).toBe(8)
    // Without an independent narration stem, playback stays on the full
    // assembled source (which includes narration); no fake short replacement.
    expect(edits.sourceSegments ?? []).toEqual([])
    expect(edits.audio?.music).toBeNull()
  })

  it('agent import removes old first-scene override and retains manual media overrides', () => {
    const durationMs = 191_000
    const fullFilm: ClipMotionStudioExt = {
      ...ext, durationMs, segments: [
        { startMs: 0, endMs: 10_000 }, { startMs: 10_000, endMs: 45_000 },
        { startMs: 45_000, endMs: 80_000 }, { startMs: 80_000, endMs: 105_000 },
        { startMs: 105_000, endMs: 130_000 }, { startMs: 130_000, endMs: 150_000 },
        { startMs: 150_000, endMs: 170_000 }, { startMs: 170_000, endMs: 191_000 },
      ],
    }
    const base = buildMotionStudioEditorEdits({ base:null, durationMs, patch: {}, musicUploadId:null, lastPlacedMusicUploadId:null })
    base.sourceSegments = [
      { id: 'ms_scene_1', sourceId: 'scene1', startMs: 0, endMs: 10_000 },
      { id: 'user_broll_override', sourceId: 'custom', startMs: 50_000, endMs: 55_000 },
    ]
    const result = agentCanvasVideoLayout(base, fullFilm, durationMs)
    expect(result.videoSplits).toEqual([10_000, 45_000, 80_000, 105_000, 130_000, 150_000, 170_000])
    expect(result.sourceSegments).toEqual([base.sourceSegments[1]])
  })

  it('older assemblies without a music stem keep the full-mix canvas and no music item', () => {
    const e = buildMotionStudioEditorEdits({ base: null, durationMs: 20000, patch: { motionStudio: ext }, musicUploadId: null, lastPlacedMusicUploadId: null })
    expect(e.audio?.music).toBeNull()
    expect(sceneSplitsMs(undefined, 1000)).toEqual([])
  })
})

describe('native live scene timeline in Compact',()=>{
  const manifest={
    format:'motion-studio-portable/1',projectId:'msp_test',
    assets:[],scenes:[
      {id:'S1',bundleAssetId:'bnd_1',bundleSha256:'a'.repeat(64),
        engine:'browser',runtime:'chrome',manifest:{
          elements:[{id:'title',kind:'text',properties:{text:{tier:'live_editable',type:'text'}}}],
          motionTree:{schema:'transovo.motion-scene-graph/1',rootId:'root',durationMs:2400,
            nodes:[{id:'root',kind:'composition',name:'Root',properties:{}},
              {id:'title',kind:'text',name:'Title',startMs:200,endMs:1900,properties:{}}]},
        }},
      {id:'S2',bundleAssetId:'bnd_2',bundleSha256:'b'.repeat(64),
        engine:'browser',runtime:'chrome',manifest:{elements:[]}},
    ],
    liveProject:{schema:'transovo.live-project/1',projectId:'msp_test',
      format:{width:1920,height:1080,fps:30,durationMs:5000},
      tracks:[
        {id:'visual',kind:'visual',items:[
          {id:'S1',type:'scene',startMs:0,durationMs:2400},
          {id:'S2',type:'scene',startMs:2400,durationMs:2600},
          {id:'scene_plate',type:'sceneLayer',sceneId:'S1',elementId:'footage',
            startMs:0,durationMs:2400,endMs:2400,label:'Footage',kind:'video'}]},
        {id:'voice',kind:'audio',items:[{id:'narration',type:'audio',assetId:'voice_asset',
          startMs:0,durationMs:5000}]},
        {id:'subtitles',kind:'caption',items:[{id:'subtitle_1',type:'caption',text:'Hello',
          startMs:400,durationMs:1200}]},
      ]},
  } as unknown as MsPortableManifest

  it('places scenes and native editable motion layers on Compact lanes without duplicating baked captions',()=>{
    const base=buildMotionStudioEditorEdits({base:null,durationMs:5000,patch:{},
      musicUploadId:null,lastPlacedMusicUploadId:null})
    const result=buildLiveMotionStudioEditorEdits(base,manifest,'msp_test',3)
    expect(result.videoSplits).toEqual([2400])
    expect(result.motionStudio?.segments).toHaveLength(2)
    const all=result.motionStudio!.tracks.flatMap(track=>track.items) as {elementId?:string;id:string}[]
    expect(all.some(item=>item.elementId==='title')).toBe(true)
    expect(all.some(item=>item.elementId==='footage')).toBe(true)
    expect(all.some(item=>item.id==='narration')).toBe(true)
    expect(all.some(item=>item.id==='subtitle_1')).toBe(true)
    expect(result.captionLines).toBeUndefined()
  })
  it('preserves manual splits and trim across refreshed native versions',()=>{
    const base=buildMotionStudioEditorEdits({base:null,durationMs:5000,patch:{},
      musicUploadId:null,lastPlacedMusicUploadId:null})
    base.trim={in:300,out:4700}
    base.videoSplits=[1800]
    const result=buildLiveMotionStudioEditorEdits(base,manifest,'msp_test',4)
    expect(result.trim).toEqual({in:300,out:4700})
    expect(result.videoSplits).toEqual([1800,2400])
    expect(result.motionStudio?.timelineVersion).toBe(4)
  })
})
