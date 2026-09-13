# MCTB AI Lead Recovery — DeepSeek Flash Production Certification

**Timestamp:** 2026-09-13T19:45:52.364Z  
**Model:** DeepSeek `deepseek-chat`  
**Runtime:** `lead-recovery/*` + `LR_CERT_FORCE_DEEPSEEK=1`  
**Prompt / policy versions:** see workspace `LeadRecoveryWorkspaceConfig.version` + intent schema in `types.ts`

## Summary

| Check | Result |
|-------|--------|
| Deterministic runtime scripts | 7/7 PASS |
| DeepSeek intent scenarios | 75/77 PASS (97.4%) |
| Secondary intent checks | 10/11 |
| Hard failures | 0 |
| Soft failures | 2 |
| Unrequested action attempts (blocked by runtime) | 0 |
| READY_FOR_PRODUCTION_REVIEW | **YES** |

## Scoring

| Metric | Value |
|--------|-------|
| INTENT_ACCURACY | 97.4% |
| SECONDARY_INTENT_ACCURACY | 90.9% |
| WRONG_ACTION_RATE (intent probe) | 2.6% |
| FALSE_SUCCESS_RATE | 0 (not exercised in intent-only baseline) |
| DUPLICATE_SIDE_EFFECT_RATE | 0 (concurrency guards certified) |
| Est. cost / 1k intent probes | ~$0.0658 |

## Latency (intent agent / DeepSeek)

| P50 | P95 | P99 |
|-----|-----|-----|
| 1077ms | 1712ms | 1971ms |

**Tokens (approx):** in=17796 out=9201 — est cost ~$0.0051

## Hard failures

_none_

## Soft failures (intent understanding — review)

- **hours-1** [`INTENT_FAILURE`] secondary=[] expected overlap ["BUSINESS_HOURS","GENERAL_INQUIRY","BUSINESS_FAQ"]
- **urgent-not-emergency** [`INTENT_FAILURE`] primary=EXISTING_CUSTOMER_ISSUE expected one of ["SERVICE_REQUEST","BOOKING_REQUEST","EMERGENCY_OR_URGENT"]

## Known limitations (baseline)

- Full `handleMctbLeadRecoveryInboundSms` E2E with recording SMS adapters: partial (intent + policy + ingress dedupe/lock/stale guards; booking/payment provider failure matrix not in this runner).
- John fallback path not exercised in this cert run.
- AI Booking orchestrator + provider sandboxes: separate suite (`mctb/ai-booking` tests).

## Console summary

```
AI LEAD RECOVERY — DEEPSEEK FLASH PRODUCTION CERTIFICATION
Model ................................ deepseek-chat
Deterministic runtime tests .......... 7/7 PASS
Real-model scenarios ................. 75/77 PASS
Intent accuracy ...................... 97.4%
Secondary-intent accuracy ............ 90.9%
Unrequested actions (blocked) ........ 0
Hard failures ........................ 0
Est. DeepSeek cost ................... $0.0051
READY_FOR_PRODUCTION_REVIEW .......... YES
```
