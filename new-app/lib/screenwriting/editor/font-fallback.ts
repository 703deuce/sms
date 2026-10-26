export const SCREENPLAY_FONT_STACK =
  '"Courier Prime", "Courier New", "Liberation Mono", "Nimbus Mono L", Courier, monospace'

export function fontCssWithFallback(): { fontFamily: string } {
  return { fontFamily: SCREENPLAY_FONT_STACK }
}
