// Captures an explicitly authored *full composition*, not just a scene plate.
// This process gets local files only: no producer credential or signed URL.
import puppeteer from 'puppeteer-core'
import {spawn} from 'node:child_process'
import {createServer} from 'node:http'
import {readFile,stat} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const args=process.argv.slice(2)
if(args.length!==9)throw Error('Expected root, entry, output, width, height, fps, first, end, mode')
const [root,entry,output,w,h,f,first,last,mode]=args
const width=Number(w),height=Number(h),fps=Number(f),start=Number(first),end=Number(last)
if(![width,height,fps,start,end].every(Number.isSafeInteger)||width<2||height<2||
  fps<1||fps>120||start<0||end<=start||end-start>1000)throw Error('Invalid capture range')
const rootDir=path.resolve(root)
const entryPath=path.resolve(rootDir,entry)
if(!entryPath.startsWith(rootDir+path.sep))throw Error('Entry outside bundle root')
await stat(entryPath)
const mime=file=>file.endsWith('.html')?'text/html':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':
  file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':
  file.endsWith('.png')?'image/png':file.endsWith('.jpg')||file.endsWith('.jpeg')?'image/jpeg':
  file.endsWith('.woff2')?'font/woff2':file.endsWith('.svg')?'image/svg+xml':
  file.endsWith('.mp4')?'video/mp4':file.endsWith('.webm')?'video/webm':'application/octet-stream'
const server=createServer(async(req,res)=>{
  try{
    const uri=new URL(req.url||'/', 'http://127.0.0.1')
    const decoded=decodeURIComponent(uri.pathname)
    const file=path.resolve(rootDir,'.'+decoded)
    if(!file.startsWith(rootDir+path.sep))throw Error('Path escape')
    const data=await readFile(file)
    res.writeHead(200,{'content-type':mime(file),'Cache-Control':'no-store'});res.end(data)
  }catch{res.writeHead(404);res.end()}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const port=server.address().port
const chromium=process.env.CHROMIUM_BIN||'/usr/bin/chromium'
const browser=await puppeteer.launch({executablePath:chromium,headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling',
    '--disable-renderer-backgrounding','--hide-scrollbars',
    ...(mode==='gpu'?['--use-gl=angle','--use-angle=gl','--enable-gpu-rasterization']:
      ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])]})
let ffmpeg
try{
  const page=await browser.newPage()
  await page.setViewport({width,height,deviceScaleFactor:1})
  await page.setRequestInterception(true)
  page.on('request',r=>{
    try{const u=new URL(r.url());if(u.hostname==='127.0.0.1'&&u.port===String(port))void r.continue()
      else void r.abort()}catch{void r.abort()}
  })
  const entryUrl='http://127.0.0.1:'+port+'/'+entry.split('/').map(encodeURIComponent).join('/')
  await page.goto(entryUrl,{waitUntil:'networkidle0',timeout:120000})
  const valid=await page.evaluate(()=>Boolean(window.__scene&&typeof window.__scene.seek==='function'))
  if(!valid)throw Error('No window.__scene.seek(t) on full-composition entrypoint')
  ffmpeg=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',
    '-f','image2pipe','-framerate',String(fps),'-vcodec','png','-i','pipe:0',
    '-c:v','libx264','-preset','medium','-crf','16','-profile:v','high',
    '-level:v','4.2','-pix_fmt','yuv420p','-movflags','+faststart','-an',output],
    {stdio:['pipe','ignore','pipe']})
  let err=''
  ffmpeg.stderr.on('data',d=>{err+=d.toString().slice(0,500)})
  for(let frame=start;frame<end;frame++){
    await page.evaluate(async time=>await window.__scene.seek(time),frame/fps)
    const png=await page.screenshot({type:'png'})
    if(!ffmpeg.stdin.write(png))
      await new Promise((resolve,reject)=>{
        ffmpeg.stdin.once('drain',resolve);ffmpeg.stdin.once('error',reject)
      })
  }
  ffmpeg.stdin.end()
  const exit=await new Promise(resolve=>ffmpeg.on('close',resolve))
  if(exit!==0)throw Error('Segment encoder failed '+err.slice(0,300))
}finally{
  if(ffmpeg?.exitCode===null)ffmpeg.kill('SIGKILL')
  await browser.close()
  await new Promise(resolve=>server.close(resolve))
}
