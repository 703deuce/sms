import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {sceneFileResponse} from '@/lib/server/motion-studio/scene-host'
type Ctx={params:Promise<{
  projectId:string;versionId:string;bundleAssetId:string;expires:string;
  signature:string;file:string[]
}>}
export async function GET(request:Request,ctx:Ctx){
  try{
    const p=await ctx.params
    return await sceneFileResponse({
      projectId:p.projectId,versionId:p.versionId,bundleAssetId:p.bundleAssetId,
      expires:p.expires,signature:p.signature,filePath:p.file.join('/'),requestUrl:request.url,
    })
  }catch(e){return motionStudioJsonError(e)}
}
