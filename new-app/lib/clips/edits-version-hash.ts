import { canonicalEditsJson, type ClipEditsV2 } from '@/lib/clips/edits'
import { sha256Hex } from '@/lib/clips/sha256-hex'

export function editsVersionHash(edits: ClipEditsV2): string {
  return sha256Hex(canonicalEditsJson(edits))
}
