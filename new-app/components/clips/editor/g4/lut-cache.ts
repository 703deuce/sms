/**
 * G4a: imported .cube LUTs for the preview / scopes (same parser as the server + worker).
 * Bytes come from the same-origin route /api/clips/luts/<id>/file.
 */
import { parseCube, type CubeLut } from '@/lib/clips/editor/color-grade'

type Slot = { state: 'loading' } | { state: 'ok'; lut: CubeLut } | { state: 'error'; error: string }
const slots = new Map<string, Slot>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version++
  listeners.forEach((fn) => fn())
}

export function lutVersion(): number {
  return version
}

export function onLutsChanged(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** The parsed LUT, or null while it loads / when it failed (the grade then skips the LUT). */
export function lutFor(id: string | undefined | null): CubeLut | null {
  if (!id) return null
  const s = slots.get(id)
  if (s?.state === 'ok') return s.lut
  if (s) return null
  slots.set(id, { state: 'loading' })
  void fetch(`/api/clips/luts/${encodeURIComponent(id)}/file`, { credentials: 'same-origin' })
    .then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      slots.set(id, { state: 'ok', lut: parseCube(await r.text()) })
    })
    .catch((e: unknown) => slots.set(id, { state: 'error', error: e instanceof Error ? e.message : 'load failed' }))
    .finally(emit)
  return null
}

export function lutError(id: string | undefined | null): string | null {
  const s = id ? slots.get(id) : undefined
  return s?.state === 'error' ? s.error : null
}

/** Seed after an upload (the client already parsed the file). */
export function primeLut(id: string, lut: CubeLut) {
  slots.set(id, { state: 'ok', lut })
  emit()
}
