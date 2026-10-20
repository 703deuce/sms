#!/usr/bin/env node
import assert from 'node:assert/strict'
import { validateMenuDigit, validateDestinationE164 } from '../lib/server/phone/routing/validation.ts'

validateMenuDigit('1')
validateMenuDigit('9')
let bad = false
try {
  validateMenuDigit('a')
} catch {
  bad = true
}
assert.ok(bad)

const e164 = validateDestinationE164('+15551234567')
assert.ok(e164.startsWith('+'))
try {
  validateDestinationE164('+15551234567', '+15551234567')
  assert.fail('loop')
} catch {
  // expected
}

console.log('test-phone-forwarding-routing: PASS')
