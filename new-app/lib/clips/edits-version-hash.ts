import { canonicalEditsJson, type ClipEditsV2 } from '@/lib/clips/edits'
import { sha256Hex } from '@/lib/clips/sha256-hex'

export function editsVersionHash(edits: ClipEditsV2): string {
  // B3 provenance is editor lineage only; it must not create a different render cache entry.
  // Motion Studio's extension is editor metadata too (the renderer ignores it).
  const { templateProvenance: _templateProvenance, motionStudio: _motionStudio, ...renderEdits } = edits
  return sha256Hex(canonicalEditsJson(renderEdits as ClipEditsV2))
}
