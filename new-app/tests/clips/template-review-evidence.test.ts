import { describe,expect,it } from 'vitest'
import { generateB8Candidates,type B8Evidence } from '@/lib/clips/real-video-templates/b8-factory'
import { b8ReferenceForFamily } from '@/lib/clips/real-video-templates/b8-reference-catalog'
import { applyTemplateHumanReviews } from '@/lib/clips/real-video-templates/review-evidence'
const hash='a'.repeat(64)
function machineEvidence(id='f01_bold'):B8Evidence{
  const candidate=generateB8Candidates().find(row=>row.id===id)!
  const ref=b8ReferenceForFamily(candidate.familyId)
  return {
    id,reference:{url:ref.url,accessDate:ref.accessDate,mediaKind:'photo_video'},
    fixtures:{images:['image'],videos:['video'],licenseHashes:[hash]},
    outputs:{previewMp4:'/templates/preview.mp4',renderMp4:'/templates/render.mp4',
      poster:'/templates/poster.webp',previewSha256:hash,renderSha256:hash,posterSha256:hash},
    renderTiming:{v:1,totalFrames:candidate.family.totalFrames,
      boundaries:[0,...candidate.family.slots.map(s=>s.startFrame+s.durationFrames)],
      musicScheduleSha256:hash},
    checks:{fullFrameStructure:true,durationMatch:true,audioParity:true,beatAligned:true,
      firstLastNotBlack:true,boundariesNotBlack:true,sampledFrameParity:true,
      glyphsPresent:false,contrastReadable:false,safeZones:false,layerRetention:true,
      rightsCleared:false,noExcessFlashing:true,actualWorkerRender:true},
    reviewer:'',reviewDate:'',
    scores:{pacing:0,beatSemantic:0,transition:0,typography:0,motion:0,color:0},
  }
}
describe('template human review evidence import',()=>{
  it('adds human fields without replacing machine render hashes',()=>{
    const current=machineEvidence()
    const ref=b8ReferenceForFamily('f01')
    const result=applyTemplateHumanReviews([current],[{
      id:'f01_bold',reviewer:'Reviewer One',reviewDate:'2026-11-11',
      referenceUrl:ref.url,referenceAccessDate:ref.accessDate,
      scores:{pacing:5,beatSemantic:5,transition:5,typography:5,motion:5,color:5},
      checks:{glyphsPresent:true,contrastReadable:true,safeZones:true,rightsCleared:true},
      independentReviewer:'Reviewer Two',
    }])
    expect(result.rejected).toEqual([])
    expect(result.reviewed).toBe(1)
    expect(result.evidence[0]?.outputs.renderSha256).toBe(hash)
    expect(result.evidence[0]?.independentReviewer).toBe('Reviewer Two')
  })
  it('rejects unpinned references and fake machine proof',()=>{
    const base=machineEvidence()
    const bad=applyTemplateHumanReviews([{...base,checks:{...base.checks,actualWorkerRender:false}}],[{
      id:'f01_bold',reviewer:'Same Person',reviewDate:'2026-11-11',
      referenceUrl:'https://www.capcut.com/template-detail/Other/1',referenceAccessDate:'2026-11-11',
      scores:{pacing:5,beatSemantic:5,transition:5,typography:5,motion:5,color:5},
      checks:{glyphsPresent:true,contrastReadable:true,safeZones:true,rightsCleared:true},
      independentReviewer:'Same Person',
    }])
    expect(bad.reviewed).toBe(0)
    expect(bad.rejected).toHaveLength(1)
  })
})
