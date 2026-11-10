import type { AdProductInput, AdScript, AdMode } from './types'

/** B2 deterministic, claim-grounded planning agent. No provider call or credits spent. */
export type StorylineChoice = {
  leadClaimIndex?: number
  supportingClaimIndex?: number
  hookStyle?: 'meet' | 'introducing' | 'discover'
}
export function writeAdStoryline(input: AdProductInput, mode: AdMode, choice: StorylineChoice = {}): AdScript {
  console.info('[ad-studio:storyline] begin', { mode, claims: input.sellingPoints.length, durationSec: input.durationSec })
  const leadIndex = Number.isInteger(choice.leadClaimIndex) && choice.leadClaimIndex! >= 0 && choice.leadClaimIndex! < input.sellingPoints.length ? choice.leadClaimIndex! : 0
  const supportingIndex = Number.isInteger(choice.supportingClaimIndex) && choice.supportingClaimIndex! >= 0 && choice.supportingClaimIndex! < input.sellingPoints.length && choice.supportingClaimIndex !== leadIndex ? choice.supportingClaimIndex! : input.sellingPoints.findIndex((_, i) => i !== leadIndex)
  const first = input.sellingPoints[leadIndex]
  const second = supportingIndex >= 0 ? input.sellingPoints[supportingIndex] : undefined
  const name = input.name.trim()
  const hookVerb = choice.hookStyle === 'discover' ? 'Discover' : choice.hookStyle === 'meet' || (mode === 'image_to_ad' || mode === 'image_ad_to_commercial') ? 'Meet' : 'Introducing'
  const hook = `${hookVerb} ${name}.`
  // Never invent a user problem, capability, results, or comparative claim.
  const problem = input.audience ? `Made for ${input.audience}.` : `See what makes ${name} worth a look.`
  const solution = first || `Discover ${name}.`
  const cta = `Explore ${name}.`
  const details = second ? ` ${second}.` : ''
  const core = [hook, problem, `${solution.replace(/[.!?]+$/, '')}.${details}`]
  const voiceParts = input.durationSec === 30
    ? [
        ...core,
        first ? `One thing to remember: ${first.replace(/[.!?]+$/, '')}.` : '',
        second ? `Also worth knowing: ${second.replace(/[.!?]+$/, '')}.` : '',
        cta,
      ].filter(Boolean)
    : [...core, cta]
  const targetWords = input.durationSec === 30 ? 42 : 20
  const neutralFillers = [
    `Take a closer look at ${name}.`,
    `See ${name} for yourself.`,
    `Explore ${name} today.`,
    `Learn more about ${name}.`,
    `See the product up close.`,
    `Take another look at ${name}.`,
    `Keep ${name} in view.`,
  ]
  const countWords = () => voiceParts.join(' ').trim().split(/\s+/).filter(Boolean).length
  for (const filler of neutralFillers) {
    if (countWords() >= targetWords) break
    voiceParts.splice(Math.max(0, voiceParts.length - 1), 0, filler)
  }
  const voiceover = voiceParts.join(' ')
  const script = { hook, problem, solution, cta, voiceover, onScreenText: [hook, solution, ...(second ? [second] : []), cta] }
  console.info('[ad-studio:storyline] complete', {
    mode, textCards: script.onScreenText.length, voiceWords: voiceover.trim().split(/\s+/).filter(Boolean).length,
  })
  return script
}
