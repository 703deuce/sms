import {
  auditB8Evidence,generateB8Candidates,reportB8Quality,scoreB8Review,type B8Evidence,
} from './b8-factory'
import { b8ReferenceForFamily } from './b8-reference-catalog'

export type TemplateHumanReview={
  id:string
  reviewer:string
  reviewDate:string
  referenceUrl:string
  referenceAccessDate:string
  scores:B8Evidence['scores']
  checks:Pick<B8Evidence['checks'],'glyphsPresent'|'contrastReadable'|'safeZones'|'rightsCleared'>
  independentReviewer?:string
  flagged?:boolean
}
export type TemplateReviewImportResult={
  evidence:B8Evidence[]
  reviewed:number
  evidencePassing:number
  releaseEligible:number
  rejected:Array<{id:string;reason:string}>
}
const DATE=/^20\d\d-\d\d-\d\d$/
const name=(value:string)=>value.trim().replace(/\s+/g,' ')
export function applyTemplateHumanReviews(
  existing:readonly B8Evidence[],
  reviews:readonly TemplateHumanReview[],
):TemplateReviewImportResult{
  const candidates=new Map(generateB8Candidates().map(candidate=>[candidate.id,candidate]))
  const evidenceById=new Map(existing.map(row=>[row.id,structuredClone(row)]))
  const seen=new Set<string>()
  const rejected:Array<{id:string;reason:string}>=[]
  let reviewed=0
  for(const raw of reviews){
    const id=String(raw?.id??'')
    try{
      if(seen.has(id))throw new Error('duplicate review ID')
      seen.add(id)
      const candidate=candidates.get(id)
      if(!candidate)throw new Error('unknown template design')
      const current=evidenceById.get(id)
      if(!current?.outputs?.renderSha256||!current.outputs.previewSha256||!current.outputs.posterSha256)
        throw new Error('machine render evidence must exist before human review')
      if(current.checks?.actualWorkerRender!==true)
        throw new Error('human review cannot replace actual worker render proof')
      const reviewer=name(raw.reviewer??'')
      if(reviewer.length<2)throw new Error('reviewer identity required')
      if(!DATE.test(raw.reviewDate??''))throw new Error('review date must be YYYY-MM-DD')
      const pinned=b8ReferenceForFamily(candidate.familyId)
      if(raw.referenceUrl!==pinned.url||raw.referenceAccessDate!==pinned.accessDate)
        throw new Error('review must use the pinned same-type competitor reference')
      const scores=raw.scores
      if(!scores||Object.keys(scores).length!==6)
        throw new Error('all six rubric scores are required')
      for(const [key,value] of Object.entries(scores))
        if(!Number.isFinite(value)||value<1||value>5)
          throw new Error('all rubric scores must be numbers from 1 to 5: '+key)
      if(!raw.checks?.glyphsPresent||!raw.checks?.contrastReadable||
         !raw.checks?.safeZones||!raw.checks?.rightsCleared)
        throw new Error('glyph, contrast, safe-zone and rights review must all pass')
      const independent=raw.independentReviewer?name(raw.independentReviewer):''
      if(independent&&independent===reviewer)
        throw new Error('independent reviewer must differ from primary reviewer')
      const next:B8Evidence={
        ...current,
        reference:{url:pinned.url,accessDate:pinned.accessDate,mediaKind:'photo_video'},
        reviewer,reviewDate:raw.reviewDate,scores:{...scores},
        checks:{...current.checks,...raw.checks},
        ...(independent?{independentReviewer:independent}:{}),
        ...(raw.flagged!=null?{flagged:Boolean(raw.flagged)}:{}),
      }
      evidenceById.set(id,next)
      reviewed++
    }catch(error){
      rejected.push({id,reason:error instanceof Error?error.message:String(error)})
    }
  }
  const evidence=[...evidenceById.values()].sort((a,b)=>a.id.localeCompare(b.id))
  let evidencePassing=0
  for(const row of evidence){
    const candidate=candidates.get(row.id)
    if(candidate&&!auditB8Evidence(candidate,row).length){
      const score=scoreB8Review(row)
      if(score.score>=9&&score.minimum)evidencePassing++
    }
  }
  const releaseEligible=reportB8Quality([...candidates.values()],evidence).released
  return {evidence,reviewed,evidencePassing,releaseEligible,rejected}
}
