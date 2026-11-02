/**
 * Read-only: clips likely mutated by #929 on-open sentence snap since deploy window.
 * Run: cd new-app && NODE_OPTIONS='--import ../scripts/preload-server-only.mjs' npx tsx scripts/report-sentence-snap-repair-clips.ts [sinceIso]
 */
import { listClipsLikelySentenceSnapRepaired } from '@/lib/server/clips/restore-clip-bounds'

const sinceIso = process.argv[2] ?? '2026-11-02T00:30:00.000Z'
const rows = await listClipsLikelySentenceSnapRepaired(sinceIso)
console.log(JSON.stringify({ sinceIso, count: rows.length, clipIds: rows.map((r) => r.id), rows }, null, 2))
