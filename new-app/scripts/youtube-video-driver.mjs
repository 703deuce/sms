#!/usr/bin/env node
// Dedicated YouTube episode driver. Run as a separate persistent Coolify service:
// YOUTUBE_VIDEO_DRIVER_URL=https://your-domain.example
// YOUTUBE_VIDEO_DRIVER_TOKEN=<same secret as web> node scripts/youtube-video-driver.mjs
// Does not consume clipper/SMS jobs and never needs a browser poll.
const base=process.env.YOUTUBE_VIDEO_DRIVER_URL?.replace(/\/$/,'')
const token=process.env.YOUTUBE_VIDEO_DRIVER_TOKEN || process.env.CRON_SECRET
if(!base || !token){
  console.error('YOUTUBE_VIDEO_DRIVER_URL and YOUTUBE_VIDEO_DRIVER_TOKEN required')
  process.exit(1)
}
const delay=Number(process.env.YOUTUBE_VIDEO_DRIVER_INTERVAL_MS || 6000)
const interval=Math.max(3000,Math.min(60000,Number.isFinite(delay)?delay:6000))
let stopping=false
process.on('SIGTERM',()=>{stopping=true})
process.on('SIGINT',()=>{stopping=true})
while(!stopping){
  try{
    const res=await fetch(`${base}/api/cron/youtube-video`,{
      method:'POST',headers:{Authorization:`Bearer ${token}`},
      signal:AbortSignal.timeout(55_000),cache:'no-store',
    })
    if(!res.ok)console.error('[youtube-video:driver] tick_failed',res.status)
    else{
      const json=await res.json()
      console.info('[youtube-video:driver] tick',json.advanced)
    }
  }catch(error){
    console.error('[youtube-video:driver] request_error',
      error instanceof Error?error.name:'unknown')
  }
  if(!stopping)await new Promise(resolve=>setTimeout(resolve,interval))
}
