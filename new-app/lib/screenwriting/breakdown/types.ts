export const BREAKDOWN_CATEGORIES = [
  'cast',
  'props',
  'wardrobe',
  'vehicles',
  'locations',
  'sfx',
  'music',
] as const

export type BreakdownCategory = (typeof BREAKDOWN_CATEGORIES)[number]

export type BreakdownTag = {
  id: string
  elementId: string
  from: number
  to: number
  category: BreakdownCategory
  label: string
}
