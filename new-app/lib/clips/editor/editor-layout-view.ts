export type ClipEditorLayoutView = 'timeline' | 'script'

const LS_KEY = 'transovo.editor.layoutView'

export function readClipEditorLayoutView(): ClipEditorLayoutView {
  if (typeof window === 'undefined') return 'timeline'
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v === 'script' || v === 'timeline') return v
  } catch {
    /* private mode */
  }
  return 'timeline'
}

export function writeClipEditorLayoutView(view: ClipEditorLayoutView) {
  try {
    localStorage.setItem(LS_KEY, view)
  } catch {
    /* private mode */
  }
}
