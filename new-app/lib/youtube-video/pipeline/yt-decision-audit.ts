import type { YtCheckpoint, YtFinishedWindow } from './yt-types'
import type { YoutubeVideoOption, YoutubeVideoResult } from '@/lib/youtube-video/types'

type Audit = NonNullable<YoutubeVideoResult['analysisAudit']>
const clean=(v:string)=>v.replace(/SCENE_KEY\s*[:=]\s*[^;\n]+;?/ig,'').replace(/ACTION_PHASE\s*[:=]\s*\w+;?/ig,'').trim()
const category=(s:string)=>/loading|menu|queue|lobby/i.test(s)?'Menu / loading':
  /idle|afk|brb|waiting/i.test(s)?'Dead time':
  /repeat|grind|duplicate/i.test(s)?'Repetition':
  /off.story|tangent|chat/i.test(s)?'Off-story':
  'Not selected'
function windowsForSource(windows:YtFinishedWindow[],sourceId:string) {
  return windows.filter(w=>w.cuts.some(c=>c.sourceId===sourceId))
}
/** Source gaps are computed from actual selected time ranges: no footage is
 * silently omitted from the audit. Reasons are observation-backed or explicitly
 * say that the model did not record a reason. */
export function ytBuildDecisionAudit(
  checkpoint:YtCheckpoint,option:YoutubeVideoOption,
):Audit{
  const all=checkpoint.finished.flatMap(w=>w.cuts)
  const indices=checkpoint.final?.selectedIndices??all.map((_,i)=>i)
  const scenes=indices.map((idx,i)=>{
    const cut=all[idx]!
    return {sourceId:cut.sourceId,startMs:cut.startMs,endMs:cut.endMs,
      title:checkpoint.final?.chapterTitles?.[i]||cut.beat||cut.label||'Gameplay scene',
      reason:cut.reason||cut.groundedEvidence||'Chosen for the continuing gameplay story'}
  })
  const sourceIds=[...new Set(checkpoint.finished.flatMap(w=>w.cuts.map(c=>c.sourceId)))]
  const omitted:NonNullable<Audit['cutSpans']>=[]
  for(const sourceId of sourceIds){
    const windows=windowsForSource(checkpoint.finished,sourceId)
    if(!windows.length)continue
    const sourceEnd=Math.max(...windows.map(w=>w.endMs))
    const sourceStart=Math.min(...windows.map(w=>w.startMs))
    const spans=scenes.filter(c=>c.sourceId===sourceId)
      .sort((a,b)=>a.startMs-b.startMs)
    let position=sourceStart
    for(const span of [...spans,{startMs:sourceEnd,endMs:sourceEnd}]){
      if(span.startMs>position){
        const startMs=position,endMs=span.startMs
        const evidence=windows.flatMap(w=>w.observedScenes??[]).filter(o=>
          o.startMs<endMs&&o.endMs>startMs)
        const recorded=evidence.filter(o=>/loading|menu|queue|idle|afk|repeat|grind|off.story|tangent|brb|lobby/i.test(o.description))
        const explanation=recorded.map(o=>clean(o.description)).filter(Boolean).slice(0,3).join('; ')
        omitted.push({sourceId,startMs,endMs,durationMs:endMs-startMs,
          category:recorded.length?category(explanation):'Not selected',
          reason:explanation||'Not selected for the final story; no specific exclusion reason was recorded',
          sceneContext:scenes.filter(c=>c.sourceId===sourceId&&
            (Math.abs(c.endMs-startMs)<120_000||Math.abs(c.startMs-endMs)<120_000))
            .map(c=>c.title).slice(0,2).join(' / ')||'Between story scenes'})
      }
      position=Math.max(position,span.endMs)
    }
  }
  const revisionSteps:NonNullable<Audit['qaRevisions']>=[
    ...checkpoint.finished.flatMap((window,index)=>(window.qaRounds??[]).map(round=>({
      scope:`Window ${index+1}`,round:round.round,status:round.resolution,
      issues:round.issues,
      explanation:round.resolution==='Passed after revision'
        ?'This window passed QA after the changes in its revision rounds.'
        :'The next editorial pass was instructed to fix the identified missing or broken story evidence.',
    }))),
    ...(checkpoint.final?.qaRounds??[]).map(round=>({
      scope:'Global episode',round:round.round,status:round.resolution,
      issues:round.issues,
      explanation:round.resolution==='Passed after revision'
        ?'The combined story passed global QA after revision.'
        :'Global story selection was revised using these full QA explanations.',
    })),
  ]
  return {
    premise:checkpoint.final?.premise??option.premise,
    needsReview:!!checkpoint.final?.needsReview||checkpoint.finished.some(w=>w.qaPassed===false),
    scenes,cutSpans:omitted,qaRevisions:revisionSteps,
    globalQaIssues:checkpoint.final?.qaIssues??[],
    globalQaIssueHistory:checkpoint.final?.qaIssueHistory??[],
    steps:checkpoint.steps,
    windows:checkpoint.finished.map(w=>({
      sourceIndex:w.sourceIndex,startMs:w.startMs,endMs:w.endMs,
      qaPassed:w.qaPassed,qaIssues:w.qaIssues??[],qaIssueHistory:w.qaIssueHistory??[],
      acceptedCuts:w.cuts.map(c=>({sourceId:c.sourceId,startMs:c.startMs,endMs:c.endMs})),
      rejectedCuts:w.rejected,
    }))
  }
}
