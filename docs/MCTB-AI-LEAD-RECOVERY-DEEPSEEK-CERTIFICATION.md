# MCTB AI Lead Recovery — DeepSeek Flash Production Certification

**Timestamp:** 2026-09-13T19:56:09.506Z  
**Model:** DeepSeek `deepseek-chat`  
**Runtime:** `lead-recovery/*` + `LR_CERT_FORCE_DEEPSEEK=1`  
**Prompt / policy versions:** see workspace `LeadRecoveryWorkspaceConfig.version` + intent schema in `types.ts`

## Summary

| Check | Result |
|-------|--------|
| Deterministic runtime scripts | 8/8 PASS |
| DeepSeek intent scenarios | 34/35 PASS (97.1%) |
| Secondary intent checks | 3/4 |
| Hard failures | 0 |
| Soft failures | 1 |
| Unrequested action attempts (blocked by runtime) | 0 |
| INTENT_CERT_ONLY (see E2E doc) | **YES** |

## Scoring

| Metric | Value |
|--------|-------|
| INTENT_ACCURACY | 97.1% |
| SECONDARY_INTENT_ACCURACY | 75.0% |
| WRONG_ACTION_RATE (intent probe) | 2.9% |
| FALSE_SUCCESS_RATE | 0 (not exercised in intent-only baseline) |
| DUPLICATE_SIDE_EFFECT_RATE | 0 (concurrency guards certified) |
| Est. cost / 1k intent probes | ~$0.0774 |

## SMS segment economics (production rule)

| Metric | Value |
|--------|-------|
| AVG_RESPONSE_CHARACTERS | 54 |
| P95_RESPONSE_CHARACTERS | 84 |
| AVG_SEGMENTS_PER_AI_REPLY | 1.00 |
| P95_SEGMENTS_PER_AI_REPLY | 1 |
| ONE_SEGMENT_REPLY_RATE | 100.0% |
| PERCENT_TWO_SEGMENTS | 0.0% |
| THREE_PLUS_SEGMENT_REPLY_RATE | 0.0% |
| UNNECESSARY_3_PLUS_SEGMENT_COUNT | 0 |
| UNNECESSARY_UCS2_COUNT | 0 |
| MULTI_OUTBOUND_PER_TURN_RATE | 0.0% |

Ordinary replies with **3+ segments** or **unnecessary UCS-2** are **hard certification failures**.

## Latency (intent agent / DeepSeek)

| P50 | P95 | P99 |
|-----|-----|-----|
| 1047ms | 1470ms | 1506ms |

**Tokens (approx):** in=9949 out=4702 — est cost ~$0.0027

## Hard failures

_none_

## Soft failures (intent understanding — review)

- **hours-1** [`INTENT_FAILURE`] secondary=[] expected overlap ["BUSINESS_HOURS","GENERAL_INQUIRY","BUSINESS_FAQ"]

## Known limitations (baseline)

- Full `handleMctbLeadRecoveryInboundSms` E2E with recording SMS adapters: partial (intent + policy + ingress dedupe/lock/stale guards; booking/payment provider failure matrix not in this runner).
- John fallback path not exercised in this cert run.
- AI Booking orchestrator + provider sandboxes: separate suite (`mctb/ai-booking` tests).

## Console summary

```
AI LEAD RECOVERY — DEEPSEEK FLASH PRODUCTION CERTIFICATION
Model ................................ deepseek-chat
Deterministic runtime tests .......... 8/8 PASS
Real-model scenarios ................. 34/35 PASS
Intent accuracy ...................... 97.1%
Secondary-intent accuracy ............ 75.0%
Unrequested actions (blocked) ........ 0
One-segment reply rate ............... 100.0%
P95 segments per reply ............... 1
3+ segment failures (ordinary) ..... 0
Hard failures ........................ 0
Est. DeepSeek cost ................... $0.0027
READY_FOR_PRODUCTION_REVIEW .......... YES
```


## Full agent E2E (separate run)

See `docs/MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION.md`.


## Full agent E2E (separate run)

See `docs/MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION.md`.


## Full agent E2E (separate run)

See `docs/MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION.md`.


## Full agent E2E (separate run)

See `docs/MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION.md`.


## Full agent E2E (separate run)

See `docs/MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION.md`.


## Full agent E2E (separate run)

See `docs/MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION.md`.


## Full agent E2E (separate run)

See `docs/MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION.md`.


## Full agent E2E (separate run)

See `docs/MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION.md`.
