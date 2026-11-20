// Browser-only validation: seek three timestamps in the full composition.
// Uses local files only. No video render and no external media requests.
import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'

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
  let puppeteer
  const candidates=[process.env.PUPPETEER_DIR,'/workspace/motion_engines/_capture',
                    process.env.MOTION_PUPPETEER_MODULE,process.cwd()].filter(Boolean)
  for(const candidate of candidates){
    try{puppeteer=createRequire(path.join(candidate,'x.js'))('puppeteer-core');break}
    catch{}
  }
  if(!puppeteer)throw Error('puppeteer-core missing; set PUPPETEER_DIR')
  const chromeCandidates=[process.env.CHROMIUM_BIN,'/usr/bin/google-chrome','/usr/bin/chromium']
    .filter(Boolean)
  const chromium=chromeCandidates.find(candidate=>existsSync(candidate))
  if(!chromium)throw Error('browser not found')
  const port=http.address().port
  browser=await puppeteer.launch({headless:true,
    executablePath:chromium,
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
  const valid=await page.evaluate(()=>({
    seek:Boolean(window.__scene&&typeof window.__scene.seek==='function'),
    ready:window.__ready===true
  }))
  if(!valid.seek||!valid.ready)throw Error('Composition seek or readiness contract missing')
  const fps=Number(process.argv[6]),frames=Number(process.argv[7])
  const hashes=[]
  for(const frame of [0,Math.floor(frames/2),frames-1]){
    await page.evaluate(async x=>{
      await window.__scene.seek(x)
      await new Promise(resolve=>requestAnimationFrame(resolve))
    },frame/fps)
    const png=await page.screenshot({type:'png'})
    if(png.length<1000)throw Error('Incomplete composed frame')
    hashes.push(createHash('sha256').update(png).digest('hex'))
  }
  await page.evaluate(async()=>{
    await window.__scene.seek(0)
    await new Promise(resolve=>requestAnimationFrame(resolve))
  })
  const firstAgain=createHash('sha256').update(await page.screenshot({type:'png'})).digest('hex')
  if(firstAgain!==hashes[0])throw Error('Composition seek is not deterministic')
  process.stdout.write('PASS composition seeks 3 frames\n')
}finally{
  await browser?.close()
  await new Promise(resolve=>http.close(resolve))
}
