export const CLIP_AGENT_EXPORT_PRESET='mp4:720p:9:16'

function fnv1aHex(input:string,seed=0x811c9dc5):string{
  let h=seed>>>0
  for(let i=0;i<input.length;i++){
    h^=input.charCodeAt(i)
    h=Math.imul(h,0x01000193)>>>0
  }
  return h.toString(16).padStart(8,'0')
}
function digest40(input:string):string{
  return fnv1aHex(input)+fnv1aHex(input,0x811c9dc5^0x9e3779b9)+fnv1aHex('~'+input)+fnv1aHex(input+'~')+fnv1aHex(input+input)
}

/** Stable key so the same clip + edit version + preset cannot be queued twice. */
export function clipAgentExportIdempotencyKey(input:{
  clipId:string
  editVersion:string
  preset?:string
}):string{
  const preset=input.preset??CLIP_AGENT_EXPORT_PRESET
  return digest40(`${input.clipId}\n${input.editVersion}\n${preset}`)
}

export function editVersionFromSnapshot(snapshot:unknown):string{
  return digest40(JSON.stringify(snapshot??null))
}

/**
 * Auto-export only published CLEAN clips. needsReview clips still publish,
 * but get no auto-render until the user reviews and exports manually.
 * Critical / suppressed drafts must never be queued.
 */
export function shouldAutoExportPublishedClip(input:{
  suppressed?:boolean
  critical?:boolean
  needsReview?:boolean
  clipId?:string|null
  projectId?:string|null
}):boolean{
  if(!input.clipId||!input.projectId)return false
  if(input.suppressed===true||input.critical===true)return false
  if(input.needsReview===true)return false
  return true
}

/** Auto Motion (autoPlanClipMotion) uses the same gate as auto-export. */
export function shouldAutoPlanClipMotion(input:{
  suppressed?:boolean
  critical?:boolean
  needsReview?:boolean
  clipId?:string|null
}):boolean{
  if(!input.clipId)return false
  if(input.suppressed===true||input.critical===true)return false
  if(input.needsReview===true)return false
  return true
}

export type ClipAgentExportStore={
  findByIdempotencyKey:(key:string)=>Promise<{id:string;status:string}|null>
  /**
   * Must be atomic: backed by the unique index
   * clip_renders(clipId, editsVersionHash, preset). On a unique conflict the
   * store returns {created:false, existing} instead of throwing.
   */
  createQueuedExport:(input:{
    renderId:string
    clipId:string
    workspaceId:string
    projectId:string
    idempotencyKey:string
    preset:string
    filename:string
  })=>Promise<{created:true}|{created:false;existing:{id:string;status:string}}>
}

export type QueueClipExportResult=
  |{queued:true;renderId:string;idempotencyKey:string}
  |{queued:false;reason:'not_exportable'|'already_queued';renderId?:string;idempotencyKey?:string}

/** Prisma unique-constraint violation (P2002). */
export function isUniqueConflict(error:unknown):boolean{
  return Boolean(error&&typeof error==='object'&&(error as {code?:unknown}).code==='P2002')
}

export async function queueClipExportOnce(input:{
  workspaceId:string
  projectId?:string|null
  clipId?:string|null
  filename:string
  editVersion:string
  preset?:string
  suppressed?:boolean
  critical?:boolean
  needsReview?:boolean
  createId:(prefix:string)=>string
  store:ClipAgentExportStore
}):Promise<QueueClipExportResult>{
  if(!shouldAutoExportPublishedClip(input)){
    return {queued:false,reason:'not_exportable'}
  }
  const preset=input.preset??CLIP_AGENT_EXPORT_PRESET
  const idempotencyKey=clipAgentExportIdempotencyKey({
    clipId:input.clipId!,
    editVersion:input.editVersion,
    preset,
  })
  // Fast path only; correctness comes from the unique index in createQueuedExport.
  const existing=await input.store.findByIdempotencyKey(idempotencyKey)
  if(existing){
    return {queued:false,reason:'already_queued',renderId:existing.id,idempotencyKey}
  }
  const renderId=input.createId('render')
  const created=await input.store.createQueuedExport({
    renderId,
    clipId:input.clipId!,
    workspaceId:input.workspaceId,
    projectId:input.projectId!,
    idempotencyKey,
    preset,
    filename:input.filename,
  })
  if(!created.created){
    return {queued:false,reason:'already_queued',renderId:created.existing.id,idempotencyKey}
  }
  return {queued:true,renderId,idempotencyKey}
}
