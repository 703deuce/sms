import type { AdProductInput, AdScript, AdMode } from './types'

/** B2 deterministic, claim-grounded planning agent. No provider call or credits spent. */
export function writeAdStoryline(input: AdProductInput, mode: AdMode): AdScript {
  console.info('[ad-studio:storyline] begin', { mode, claims: input.sellingPoints.length, durationSec: input.durationSec })
  const [first, second] = input.sellingPoints
  const name = input.name.trim()
  const hook = mode === 'image_to_ad' ? `Meet ${name}.` : `Introducing ${name}.`
  // Never invent a user problem, capability, results, or comparative claim.
  const problem = input.audience ? `Made for ${input.audience}.` : `See what makes ${name} worth a look.`
  const solution = first || `Discover ${name}.`
  const cta = `Explore ${name}.`
  const details = second ? ` ${second}.` : ''
  const voiceover = [hook, problem, `${solution.replace(/[.!?]+$/, '')}.${details}`, cta].join(' ')
  const script = { hook, problem, solution, cta, voiceover, onScreenText: [hook, solution, ...(second ? [second] : []), cta] }
  console.info('[ad-studio:storyline] complete', { mode, textCards: script.onScreenText.length })
  return script
}
