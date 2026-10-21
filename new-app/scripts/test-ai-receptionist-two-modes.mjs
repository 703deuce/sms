#!/usr/bin/env node
/**
 * AI Receptionist two-mode wiring — static regression (no PSTN).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

const nav = read('lib/nav.ts')
assert.ok(nav.includes('AI_RECEPTIONIST_PRODUCT_TITLE'), 'product title is AI Receptionist')
assert.ok(nav.includes('receptionistNavItems'), 'dynamic receptionist nav')
assert.ok(nav.includes('Caller Intake'), 'full mode intake label')
assert.ok(nav.includes('Agent Settings'), 'full mode agent nav')

const profile = read('lib/receptionist/runtime-profile.ts')
assert.ok(profile.includes('full_receptionist'), 'full profile exists')
assert.ok(profile.includes('conversational_ivr'), 'ivr profile exists')

const catalog = read('lib/server/voice-v3/tools/voice-tool-catalog.ts')
assert.ok(catalog.includes('isConversationalIvrRuntime'), 'runtime tool gate')

const editor = read('lib/server/voice-v3/editor-to-voice-v3-config.ts')
assert.ok(editor.includes('isConversationalIvrEditor'), 'compile respects profile')

const overview = read('components/receptionist/overview-page-content.tsx')
assert.ok(overview.includes('OperatingModeSelector'), 'overview mode selector')

const gate = read('lib/server/voice-v3/publish-gate.ts')
assert.ok(gate.includes('conversationalRoutes'), 'full mode semantic transfer validation')

const ms = read('lib/server/voice-v3/scheduling/microsoft-oauth.ts')
assert.ok(ms.includes('microsoftCreateEvent'), 'Microsoft Graph booking path preserved')

console.log('test-ai-receptionist-two-modes: PASS')
