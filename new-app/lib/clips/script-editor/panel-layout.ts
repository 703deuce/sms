const STORAGE_KEY = 'transovo.scriptEditor.layout.v1'

export type ScriptEditorLayout = {
  scriptWidthPct: number
  timelineExpanded: boolean
  timelineHeightPx: number
}

const DEFAULT: ScriptEditorLayout = { scriptWidthPct: 46, timelineExpanded: true, timelineHeightPx: 340 }

export function loadScriptEditorLayout(): ScriptEditorLayout {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as Partial<ScriptEditorLayout>
    const pct = parsed.scriptWidthPct
    const timelineExpanded = parsed.timelineExpanded !== false
    const timelineHeightPx =
      typeof parsed.timelineHeightPx === 'number'
        ? Math.min(480, Math.max(160, parsed.timelineHeightPx))
        : DEFAULT.timelineHeightPx
    if (typeof pct !== 'number' || pct < 28 || pct > 72) {
      return { ...DEFAULT, timelineExpanded, timelineHeightPx }
    }
    return { scriptWidthPct: pct, timelineExpanded, timelineHeightPx }
  } catch {
    return DEFAULT
  }
}

export function saveScriptEditorLayout(layout: ScriptEditorLayout): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    /* ignore quota */
  }
}
