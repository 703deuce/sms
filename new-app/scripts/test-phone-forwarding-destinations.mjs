#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  rejectDirectE164Loop,
  rejectDirectWorkspaceLoop,
  normalizeExternalDestinationE164,
} from '../lib/server/phone/routing/destination-validation.ts'
import { parseFallbackJson } from '../lib/server/phone/routing/routing-logic.ts'

assert.throws(() => rejectDirectE164Loop('+15551234567', '+15551234567'))
assert.throws(() => rejectDirectWorkspaceLoop('pn_inbound', 'pn_inbound'))
rejectDirectE164Loop(undefined, '+15559876543')
rejectDirectWorkspaceLoop('pn_a', 'pn_b')

assert.equal(normalizeExternalDestinationE164('5551234567'), '+15551234567')

const fbId = parseFallbackJson({ type: 'forward_phone', destinationId: 'dest_1' })
assert.equal(fbId?.type, 'forward_phone')
assert.equal(fbId?.destinationId, 'dest_1')

const fbE164 = parseFallbackJson({ type: 'forward_phone', destinationE164: '+15550001111' })
assert.equal(fbE164?.destinationE164, '+15550001111')

console.log('test-phone-forwarding-destinations: PASS')
