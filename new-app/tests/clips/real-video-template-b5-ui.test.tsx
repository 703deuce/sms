// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { TemplateMusicChoicePanel } from '@/components/clips/templates/template-music-choice-panel'
import { pinMusicSchedule, type AudioLicenseRecord } from '@/lib/clips/real-video-templates/music-timing'
import type { TemplateFamilyV1 } from '@/lib/clips/real-video-templates/sequence-contract'

const rights:AudioLicenseRecord={assetId:'audio_1',origin:'upload',author:'Creator',
  license:'user-owned',revision:'ack:2026-11-11',sha256:'a'.repeat(64),
  commercialUse:true,exportAllowed:true,redistributionAllowed:false,
  verifiedDurationFrames:3600,verifiedAt:'2026-11-11'}
const schedule=(bpm:number)=>pinMusicSchedule({assetId:'audio_1',license:rights,mode:'beat-time',
  grid:{bpm,beatsMs:Array.from({length:100},(_,i)=>i*60000/bpm)}})
const family:TemplateFamilyV1={
  schemaVersion:1,familyId:'ui_b5',revision:1,title:'Music test',tags:[],aspects:['9:16'],
  fps:30,totalFrames:60,beatAnchors:[0,30],texts:[],
  slots:[{id:'first',ordinal:1,role:'hero',media:'image',startFrame:0,durationFrames:30,
    fit:'cover',sourceAudio:'mute',transition:'cut'},
    {id:'second',ordinal:2,role:'closing',media:'image',startFrame:30,durationFrames:30,
      fit:'cover',sourceAudio:'mute',transition:'cut'}],
}

describe('template-owned music choices UI',()=>{
  it('defaults to keep timing, previews re-sync duration before single accept, and can cancel',()=>{
    const accept=vi.fn(), cancel=vi.fn()
    const ui=render(<TemplateMusicChoicePanel family={family} musicUploadId="audio_1"
      saved={{v:1,rights,schedule:schedule(90)}}
      originalSchedule={schedule(120)} onAccept={accept} onCancel={cancel} />)
    expect(ui.getByText('Original duration: 2.00 s')).toBeTruthy()
    expect(ui.getByText('Proposed duration: 2.00 s')).toBeTruthy()
    expect(accept).not.toHaveBeenCalled()
    fireEvent.click(ui.getByText(/Re-sync to this music/))
    expect(ui.getByText('Proposed duration: 2.67 s')).toBeTruthy()
    fireEvent.click(ui.getByText('Accept music timing'))
    expect(accept).toHaveBeenCalledTimes(1)
    expect(accept.mock.calls[0]?.[0]).toMatchObject({choice:'re-sync',acceptLoop:false})
    fireEvent.click(ui.getByText('Cancel'))
    expect(cancel).toHaveBeenCalledTimes(1)
  })
  it('requires a real upload, rights acknowledgment and verification for unsaved audio',()=>{
    const accept=vi.fn()
    const ui=render(<TemplateMusicChoicePanel family={family} musicUploadId="audio_1"
      onAccept={accept} onCancel={()=>{}} />)
    expect((ui.getByText('Accept music timing') as HTMLButtonElement).disabled).toBe(true)
    expect((ui.getByText('Verify and pin music beats') as HTMLButtonElement).disabled).toBe(true)
  })
})
