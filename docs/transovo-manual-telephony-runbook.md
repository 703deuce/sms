# Transovo Manual Telephony Runbook

**Branch:** `cursor/transovo-finish-gaps-5c36`  
**Purpose:** Manual smoke matrix before production deploy

## Prerequisites

- Workspace with MCTB + Smart Routing entitlements (or trial via `POST /api/platform/billing/trial`)
- Messaging compliance approved for outbound SMS
- Assigned routing number voice-ready
- `DATABASE_URL` and provider credentials configured

## Test matrix

| # | Scenario | Steps | Pass criteria |
|---|----------|-------|---------------|
| 1 | MCTB Press-1 | Forward PSTN → platform number, miss call, press 1 | Consent recorded; recovery SMS sent; `missed_call_events.status=SENT` |
| 2 | MCTB existing consent | Set consent mode `existing_consent`, attest, miss call | No DTMF prompt; SMS after eligibility |
| 3 | Link tracking | Set default link URL in setup; trigger recovery SMS | Message contains `/r/{token}`; click creates `link_click_events` with `missedCallEventId` |
| 4 | Request form | Enable request form; open `/f/mctb/{token}`; submit | Row in `mctb_request_form_submissions`; contact upsert if lead capture on |
| 5 | Direct dial forward | Set `directDialForwardE164`; inbound SIP | Python log `mctb_direct_dial_forward_early`; no consent prompt |
| 6 | SR publish loop guard | Publish flow transferring to routing number | Publish rejected with routing loop error |
| 7 | SR analytics UI | Open `/smart-routing/analytics` | KPI cards load from `/api/smart-routing/analytics` |
| 8 | SR → MCTB fallback | Configure fallback route; no-answer path | `smart_routing` activity shows fallback item |
| 9 | Voicemail notify | Leave VM on entitled workspace | In-app notification; email if box notify configured |
| 10 | Callback email | Trigger CALLBACK node | `callback_requests` row; Brevo email to owner |
| 11 | Trial grant | Billing → Try trial on inactive product | `workspace_product_features.status=TRIAL` |
| 12 | Subscription deleted | Cancel Stripe platform subscription | Webhook deactivates granted features |

## Automated hermetic checks (no PSTN)

```bash
npx tsx scripts/test-transovo-finish-gaps.ts
npm run test:transovo-platform
```

## Rollback

- Disable MCTB: setup → turn off enabled
- Pause SR flows before removing numbers
- Migration is additive; no runtime teardown required
