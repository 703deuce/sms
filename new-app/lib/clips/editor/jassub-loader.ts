/**
 * EP2: loads the vendored JASSUB 2.5.23 (public/jassub/2.5.23, unmodified WASM — see NOTICES.txt)
 * with a module <script>, so the bundler never sees it and it only loads inside the editor.
 */
export const JASSUB_VERSION = '2.5.23'
export const JASSUB_BASE = `/jassub/${JASSUB_VERSION}/`
const GLOBAL = '__TransovoJASSUB_2_5_23'

export type JassubRenderer = {
  setTrack: (content: string) => Promise<void>
  addFonts: (urls: string[]) => Promise<unknown>
}
export type JassubInstance = {
  ready: Promise<void>
  renderer: JassubRenderer
  manualRender: (
    data: { mediaTime: number; width: number; height: number; expectedDisplayTime: number },
    repaint?: boolean,
  ) => Promise<void>
  destroy: () => Promise<void>
}
export type JassubCtor = new (opts: Record<string, unknown>) => JassubInstance

let pending: Promise<JassubCtor> | null = null

export function loadJassub(): Promise<JassubCtor> {
  const g = globalThis as unknown as Record<string, JassubCtor | undefined>
  if (g[GLOBAL]) return Promise.resolve(g[GLOBAL]!)
  if (pending) return pending
  pending = new Promise<JassubCtor>((resolve, reject) => {
    const s = document.createElement('script')
    s.type = 'module'
    s.async = true
    s.src = `${JASSUB_BASE}jassub.mjs`
    s.onload = () => (g[GLOBAL] ? resolve(g[GLOBAL]!) : reject(new Error('jassub_global_missing')))
    s.onerror = () => reject(new Error('jassub_script_load_failed'))
    document.head.appendChild(s)
  })
  pending.catch(() => {
    pending = null
  })
  return pending
}

export function jassubOptions(canvas: HTMLCanvasElement, subContent: string, fonts: string[]): Record<string, unknown> {
  return {
    canvas,
    subContent,
    fonts,
    workerUrl: `${JASSUB_BASE}jassub-worker.js`,
    wasmUrl: `${JASSUB_BASE}jassub-worker.wasm`,
    modernWasmUrl: `${JASSUB_BASE}jassub-worker-modern.wasm`,
    availableFonts: { 'liberation sans': `${JASSUB_BASE}default.woff2` },
    queryFonts: false,
  }
}
