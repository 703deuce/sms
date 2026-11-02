/**
 * Restore clip_5f19e510 bounds via writeClipEditsOrThrow (same path as editor PATCH).
 * Run: cd new-app && NODE_OPTIONS='--import ../scripts/preload-server-only.mjs' npx tsx scripts/restore-clip-5f19e510-bounds.ts
 */
import {
  CLIP_5F19E510_ID,
  restoreClip5f19e510KnownGoodBounds,
} from '@/lib/server/clips/restore-clip-bounds'

const result = await restoreClip5f19e510KnownGoodBounds()
console.log(JSON.stringify({ clipId: CLIP_5F19E510_ID, ...result }, null, 2))
