export type EditorViewMode = 'page' | 'draft' | 'focus' | 'typewriter'

export function viewModeClass(mode: EditorViewMode): string {
  switch (mode) {
    case 'page':
      return 'sw-view-page'
    case 'draft':
      return 'sw-view-draft'
    case 'focus':
      return 'sw-view-focus'
    case 'typewriter':
      return 'sw-view-typewriter'
    default:
      return 'sw-view-draft'
  }
}
