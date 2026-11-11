import { describe,expect,it } from 'vitest'
import { FACTORY_TREATMENTS } from '@/lib/clips/real-video-templates/b8-authoring-catalog'
import { BATCH9_PHASE_B_CERTIFIED_RELEASES } from '@/lib/clips/real-video-templates/batch9-phase-b-certified'
import { FIRST_PARTY_VIDEO_TEMPLATES } from '@/lib/clips/real-video-templates/releases'
import {
  BATCH9_PHASE_A_ANCHORS,BATCH9_PHASE_B_VARIANT_TARGET,
  batch9PhaseAAnchorGate,batch9PhaseBExpansionCandidates,batch9PhaseBReleaseGate,
  batch9PhaseBReviewedReleases,batch9PhaseBStatus,eligibleBatch9PhaseBVariants,
} from '@/lib/clips/real-video-templates/batch9-phase-b'

describe('Batch 9 Phase B style-pack expansion gate',()=>{
  it('keeps the production Phase B promotion boundary empty until certification',()=>{
    expect(BATCH9_PHASE_B_CERTIFIED_RELEASES).toEqual([])
    expect(FIRST_PARTY_VIDEO_TEMPLATES).toHaveLength(10)
    expect(FIRST_PARTY_VIDEO_TEMPLATES.every(row=>row.certificationStatus==='preview')).toBe(true)
  })
  it('defines ten existing bold anchors and exactly 390 non-anchor variants',()=>{
    expect(BATCH9_PHASE_A_ANCHORS).toEqual(
      Array.from({length:10},(_,i)=>'f'+String(i+1).padStart(2,'0')+'_bold'))
    expect(FACTORY_TREATMENTS).toHaveLength(40)
    const rows=batch9PhaseBExpansionCandidates()
    expect(rows).toHaveLength(BATCH9_PHASE_B_VARIANT_TARGET)
    expect(rows.every(row=>Number(row.familyId.slice(1))<=10&&row.treatmentId!=='bold')).toBe(true)
    expect(new Set(rows.map(row=>row.id)).size).toBe(390)
  })
  it('fails closed before all ten anchors carry real reviewed evidence',()=>{
    expect(batch9PhaseAAnchorGate([]).ready).toBe(false)
    const status=batch9PhaseBStatus([])
    expect(status.phaseAReady).toBe(false)
    expect(status.eligible).toBe(0)
    expect(eligibleBatch9PhaseBVariants([])).toEqual([])
    expect(batch9PhaseBReleaseGate([]).ready).toBe(false)
    expect(batch9PhaseBReviewedReleases([])).toEqual([])
    expect(Object.keys(status.blockers)).toHaveLength(390)
    expect(status.blockers['f01_editorial']).toContain('first_ten_anchor_gate')
  })
})
