#!/usr/bin/env node
import { existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs'
import { dirname,resolve } from 'node:path'
import {
  BATCH9_PHASE_A_ANCHORS,batch9PhaseAAnchorGate,batch9PhaseBExpansionCandidates,
  batch9PhaseBStatus,eligibleBatch9PhaseBVariants,
} from '../lib/clips/real-video-templates/batch9-phase-b'
import type { B8Evidence } from '../lib/clips/real-video-templates/b8-factory'

const args=process.argv.slice(2)
const evidenceArg=args.includes('--evidence')?args[args.indexOf('--evidence')+1]:undefined
const evidencePath=resolve(process.cwd(),evidenceArg??'build/real-video-templates/b8/evidence.json')
const outArg=args.includes('--out')?args[args.indexOf('--out')+1]:undefined
const out=resolve(process.cwd(),outArg??'build/real-video-templates/b9-phase-b/status.json')
const evidence: B8Evidence[]=existsSync(evidencePath)
  ? JSON.parse(readFileSync(evidencePath,'utf8')):[]

const status=batch9PhaseBStatus(evidence)
const phaseA=batch9PhaseAAnchorGate(evidence)
const eligible=eligibleBatch9PhaseBVariants(evidence)
mkdirSync(dirname(out),{recursive:true})
writeFileSync(out,JSON.stringify({
  v:1,phase:'Batch 9 Phase B',anchors:BATCH9_PHASE_A_ANCHORS,
  phaseAGate:phaseA,target:batch9PhaseBExpansionCandidates().length,
  reviewed:status.reviewed,eligible:eligible.length,
  eligibleIds:eligible.map(row=>row.id),blockers:status.blockers,
  note:'No variant is public/released by this command. Phase A anchors and each exact variant require real evidence.',
},null,2)+'\n')
console.log('Batch 9 Phase B: Phase A ready='+phaseA.ready+
  ', reviewed='+status.reviewed+'/390, eligible='+eligible.length+'/390')
if(!phaseA.ready)process.exitCode=2
