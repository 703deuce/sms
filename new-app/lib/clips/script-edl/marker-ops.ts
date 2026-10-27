import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import { createId } from '@/lib/supabase/id'

export type AddMarkerOp = {
  type: 'add_marker'
  id?: string
  outMs: number
  label?: string
  exportAsChapter?: boolean
}

export type UpdateMarkerOp = {
  type: 'update_marker'
  id: string
  patch: { label?: string; outMs?: number; exportAsChapter?: boolean }
}

export type DeleteMarkerOp = {
  type: 'delete_marker'
  id: string
}

export type MarkerCompositionOp = AddMarkerOp | UpdateMarkerOp | DeleteMarkerOp

export function isMarkerCompositionOp(op: { type: string }): op is MarkerCompositionOp {
  return op.type === 'add_marker' || op.type === 'update_marker' || op.type === 'delete_marker'
}

export function applyMarkerCompositionOp(document: ScriptDocumentV1, op: MarkerCompositionOp): ScriptDocumentV1 {
  const markers = [...(document.markers ?? [])]

  if (op.type === 'add_marker') {
    const outMs = Math.max(0, Math.round(op.outMs))
    const id = op.id ?? createId('mk')
    markers.push({
      id,
      outMs,
      label: op.label ?? 'Marker',
      exportAsChapter: op.exportAsChapter ?? true,
    })
    markers.sort((a, b) => a.outMs - b.outMs)
    return { ...document, markers }
  }

  if (op.type === 'delete_marker') {
    return { ...document, markers: markers.filter((m) => m.id !== op.id) }
  }

  const idx = markers.findIndex((m) => m.id === op.id)
  if (idx < 0) return document
  const cur = markers[idx]
  markers[idx] = {
    ...cur,
    label: op.patch.label ?? cur.label,
    outMs: op.patch.outMs != null ? Math.max(0, Math.round(op.patch.outMs)) : cur.outMs,
    exportAsChapter: op.patch.exportAsChapter ?? cur.exportAsChapter,
  }
  markers.sort((a, b) => a.outMs - b.outMs)
  return { ...document, markers }
}
