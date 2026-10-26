/** Marks editor root when Yjs should own undo (PM History disabled). */
export function attachYjsUndoHook(root: HTMLElement, collabActive: boolean): void {
  if (collabActive) {
    root.setAttribute('data-yjs-undo', '1')
    root.setAttribute('title', 'Collaborative undo (Yjs)')
  } else {
    root.removeAttribute('data-yjs-undo')
    root.removeAttribute('title')
  }
}

export function yjsUndoActiveFromDom(root: HTMLElement | null): boolean {
  return root?.getAttribute('data-yjs-undo') === '1'
}
