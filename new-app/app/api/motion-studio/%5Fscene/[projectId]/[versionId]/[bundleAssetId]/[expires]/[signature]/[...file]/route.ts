import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {sceneFileResponse} from '@/lib/server/motion-studio/scene-host'
type Ctx={params:Promise<{
  projectId:string;versionId:string;bundleAssetId:string;expires:string;
  signature:string;file:string[]
}>}
export async function GET(request:Request,ctx:Ctx){
  const started=Date.now()
  let category='unknown'
  try{
    const p=await ctx.params
    category=p.file[0]==='_asset'?'asset':p.file.join('/')==='index.html'?'index':'scene-file'
    const response=await sceneFileResponse({
      projectId:p.projectId,versionId:p.versionId,bundleAssetId:p.bundleAssetId,
      expires:p.expires,signature:p.signature,filePath:p.file.join('/'),requestUrl:publicRequestUrl(request),
    })
    console.info('[motion-studio:load]',{kind:'scene-file',category,projectId:p.projectId,status:response.status,elapsedMs:Date.now()-started})
    return response
  }catch(e){
    console.warn('[motion-studio:load]',{kind:'scene-file',category,status:'error',elapsedMs:Date.now()-started,error:e instanceof Error?e.message:'unknown'})
    return motionStudioJsonError(e)
  }
}

/**
 * Behind the reverse proxy, request.url can carry the container's internal
 * origin (http://0.0.0.0:3000). The scene host compares the request origin with
 * the public app origin, so rebuild it from the proxy's forwarded headers.
 * The HMAC path signature remains the actual authorization.
 */
function publicRequestUrl(request:Request):string{
  const internal=new URL(request.url)
  const host=(request.headers.get('x-forwarded-host')||request.headers.get('host')||'').split(',')[0]!.trim()
  const proto=(request.headers.get('x-forwarded-proto')||internal.protocol.replace(':','')).split(',')[0]!.trim()
  if(!host||!/^https?$/.test(proto))return request.url
  try{return new URL(internal.pathname+internal.search,proto+'://'+host).toString()}
  catch{return request.url}
}
