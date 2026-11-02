/**
 * Prod one-shot restore (plain Node — no tsx). Same CAS semantics as writeClipEditsOrThrow.
 * Run: cd new-app && node scripts/restore-clip-5f19e510-bounds.mjs
 */
import { PrismaClient } from '@prisma/client'

const CLIP_ID = 'clip_5f19e510a23241c29190475d4723aa21'
const KNOWN = {
  startMs: 0,
  endMs: 32_000,
  trim: { in: 0, out: 32_000 },
  cutRanges: [[29_215, 29_695]],
}

const prisma = new PrismaClient()

function asEdits(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return { ...raw }
}

async function main() {
  const clip = await prisma.clip.findUniqueOrThrow({ where: { id: CLIP_ID } })
  await prisma.clip.update({
    where: { id: CLIP_ID },
    data: { startMs: KNOWN.startMs, endMs: KNOWN.endMs },
  })
  const cur = asEdits(clip.edits)
  const next = {
    ...cur,
    trim: { ...KNOWN.trim },
    cutRanges: KNOWN.cutRanges.map((r) => [...r]),
  }
  const cas = await prisma.clip.updateMany({
    where: { id: CLIP_ID, editsSaveVersion: clip.editsSaveVersion },
    data: { edits: next, editsSaveVersion: { increment: 1 } },
  })
  if (cas.count !== 1) {
    throw new Error(`CAS failed (editsSaveVersion=${clip.editsSaveVersion})`)
  }
  const fresh = await prisma.clip.findUniqueOrThrow({ where: { id: CLIP_ID } })
  const edits = asEdits(fresh.edits)
  console.log(
    JSON.stringify(
      {
        clipId: CLIP_ID,
        startMs: fresh.startMs,
        endMs: fresh.endMs,
        trim: edits.trim,
        cutRanges: edits.cutRanges,
        transitions: edits.transitions,
        videoSplits: edits.videoSplits,
        editsSaveVersion: fresh.editsSaveVersion,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
