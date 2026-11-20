// @vitest-environment happy-dom
import {afterEach,describe,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {CreatorVoicePicker} from '../../components/motion-studio/creator-voice-picker'
import {createMockMotionStudioClient} from '../../lib/motion-studio/mock-client'

afterEach(()=>{cleanup();vi.restoreAllMocks()})

describe('Motion Studio cloned narrator recording',()=>{
 it('does not enable Create before a recorded File is finalized',async()=>{
  let finish:()=>void=()=>{}
  const stream={getTracks:()=>[{stop:vi.fn()}]} as unknown as MediaStream
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue(stream)}})
  class Recorder {
   static isTypeSupported(){return true}
   mimeType='audio/webm'
   state:'inactive'|'recording'='inactive'
   ondataavailable:((e:{data:Blob})=>void)|null=null
   onstop:(()=>void)|null=null
   constructor(_stream:MediaStream,_options?:unknown){}
   start(){this.state='recording'}
   requestData(){}
   stop(){this.state='inactive';finish=()=>{this.ondataavailable?.({data:new Blob(['audio'],{type:'audio/webm'})});this.onstop?.()}}
  }
  vi.stubGlobal('MediaRecorder',Recorder)
  vi.stubGlobal('URL',{...URL,createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}})
  const client=createMockMotionStudioClient({storage:null,seedExample:false})
  render(<CreatorVoicePicker client={client} value={null} onChange={()=>{}} onError={()=>{}}/>)
  fireEvent.click(screen.getByText('Create a voice'))
  fireEvent.change(screen.getByPlaceholderText('e.g. My documentary voice'),{target:{value:'My voice'}})
  fireEvent.click(screen.getByText('Start recording'))
  await waitFor(()=>expect(screen.getByText('Stop recording')).toBeTruthy())
  fireEvent.click(screen.getByText('Stop recording'))
  expect((screen.getByRole('button',{name:'Create voice'}) as HTMLButtonElement).disabled).toBe(true)
  finish()
  await waitFor(()=>expect((screen.getByRole('button',{name:'Create voice'}) as HTMLButtonElement).disabled).toBe(false))
  vi.unstubAllGlobals()
 })
 it('keeps upload errors visible inside the clone dialog',async()=>{
  const client=createMockMotionStudioClient({storage:null,seedExample:false})
  vi.spyOn(client,'uploadFile').mockRejectedValue(new Error('Upload did not complete'))
  vi.stubGlobal('URL',{...URL,createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}})
  render(<CreatorVoicePicker client={client} value={null} onChange={()=>{}} onError={()=>{}}/>)
  fireEvent.click(screen.getByText('Create a voice'))
  fireEvent.change(screen.getByPlaceholderText('e.g. My documentary voice'),{target:{value:'Test narrator'}})
  fireEvent.click(screen.getByText('Upload a sample'))
  fireEvent.change(screen.getByRole('dialog').querySelector('input[type="file"]') as HTMLInputElement,{target:{files:[new File(['sample'],'sample.mp3',{type:'audio/mpeg'})]}})
  fireEvent.click(screen.getByRole('button',{name:'Create voice'}))
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Upload did not complete'))
  expect(screen.getByRole('dialog')).toBeTruthy()
  vi.unstubAllGlobals()
 })
})
