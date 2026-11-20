// Browser-only validation: seek three timestamps in the full composition.
// Uses local files only. No video render and no external media requests.
import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'

const [root,entry,w,h,duration] = process.argv.slice(2)
if(!root||!entry||![w,h,duration].every(x=>Number.isFinite(Number(x))))
  throw Error('Invalid project page checks')
const base=path.resolve(root)
const entryFile=path.resolve(base,entry)
if(!entryFile.startsWith(base+path.sep))throw Error('Page outside archive')
const mime=file=>file.endsWith('.html')?'text/html':file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':
  file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':
  file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':
  file.endsWith('.jpg')||file.endsWith('.jpeg')?'image/jpeg':
  file.endsWith('.webm')?'video/webm':file.endsWith('.mp4')?'video/mp4':
  file.endsWith('.woff2')?'font/woff2':'application/octet-stream'
const http=createServer(async(req,res)=>{
  try{
    const u=new URL(req.url||'/','http://127.0.0.1')
    const file=path.resolve(base,'.'+decodeURIComponent(u.pathname))
    if(!file.startsWith(base+path.sep))throw Error('Path escape')
    const bytes=await readFile(file)
    res.writeHead(200,{'Content-Type':mime(file)})
    res.end(bytes)
  }catch{res.writeHead(404);res.end()}
})
await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve))
let browser
try{
  // The producer's engine install can expose puppeteer-core through NODE_PATH;
  // this validator never downloads a browser or calls a paid service.
  const require=createRequire(import.meta.url)
  let puppeteer
  try{puppeteer=require('puppeteer-core')}
  catch{
    if(!process.env.MOTION_PUPPETEER_MODULE)throw Error('puppeteer-core missing')
    puppeteer=require(process.env.MOTION_PUPPETEER_MODULE)
  }
  const port=http.address().port
  browser=await puppeteer.launch({headless:true,
    executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',
    args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader']})
  const page=await browser.newPage()
  await page.setViewport({width:Number(w),height:Number(h)})
  await page.setRequestInterception(true)
  page.on('request',request=>{
    try{
      const u=new URL(request.url())
      if(u.hostname==='127.0.0.1'&&u.port===String(port))void request.continue()
      else void request.abort()
    }catch{void request.abort()}
  })
  await page.goto('http://127.0.0.1:'+port+'/'+entry.split('/').map(encodeURIComponent).join('/'),
    {waitUntil:'networkidle0',timeout:60000})
  const valid=await page.evaluate(()=>Boolean(window.__scene&&typeof window.__scene.seek==='function'))
  if(!valid)throw Error('Composition does not expose seek(t)')
  for(const t of [0,Math.max(0,Number(duration)/2),Math.max(0,Number(duration)-1/30)]){
    await page.evaluate(async x=>await window.__scene.seek(x),t)
    const png=await page.screenshot({type:'png'})
    if(png.length<1000)throw Error('Incomplete composed frame')
  }
  process.stdout.write('PASS composition seeks 3 frames\n')
}finally{
  await browser?.close()
  await new Promise(resolve=>http.close(resolve))
}
