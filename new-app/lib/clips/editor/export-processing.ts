/**
 * G4c: processing the preview cannot show live (heavy, export-side) — the stage shows a note.
 *   stabilize      vidstab / deshake on export (preview = original frames)
 *   smooth slow-mo frame blending / optical flow on slowed items (preview = plain retime)
 *   auto faces     YuNet on export (preview = the region's manual mask)
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'

export function exportOnlyParts(edits: ClipEditsV2): string[] {
  const out: string[] = []
  if (edits.stabilize?.length) out.push('Stabilize')
  if (edits.smoothSlowmo && (edits.segmentSpeeds ?? []).some((s) => s.speed < 1)) out.push('Smooth slow-mo')
  if ((edits.blurRegions ?? []).some((r) => r.mode === 'faces')) out.push('Face blur tracking')
  return out
}

export function exportOnlyNote(edits: ClipEditsV2): string | null {
  const p = exportOnlyParts(edits)
  return p.length ? `Processed on export: ${p.join(' · ')} (preview shows the unprocessed motion)` : null
}
