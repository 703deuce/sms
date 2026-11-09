/** Flow-approved natural landing wins over target length.
 * Allow a SMALL amount of original source to restore missing setup or a
 * meaning-changing qualifier; never pad toward a target duration.
 */
export function selectMomentFlowTrim<T extends {startMs:number;endMs:number;kind?:string}>(
  footage:T, proposed:T|null|undefined,
  context:{maxEarlierSetupMs?:number;maxLaterConclusionMs?:number}={},
):{selection:T;accepted:boolean}{
  const earlier=Math.max(0,context.maxEarlierSetupMs??0)
  const later=Math.max(0,context.maxLaterConclusionMs??0)
  const accepted=Boolean(proposed&&proposed.kind!=='visual_action'&&
    proposed.startMs>=footage.startMs-earlier&&
    proposed.endMs<=footage.endMs+later&&
    proposed.endMs>proposed.startMs)
  return {selection:accepted?proposed!:footage,accepted}
}
