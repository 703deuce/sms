#!/usr/bin/env node
/** Fail if AI Producer PR touches protected clipper/producer paths (narrow allowlist). */
import { execSync } from 'node:child_process'

const base = process.env.PROTECTED_DIFF_BASE || '96d3291530720da7f740a30057a2455ee04e4a4b'
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

const allowedPatterns = [
  /^new-app\/components\/clips\/editor\/producer-popover\.tsx$/,
  /^new-app\/components\/clips\/project-clips-view\.tsx$/,
  /^worker\/clips_worker\/job_types\.py$/,
  /^worker\/clips_worker\/main\.py$/,
  /^new-app\/prisma\/schema\.prisma$/,
  /^new-app\/prisma\/migrations\//,
  /^new-app\/lib\/ai-producer-agent\//,
  /^new-app\/lib\/server\/ai-producer-agent\//,
  /^new-app\/components\/ai-producer-agent\//,
  /^new-app\/app\/api\/ai-producer-agent\//,
  /^new-app\/app\/api\/internal\/ai-producer-agent\//,
  /^new-app\/tests\/ai-producer-agent\//,
  /^worker\/clips_worker\/ai_producer_agent\//,
  /^worker\/tests\/ai_producer_agent\//,
  /^scripts\/check-ai-producer-protected-paths\.mjs$/,
]

const violations = diff.filter((f) => {
  if (allowedPatterns.some((re) => re.test(f))) return false
  return blockedPrefixes.some((p) => f.startsWith(p) || f === p)
})

if (violations.length) {
  console.error('Protected path violations:', violations)
  process.exit(1)
}
console.log('OK ai-producer protected paths')
