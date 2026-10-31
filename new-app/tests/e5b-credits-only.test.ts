import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// John's rule (EP1g): users only ever see credits. E5 / E5b / FV user-facing files and the routes
// that answer the browser must not render or return a $ / provider-cost figure.
const root = join(__dirname, '..')
const UI = [
  'components/clips/editor/media-panel.tsx',
  'components/clips/editor/media-transcribe-control.tsx',
  'components/clips/editor/media-inserts-section.tsx',
  'components/clips/editor/find-clips-in-video-button.tsx',
  'components/clips/editor/use-project-media.ts',
  'lib/clips/editor/media-words.ts',
]
const API = [
  'app/api/clips/projects/[id]/media-transcripts/route.ts',
  'app/api/clips/projects/[id]/library/route.ts',
  'app/api/clips/projects/[id]/find-clips/route.ts',
]

describe('E5b / FV credits only', () => {
  it('UI renders no dollar amounts', () => {
    for (const f of UI) {
      const src = readFileSync(join(root, f), 'utf8')
      expect(src, f).not.toMatch(/\$\$\{|~\$|\$\d|[Uu]sd/)
    }
  })
  it('browser-facing routes carry no $ figures', () => {
    for (const f of API) {
      const src = readFileSync(join(root, f), 'utf8')
      expect(src, f).not.toMatch(/[Uu]sd|providerCost/)
    }
  })
  it('the transcript serializer never returns the internal $ columns', () => {
    const src = readFileSync(join(root, 'lib/server/clips/media-transcripts.ts'), 'utf8')
    const body = src.slice(src.indexOf('function toTranscript'), src.indexOf('const SELECT'))
    expect(body.split('return {')[1]).not.toMatch(/[Uu]sd/)
  })
})
