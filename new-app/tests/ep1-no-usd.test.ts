import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatToolCost, PRODUCER_PAID_TOOLS, producerToolCost } from '@/lib/clips/producer-cost'
import { creditsLabel, dubCredits } from '@/lib/clips/credit-cost'

// EP1g (John's rule): never show our internal $ / API cost to users — credits only.
const USER_FACING = [
  'components/clips/editor/ai-broll-card.tsx',
  'components/clips/editor/broll-panel.tsx',
  'components/clips/editor/audio-panel.tsx',
  'components/clips/editor/dub-panel.tsx',
  'components/clips/editor/producer-popover.tsx',
  'components/clips/producer/producer-panel.tsx',
  'components/clips/new-project-workspace.tsx',
  'components/t2v/t2v-panel-music.tsx',
  'lib/clips/producer-cost.ts',
]
const API = [
  'app/api/clips/estimate/route.ts',
  'app/api/clips/clips/[id]/thumbnail/route.ts',
  'app/api/clips/clips/[id]/broll/ai/route.ts',
  'app/api/clips/clips/[id]/producer/confirm/route.ts',
  'app/api/clips/clips/[id]/dub/route.ts',
  'app/api/clips/clips/[id]/music/route.ts',
  'app/api/clips/clips/[id]/sfx/route.ts',
  'app/api/clips/compositions/[compositionId]/music/route.ts',
  'app/api/clips/compositions/[compositionId]/sfx/route.ts',
  'app/api/clips/generations/[id]/route.ts',
]
const root = join(__dirname, '..')

describe('EP1g no user-visible $ cost', () => {
  it('producer cost cards show credits only', () => {
    for (const name of PRODUCER_PAID_TOOLS) {
      const line = formatToolCost(producerToolCost({ name, args: {} }, 45_000))
      expect(line).toMatch(/^\d+ credits?$/)
      expect(line).not.toContain('$')
    }
    expect(creditsLabel(1)).toBe('1 credit')
    expect(dubCredits(90_000)).toBe(12)
  })
  it('UI files render no dollar amounts', () => {
    for (const f of USER_FACING) {
      const src = readFileSync(join(root, f), 'utf8')
      expect(src, f).not.toMatch(/\$\$\{|~\$|About \$\{|about \$\{|\$\{[^}]*(cost|Cost|usd|Usd)[^}]*\.toFixed/)
    }
  })
  it('API responses to the browser carry no provider $ estimate', () => {
    for (const f of API) {
      const src = readFileSync(join(root, f), 'utf8')
      expect(src, f).not.toMatch(/estimatedCostUsd|providerCostUsd/)
      // the only costUsd left is the internal AiGeneration write (new Decimal(...))
      for (const m of src.matchAll(/costUsd:\s*([^,\n]+)/g)) expect(m[1], f).toMatch(/^new Decimal\(/)
    }
  })
})
