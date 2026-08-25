# Transovo Fax + Verify — Launch Readiness

Run the automated matrix:

```bash
npm run test:v1-api-products
npx tsc --noEmit
```

Latest hermetic result: **49/49 PASS** (includes Reddit / market feedback checks below).

## Reddit / Market Feedback Improvements

| Area | Check | Status |
|------|-------|--------|
| **FAX** | Transparent Page Accounting | PASS |
| **FAX** | Delivery Lifecycle | PASS |
| **FAX** | Delivery Confirmation | PASS |
| **FAX** | Sender Blocking | PASS |
| **FAX** | Spam Management | PASS |
| **FAX** | Easy Cancellation | PASS |
| **FAX** | Number Portability | PASS |
| **FAX** | Pricing Transparency | PASS |
| **VERIFY** | Result Meaning / Reachability Disclaimer | PASS |
| **VERIFY** | Mobile-Only Export | PASS |
| **VERIFY** | VoIP Classification | PASS |
| **VERIFY** | Bulk Deduplication | PASS |
| **VERIFY** | Partial Failure Recovery | PASS |
| **VERIFY** | Provider-Abstraction | PASS |
| **VERIFY** | Provider Cost Tracking | PASS |
| **VERIFY** | Future Real-Time API Readiness | PASS |

## Manual / live verification still required

- Telnyx Fax Application webhook: `POST /api/webhooks/telnyx/fax`
- Live PSTN fax send + receive smoke (`TELNYX_FAX_LIVE_TEST=1`)
- Stripe catalog sync for fax/verify price IDs (`npm run sync:stripe-platform-catalog`)
- Supabase `fax-documents` bucket + migration apply
- Browser smoke: send fax with overage confirmation, block sender, delivery confirmation download, cancel subscription UI, bulk verify dedup + retry failed rows

## Product principles (graceful degradation)

**Fax:** core send/receive/storage/delivery continues if AI, notifications, or search fail.

**Verify:** bulk jobs continue on partial lookup failures; failed rows can be retried without re-charging successful rows.
