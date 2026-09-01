# Transovo Verify — Dormant (Not V1)

**Status:** DORMANT / NOT FOR V1

Verify is intentionally hidden from customer-facing V1. The implementation is **preserved**, not abandoned.

## Why dormant

Commercial/provider economics — not a technical failure. Verify may return when economics improve.

## What is preserved

- Provider-agnostic `PhoneVerificationResult` schema
- Canonical `verifyPhoneNumber()` service
- Bulk jobs, dedupe, partial-failure recovery, CSV exports
- Provider cost tracking
- API-ready boundaries and tests (`npm run test:verify`)

## Customer-facing behavior (V1)

- No nav, pricing, checkout, or marketing surfaces
- `/verify/*` and `/phone-verification` redirect away
- Purchase and lookup APIs return `VERIFY_DORMANT` unless `TRANSOVO_VERIFY_LAUNCH_ENABLED=1`

## Reactivation checklist

1. Commercial/provider review
2. Set `TRANSOVO_VERIFY_LAUNCH_ENABLED=1` in non-prod first
3. Run `npm run sync:stripe-platform-catalog` with Verify enabled
4. Re-enable customer surfaces (nav, landing, billing catalog)
5. Run `npm run test:verify` + live Telnyx lookup smoke
