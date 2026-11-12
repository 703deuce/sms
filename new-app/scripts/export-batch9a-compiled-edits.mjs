#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BATCH9A_ANCHOR_RELEASES } from '../lib/clips/real-video-templates/batch9a-anchors.ts'
import { compileTemplateWithMusic } from '../lib/clips/real-video-templates/music-sequence.ts'
import { defaultEdits } from '../lib/clips/edits.ts'
import { templateFrameToMs } from '../lib/clips/real-video-templates/sequence-contract.ts'

const OUT = '/opt/cursor/artifacts/compiled-edits'
mkdirSync(OUT, { recursive: true })

for (const id of ['f01_bold', 'f03_bold', 'f09_bold']) {
  const release = BATCH9A_ANCHOR_RELEASES.find((r) => r.id === id)
  if (!release) throw new Error('missing ' + id)
  const media = Object.fromEntries(
    release.family.slots.map((slot, i) => [
      slot.id,
      { id: 'img_' + i, kind: 'image', license: { id: 'owned', provenance: 'user-owned', reference: 'artifact' } },
    ]),
  )
  const durationMs = templateFrameToMs(release.family.totalFrames)
  const compiled = compileTemplateWithMusic(
    release.family,
    release.design,
    { instanceId: 'artifact_' + id, media },
    {
      durationFrames: release.family.totalFrames,
      edits: defaultEdits({ clipStartMs: 0, clipEndMs: durationMs }),
    },
  )
  writeFileSync(join(OUT, id + '.json'), JSON.stringify(compiled.edits))
  console.log('wrote', id)
}
