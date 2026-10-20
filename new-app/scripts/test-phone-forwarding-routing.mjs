#!/usr/bin/env node
import assert from 'node:assert/strict'
import { validateMenuDigit, validateDestinationE164 } from '../lib/server/phone/routing/validation.ts'
import {
  extractGatherDigits,
  simultaneousRaceLost,
  shouldTrySequentialOnHangup,
} from '../lib/server/phone/routing/routing-logic.ts'
import { parseFallbackJson } from '../lib/server/phone/routing/routing-logic.ts'

validateMenuDigit('1')
let bad = false
try {
  validateMenuDigit('a')
} catch {
  bad = true
}
assert.ok(bad)

validateDestinationE164('+15551234567')
try {
  validateDestinationE164('+15551234567', '+15551234567')
  assert.fail('loop')
} catch {
  // ok
}

assert.equal(extractGatherDigits({ digits: '12' }), '2')
assert.equal(extractGatherDigits({ dtmf_digits: '99' }), '9')
assert.equal(extractGatherDigits({}), '')

assert.equal(simultaneousRaceLost('a', 'b'), true)
assert.equal(simultaneousRaceLost('a', 'a'), false)

assert.equal(
  shouldTrySequentialOnHangup({
    simultaneous: false,
    queueLength: 2,
    outboundControlId: 'x',
  }),
  true,
)
assert.equal(
  shouldTrySequentialOnHangup({
    simultaneous: true,
    queueLength: 2,
    bridgeWinnerControlId: 'winner',
    outboundControlId: 'loser',
  }),
  false,
)

const fb = parseFallbackJson({ type: 'forward_phone', destinationE164: '+15550001111' })
assert.equal(fb?.type, 'forward_phone')

console.log('test-phone-forwarding-routing: PASS (validation + routing logic + fallback parse)')
