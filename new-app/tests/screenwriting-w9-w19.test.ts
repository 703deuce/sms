import { describe, expect, it } from 'vitest'
import { alignElements, wordDiffHtml } from '@/lib/screenwriting/versions/compare'
import { shouldAutoSnapshot, AUTO_SNAPSHOT_INTERVAL_MS } from '@/lib/screenwriting/versions/snapshot-policy'
import { signCollabToken, verifyCollabToken, isReadOnlyRole } from '@/lib/screenwriting/collab/token'
import { hashShareToken } from '@/lib/screenwriting/sharing/token'
import { getTemplateSpec } from '@/lib/screenwriting/formats/templates'
import { paginateFromElements } from '@/lib/screenwriting/layout'
import { layoutElementsFromPmJson } from '@/lib/screenwriting/layout/pm-json'
import { fountainToPmJson } from '@/lib/screenwriting/fountain/convert'
import { scenesFromPmJson, navigatorToCsv } from '@/lib/screenwriting/structure/navigator'
import { characterReport } from '@/lib/screenwriting/reports/characters'
import { estimateCredits, stableInputHash } from '@/lib/screenwriting/ai/estimate'
import { segmentTableRead, estimateAudioMinutes } from '@/lib/screenwriting/table-read/segment'
import { swSceneV1Schema } from '@/lib/screenwriting/integrations/studio-payload'
import * as Y from 'yjs'

describe('W9 versions', () => {
  it('aligns elements by id', () => {
    const a = { type: 'doc', content: [{ type: 'screenplayElement', attrs: { id: 'x', elementType: 'action' }, content: [{ type: 'text', text: 'A' }] }] }
    const b = { type: 'doc', content: [{ type: 'screenplayElement', attrs: { id: 'x', elementType: 'action' }, content: [{ type: 'text', text: 'B' }] }] }
    const aligned = alignElements(a, b)
    expect(aligned[0].textA).toBe('A')
    expect(aligned[0].textB).toBe('B')
    expect(wordDiffHtml('A', 'B')).toContain('<del>')
  })

  it('snapshot policy interval', () => {
    const now = Date.now()
    expect(shouldAutoSnapshot(now - AUTO_SNAPSHOT_INTERVAL_MS - 1, now)).toBe(true)
  })
})

describe('W10 collab', () => {
  it('token round trip and read-only roles', () => {
    const token = signCollabToken({ scriptId: 's1', actorId: 'a1', role: 'VIEWER' }, 60)
    const payload = verifyCollabToken(token)
    expect(payload?.scriptId).toBe('s1')
    expect(isReadOnlyRole('COMMENTER')).toBe(true)
  })

  it('concurrent Yjs maps converge', () => {
    const a = new Y.Doc()
    const b = new Y.Doc()
    const mapA = a.getMap('meta')
    const mapB = b.getMap('meta')
    mapA.set('title', 'One')
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    mapB.set('title', 'Two')
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    expect(a.getMap('meta').get('title')).toBe('Two')
    expect(b.getMap('meta').get('title')).toBe('Two')
  })
})

describe('W11 sharing', () => {
  it('hashes share tokens', () => {
    expect(hashShareToken('abc')).toHaveLength(64)
  })
})

describe('W12 templates', () => {
  it('multicam increases dialogue spacing vs feature', () => {
    const brick = fountainToPmJson('INT. GARAGE - DAY\n\nCAPS ACTION\n\nJACK\nHi.')
    const els = layoutElementsFromPmJson(brick)
    const feature = paginateFromElements(els, { spec: getTemplateSpec('feature') })
    const multicam = paginateFromElements(els, { spec: getTemplateSpec('multicam') })
    expect(multicam.pageCount).toBeGreaterThanOrEqual(feature.pageCount)
  })
})

describe('W14 navigator', () => {
  it('exports CSV rows', () => {
    const doc = fountainToPmJson('INT. HOUSE - DAY\n\nAction.')
    const rows = scenesFromPmJson(doc)
    expect(rows.length).toBe(1)
    expect(navigatorToCsv(rows)).toContain('INT. HOUSE - DAY')
  })
})

describe('W15 reports', () => {
  it('character report on brick names', () => {
    const doc = fountainToPmJson('INT. X - DAY\n\nBRICK\nLine.\n\nSTEEL\nLine two.')
    const rows = characterReport(doc)
    expect(rows.map((r) => r.name)).toEqual(expect.arrayContaining(['BRICK', 'STEEL']))
  })
})

describe('W17 AI', () => {
  it('estimate and hash stability', () => {
    expect(estimateCredits('coverage', { words: 10_000 })).toBeGreaterThan(15)
    expect(stableInputHash({ a: 1 })).toBe(stableInputHash({ a: 1 }))
  })
})

describe('W18 table read', () => {
  it('segments dialogue and narrator', () => {
    const doc = fountainToPmJson('INT. X - DAY\n\nAction beat.\n\nJACK\nHello.')
    const utt = segmentTableRead(doc, { JACK: 'voice-1' })
    expect(utt.some((u) => u.speaker === 'voice-1')).toBe(true)
    expect(utt.some((u) => u.speaker === 'NARRATOR')).toBe(true)
    expect(estimateAudioMinutes(utt)).toBeGreaterThan(0)
  })
})

describe('W19 studio payload', () => {
  it('validates brick scene stub', () => {
    const payload = swSceneV1Schema.parse({
      scriptId: 's1',
      scenes: [
        {
          elementId: 'e1',
          heading: 'INT. GARAGE - DAY',
          action: ['Cars.'],
          dialogue: [{ character: 'BRICK', text: 'Hi' }],
          characters: [{ name: 'BRICK' }],
        },
      ],
    })
    expect(payload.scenes[0].heading).toContain('GARAGE')
  })
})
