#!/usr/bin/env node
/** Fail if AI Producer PR touches protected clipper/producer paths (allowlist mount lines only). */
import { execSync } from 'node:child_process'

const base = process.env.PROTECTED_DIFF_BASE || 'origin/master'
const diff = execSync(`git diff --name-only ${base}...HEAD`, { encoding: 'utf8' })
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)

const blockedPrefixes = [
  'worker/clips_worker/streamer/',
  'worker/clips_worker/video_picker',
  'new-app/lib/clips/edits.ts',
  'new-app/lib/clips/edits-reducer.ts',
  'new-app/lib/server/clips/producer-run.ts',
  'new-app/app/api/clips/',
  'new-app/components/clips/producer/',
]

const allowedExact = new Set([
  'new-app/components/clips/editor/producer-popover.tsx',
  'new-app/components/clips/project-clips-view.tsx',
  'worker/clips_worker/job_types.py',
  'worker/clips_worker/main.py',
  'new-app/prisma/schema.prisma',
])

const violations = diff.filter((f) => {
  if (allowedExact.has(f)) return false
  return blockedPrefixes.some((p) => f.startsWith(p) || f === p)
})

if (violations.length) {
  console.error('Protected path violations:', violations)
  process.exit(1)
}
console.log('OK ai-producer protected paths')
