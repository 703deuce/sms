import 'server-only'
import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/server/db'
import { getYoutubeVideoRun } from '@/lib/youtube-video/runs'
import { productionRunDeps } from '@/lib/server/youtube-video/deps'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Called by a separately deployed Coolify YouTube driver, not by the browser.
 * Each tick advances one durable state transition for each active run. */
export async function POST(request:Request){
  const secret=process.env.YOUTUBE_VIDEO_DRIVER_TOKEN || process.env.CRON_SECRET
  if(!secret || request.headers.get('authorization')!==`Bearer ${secret}`){
    return NextResponse.json({error:'unauthorized'},{status:401})
  }
  const db=getPrisma()
  const runs=await db.youtubeVideoRun.findMany({
    where:{status:{in:['queued','importing','waiting_for_source','running']}},
    select:{id:true,workspaceId:true},orderBy:{updatedAt:'asc'},take:16,
  })
  const results:Array<{runId:string;status:string;error?:string}>=[]
  // Only 4 active runs per HTTP tick. Each run advances up to 4 windows.
  for(let i=0;i<runs.length;i+=4){
    const batch=await Promise.all(runs.slice(i,i+4).map(async run=>{
      try{
        const view=await getYoutubeVideoRun(run.workspaceId,run.id,productionRunDeps())
        return {runId:run.id,status:view.status}
      }catch(error){
        return {runId:run.id,status:'error',
          error:error instanceof Error?error.name:'unknown'}
      }
    }))
    results.push(...batch)
  }
  return NextResponse.json({advanced:results.length,results})
}
