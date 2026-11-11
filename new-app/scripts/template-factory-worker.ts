import { dirname } from 'node:path'
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'

export type B8RemoteConfig={baseUrl:string;headers:Record<string,string>}

export function b8RemoteConfig(rawBaseUrl:string):B8RemoteConfig{
  if(!rawBaseUrl)throw new Error('Remote worker runner needs --base-url or B8_QA_BASE_URL')
  const url=new URL(rawBaseUrl)
  const local=['localhost','127.0.0.1','::1'].includes(url.hostname)
  if(url.protocol!=='https:'&&!(local&&url.protocol==='http:'))
    throw new Error('Remote worker runner requires HTTPS (HTTP is allowed only on localhost)')
  const cookie=process.env.B8_QA_COOKIE?.trim()
  const authorization=process.env.B8_QA_AUTHORIZATION?.trim()
  if(!cookie&&!authorization)
    throw new Error('Set B8_QA_COOKIE or B8_QA_AUTHORIZATION in the environment; credentials are never accepted as CLI arguments')
  const headers:Record<string,string>={Accept:'application/json'}
  if(cookie)headers.Cookie=cookie
  if(authorization)headers.Authorization=authorization
  return {baseUrl:url.toString(),headers}
}

function sameOrigin(config:B8RemoteConfig,url:URL){
  return url.origin===new URL(config.baseUrl).origin
}
export async function b8ApiJson<T>(
  config:B8RemoteConfig,path:string,init:RequestInit={},
):Promise<T>{
  const url=new URL(path,config.baseUrl)
  if(!sameOrigin(config,url))throw new Error('API request attempted to leave configured app origin')
  const headers=new Headers(init.headers)
  for(const [key,value] of Object.entries(config.headers))headers.set(key,value)
  if(init.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json')
  const response=await fetch(url,{...init,headers,redirect:'error'})
  const text=await response.text()
  let payload:unknown=null
  try{payload=text?JSON.parse(text):null}catch{payload=null}
  if(!response.ok){
    const message=payload&&typeof payload==='object'&&!Array.isArray(payload)&&
      typeof (payload as {error?:unknown}).error==='string'
      ? String((payload as {error:string}).error).slice(0,300)
      : 'HTTP '+response.status
    throw new Error('Batch 8 worker API failed: '+message)
  }
  return payload as T
}

export async function b8Download(
  config:B8RemoteConfig,urlOrPath:string,target:string,
):Promise<{bytes:number;contentType:string}>{
  const url=new URL(urlOrPath,config.baseUrl)
  if(url.protocol!=='https:'&&!(sameOrigin(config,url)&&url.protocol==='http:'))
    throw new Error('Refusing insecure render download')
  const headers=new Headers()
  if(sameOrigin(config,url))
    for(const [key,value] of Object.entries(config.headers))headers.set(key,value)
  const response=await fetch(url,{headers,redirect:'follow'})
  if(!response.ok)throw new Error('Render download failed with HTTP '+response.status)
  const data=new Uint8Array(await response.arrayBuffer())
  if(!data.byteLength)throw new Error('Render download returned no bytes')
  mkdirSync(dirname(target),{recursive:true})
  const temp=target+'.tmp-'+process.pid
  try{writeFileSync(temp,data);renameSync(temp,target)}
  finally{rmSync(temp,{force:true})}
  return {bytes:data.byteLength,contentType:response.headers.get('content-type')??''}
}

export const b8Sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))

export async function b8Poll<T>(input:{
  read:()=>Promise<T>
  done:(value:T)=>boolean
  failed?:(value:T)=>string|null
  timeoutMs:number
  pollMs:number
  label:string
}):Promise<T>{
  const started=Date.now()
  for(;;){
    const value=await input.read()
    const failure=input.failed?.(value)
    if(failure)throw new Error(input.label+' failed: '+failure)
    if(input.done(value))return value
    if(Date.now()-started>=input.timeoutMs)throw new Error(input.label+' timed out')
    await b8Sleep(input.pollMs)
  }
}
