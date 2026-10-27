/** Scroll active word toward the middle third of the transcript pane (§B2.3). */
export function scrollWordToFollowPlayhead(container: HTMLElement | null, wordEl: Element | null) {
  if (!container || !wordEl || !(wordEl instanceof HTMLElement)) return
  const cr = container.getBoundingClientRect()
  const er = wordEl.getBoundingClientRect()
  const targetY = cr.top + cr.height * 0.38
  const wordCenter = er.top + er.height / 2
  container.scrollTop += wordCenter - targetY
}
