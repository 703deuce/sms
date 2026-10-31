/**
 * G3b: client registry of the workspace's uploaded fonts. Loading registers each font three ways so
 * the preview matches the export: caption-fit metrics (wrap / size, == worker register_font_metrics),
 * the JASSUB font URL (preview-scripts fontUrlsForAss) and a CSS FontFace (DOM fallback / pickers).
 * `version` bumps on every change so the libass scripts rebuild with the new metrics.
 */
import { registerFontMetrics } from '@/lib/clips/caption-fit'
import { fontFileUrl, type WorkspaceFont } from '@/lib/clips/fonts-shared'
import { registerUserFontUrl } from '@/lib/clips/render-plan/preview-scripts'
import { userFontId } from '@/lib/clips/render-plan/text-rich'

type State = { fonts: WorkspaceFont[]; version: number; loaded: boolean; error: string | null }
let state: State = { fonts: [], version: 0, loaded: false, error: null }
const listeners = new Set<() => void>()
const faces = new Set<string>()
let inflight: Promise<void> | null = null

function emit(p: Partial<State>) {
  state = { ...state, ...p, version: state.version + 1 }
  listeners.forEach((l) => l())
}

export function subscribeWorkspaceFonts(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const workspaceFontsState = (): State => state

function addFace(family: string, url: string) {
  if (faces.has(family) || typeof document === 'undefined' || typeof FontFace === 'undefined') return
  faces.add(family)
  try {
    const face = new FontFace(family, `url(${url})`)
    document.fonts.add(face)
    void face.load().catch(() => {})
  } catch {
    /* DOM fallback only */
  }
}

function register(f: WorkspaceFont) {
  registerFontMetrics(f.family, f.metrics)
  registerUserFontUrl(f.family, fontFileUrl(f.id))
  addFace(f.family, fontFileUrl(f.id))
}

export function setWorkspaceFonts(fonts: WorkspaceFont[]) {
  fonts.forEach(register)
  emit({ fonts, loaded: true, error: null })
}

/** Items that use a font no longer in the list (soft-deleted) still preview from its file URL. */
export function registerFontsFromItems(items: { style?: { font?: string; fontFamily?: string } }[] | undefined): void {
  for (const it of items ?? []) {
    const id = userFontId(it.style?.font)
    const fam = it.style?.fontFamily
    if (id && fam) {
      registerUserFontUrl(fam, fontFileUrl(id))
      addFace(fam, fontFileUrl(id))
    }
  }
}

export function loadWorkspaceFonts(force = false): Promise<void> {
  if (typeof fetch === 'undefined') return Promise.resolve()
  if (inflight && !force) return inflight
  if (state.loaded && !force) return Promise.resolve()
  inflight = fetch('/api/clips/fonts')
    .then(async (r) => {
      const j = (await r.json().catch(() => null)) as { data?: { fonts?: WorkspaceFont[] }; error?: string } | null
      if (!r.ok || !j?.data?.fonts) throw new Error(j?.error ?? `HTTP ${r.status}`)
      setWorkspaceFonts(j.data.fonts)
    })
    .catch((e: unknown) => emit({ loaded: true, error: e instanceof Error ? e.message : String(e) }))
    .finally(() => {
      inflight = null
    })
  return inflight
}

export async function uploadWorkspaceFont(file: File): Promise<{ font?: WorkspaceFont; existing?: boolean; error?: string }> {
  const fd = new FormData()
  fd.set('file', file)
  const r = await fetch('/api/clips/fonts', { method: 'POST', body: fd })
  const j = (await r.json().catch(() => null)) as { data?: { font: WorkspaceFont; existing: boolean }; error?: string } | null
  if (!r.ok || !j?.data) return { error: j?.error ?? `Upload failed (HTTP ${r.status})` }
  const { font, existing } = j.data
  if (!state.fonts.some((f) => f.id === font.id)) setWorkspaceFonts([...state.fonts, font])
  return { font, existing }
}

export async function deleteWorkspaceFont(id: string): Promise<boolean> {
  const r = await fetch(`/api/clips/fonts/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!r.ok) return false
  emit({ fonts: state.fonts.filter((f) => f.id !== id) })
  return true
}

/** Test hook. */
export function __resetWorkspaceFonts() {
  state = { fonts: [], version: 0, loaded: false, error: null }
  inflight = null
}
