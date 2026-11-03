import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(process.cwd(), 'lib/ai-producer-agent/rulepacks')

function readPack(name: string): string {
  try {
    return readFileSync(path.join(ROOT, name), 'utf8')
  } catch {
    return ''
  }
}

export type RulepackContext = {
  genre: string
  outputType: 'single_payoff' | 'montage'
  platform: string
}

export function loadRulepackSections(ctx: RulepackContext): { system: string; template: string } {
  const core = readPack('core.md') || readPack('core-source.md')
  const genre = ctx.genre === 'irl_just_chatting' ? readPack('irl_just_chatting.md') : ''
  const template =
    ctx.outputType === 'montage'
      ? 'Montage: rhythm-first; best moments; payoff in last 25%.'
      : 'Single payoff: hook 0-2s; setup; build; payoff + tail hold.'
  const platform = `Platform target: ${ctx.platform}.`
  const system = [core, genre, template, platform].filter(Boolean).join('\n\n---\n\n')
  return { system, template }
}

export function assertGenreSupported(genre: string) {
  if (genre !== 'irl_just_chatting') throw new Error('genre_not_supported')
}
