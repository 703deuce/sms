/** A Flow-approved inward edit wins over footage length preferences.
 * In particular, never re-extend an editorially clean ending to 60 seconds.
 */
export function selectMomentFlowTrim<T extends {startMs:number;endMs:number;kind?:string}>(
  footage:T, proposed:T|null|undefined,
):{selection:T;accepted:boolean}{
  const accepted=Boolean(proposed&&proposed.kind!=='visual_action'&&
    proposed.startMs>=footage.startMs&&proposed.endMs<=footage.endMs&&
    proposed.endMs>proposed.startMs)
  return {selection:accepted?proposed!:footage,accepted}
}
