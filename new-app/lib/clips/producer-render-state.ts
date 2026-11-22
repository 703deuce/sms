/** Render status must not infer failure from a transient missing queue row. */
export type ProducerRenderStatus='queued'|'rendering'|'done'|'failed'
export function producerRenderState(input:{
  ready:boolean;renderStatus?:string|null;enqueueError?:string|null
}):ProducerRenderStatus{
  if(input.ready)return 'done'
  if(input.renderStatus==='FAILED'||Boolean(input.enqueueError))return 'failed'
  if(input.renderStatus==='RENDERING')return 'rendering'
  return 'queued'
}
