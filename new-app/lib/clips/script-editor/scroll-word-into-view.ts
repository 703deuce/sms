/** Scroll a word element into view inside a scrollable transcript pane (not the window). */
export function scrollWordIntoTranscriptPane(container: HTMLElement | null, wordEl: Element | null) {
  if (!container || !wordEl || !(wordEl instanceof HTMLElement)) return
  const cr = container.getBoundingClientRect()
  const er = wordEl.getBoundingClientRect()
  if (er.top < cr.top + 8) {
    container.scrollTop += er.top - cr.top - 8
  } else if (er.bottom > cr.bottom - 8) {
    container.scrollTop += er.bottom - cr.bottom + 8
  }
}
