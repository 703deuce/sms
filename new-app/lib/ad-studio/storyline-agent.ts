import type { AdProductInput, AdScript, AdMode } from './types'

/** B2 deterministic, claim-grounded planning agent. No provider call or credits spent. */
export type StorylineChoice = {
  leadClaimIndex?: number
  supportingClaimIndex?: number
  hookStyle?: 'meet' | 'introducing' | 'discover'
}

const words = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean)
const shortCard = (text: string, maxWords = 6): string => words(text).slice(0, maxWords).join(' ')

function narrationWordBudget(durationSec: 15 | 30): number {
  return Math.max(8, Math.round((durationSec - 0.7) * 2.6))
}

function fitNarrationToBudget(parts: string[], cta: string, targetWords: number, name: string): string {
  const ctaWords = words(cta)
  const maxBody = Math.max(0, targetWords - ctaWords.length)
  let bodyWords = words(parts.filter(Boolean).join(' '))

  if (bodyWords.length > maxBody) {
    bodyWords = bodyWords.slice(0, maxBody)
  }

  const fillers = [
    `Take a closer look at ${name}.`,
    `See ${name} for yourself.`,
    'See the details up close.',
    'Take another look.',
    'Look a little closer.',
    'See it in focus.',
    'Keep the details in mind.',
    'Take a closer look.',
    'Look again.',
    'Today.',
  ]
  let fillerIndex = 0
  while (bodyWords.length < maxBody) {
    const remaining = maxBody - bodyWords.length
    let added = false
    for (let offset = 0; offset < fillers.length; offset++) {
      const candidate = words(fillers[(fillerIndex + offset) % fillers.length]!)
      if (candidate.length <= remaining) {
        bodyWords.push(...candidate)
        fillerIndex = (fillerIndex + offset + 1) % fillers.length
        added = true
        break
      }
    }
    if (!added) break
  }

  return [...bodyWords, ...ctaWords].slice(0, targetWords).join(' ')
}

function onScreenCards(input: AdProductInput, name: string, first?: string, second?: string): string[] {
  const hook = shortCard(`${name} up close`)
  const problem = shortCard(second
    ? `Why it matters: ${second}`
    : input.audience
      ? `For ${input.audience}`
      : 'See the details')
  const solution = shortCard(first ? `Key benefit: ${first}` : `${name} in focus`)
  const cta = shortCard(`See ${name}`)
  return [hook, problem, solution, cta]
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
  const problem = input.audience ? `Made for ${input.audience}.` : `Take a closer look at ${name}.`
  const solution = first || `Discover ${name}.`
  const cta = `Explore ${name}.`
  const details = second ? ` ${second}.` : ''
  const core = [
    hook,
    problem,
    `${solution.replace(/[.!?]+$/, '')}.${details}`,
    ...(input.durationSec === 30 && first ? [`One thing to remember: ${first.replace(/[.!?]+$/, '')}.`] : []),
    ...(input.durationSec === 30 && second ? [`Also worth knowing: ${second.replace(/[.!?]+$/, '')}.`] : []),
  ]
  const targetWords = narrationWordBudget(input.durationSec)
  const voiceover = fitNarrationToBudget(core, cta, targetWords, name)
  const screen = onScreenCards(input, name, first, second)
  const script = { hook, problem, solution, cta, voiceover, onScreenText: screen }
  console.info('[ad-studio:storyline] complete', {
    mode,
    targetWords,
    voiceWords: words(voiceover).length,
    textCards: screen.length,
    maxCardWords: Math.max(...screen.map(card => words(card).length)),
  })
  return script
}
