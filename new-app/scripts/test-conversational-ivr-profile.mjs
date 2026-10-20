#!/usr/bin/env node
/**
 * Focused checks for Conversational IVR runtime profile (no live PSTN).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const read = (rel) => readFileSync(join(dir, rel), 'utf8')

const agent = read('../lib/agent.ts')
assert.ok(agent.includes('runtimeProfile: "conversational_ivr"'), 'default runtime profile is conversational_ivr')
assert.ok(agent.includes('conversationalRoutes'), 'editor stores semantic routes')

const runtimeProfile = read('../lib/receptionist/runtime-profile.ts')
assert.ok(runtimeProfile.includes('CONVERSATIONAL_IVR_ACTIVE_TOOLS'), 'active tool constants exist')
assert.ok(runtimeProfile.includes('transfer_call'), 'transfer_call in allowlist')

const catalog = read('../lib/server/voice-v3/tools/voice-tool-catalog.ts')
assert.ok(catalog.includes('isConversationalIvrRuntime(config)'), 'catalog gates conversational tools')

const derive = read('../lib/server/voice-v3/intake-objective/derive-intake-objective.ts')
assert.ok(derive.includes('isConversationalIvrRuntime(config)'), 'intake objective bypass')

const recovery = read('../lib/server/voice-v3/recovery/evaluate-recovery.ts')
assert.ok(recovery.includes('isConversationalIvrRuntime(input.config)'), 'recovery disabled for conversational IVR')

const compileTransfer = read('../lib/server/receptionist/compile-transfer-from-editor.ts')
assert.ok(compileTransfer.includes('compileConversationalIvrTransferPolicy'), 'semantic route compile path')

const editorToV3 = read('../lib/server/voice-v3/editor-to-voice-v3-config.ts')
assert.ok(editorToV3.includes('isConversationalIvrEditor(editor)'), 'conversational overrides in editor compile')

const voiceRuntime = read('../app/api/internal/voice-runtime/route.ts')
assert.ok(voiceRuntime.includes('append_voice_v3_forensic_events'), 'forensics append wired')
assert.ok(voiceRuntime.includes('flush_voice_v3_forensics'), 'forensics flush wired')
assert.ok(voiceRuntime.includes('record_voice_v3_transfer_outcome'), 'transfer outcome wired')

const nav = read('../lib/nav.ts')
assert.ok(nav.includes('Conversational IVR'), 'nav product renamed')
assert.ok(nav.includes('/app/receptionist/call-routing'), 'call routing nav entry')
assert.ok(nav.includes('/app/receptionist/message-taking'), 'message taking nav entry')
assert.ok(!nav.includes("href: '/app/receptionist/appointments'"), 'appointments hidden from nav')

const compileRuntime = read('../lib/server/receptionist/compile-runtime.ts')
assert.ok(compileRuntime.includes('isConversationalIvrEditor'), 'publish validation aware of profile')

console.log('PASS test-conversational-ivr-profile')
