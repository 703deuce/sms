export interface StoryTimePoint {
  sceneId: string
  label: string
  storyTime?: string
  order: number
}

export function storyTimeAxis(scenes: { id: string; heading: string; synopsis?: string }[]): StoryTimePoint[] {
  return scenes.map((s, order) => ({
    sceneId: s.id,
    label: s.heading,
    storyTime: inferStoryTime(s.heading, s.synopsis),
    order,
  }))
}

function inferStoryTime(heading: string, synopsis?: string): string | undefined {
  const hay = `${heading} ${synopsis ?? ''}`
  if (/FLASHBACK/i.test(hay)) return 'flashback'
  if (/LATER/i.test(hay)) return 'later'
  if (/CONTINUOUS/i.test(hay)) return 'continuous'
  return undefined
}
