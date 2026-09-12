# MCTB recovery runtime precedence

Documented from `evaluateMissedCallTextEligibility` and `classifyInboundCallOutcome` (2026-03). **Do not reorder without changing runtime.**

## Event → classification

1. Inbound call completes (TeXML / voice path).
2. `classifyInboundCallOutcome` assigns: `no_answer`, `busy`, `rejected`, `timeout`, `voicemail`, `answered`, `outbound`, `unknown`, etc.
3. `classificationTriggersMctb(classification, config)` checks per-outcome flags (`sendAfter*`).

## Eligibility checks (automatic recovery SMS)

| Order | Check | Suppression reason (examples) |
|-------|--------|-------------------------------|
| 1 | Valid caller E.164 | `INVALID_PHONE` |
| 2 | Recovery enabled (`config.enabled`) | `FEATURE_DISABLED` |
| 3 | Workspace entitlement | `TRIAL_SMS_LIMIT`, `ENTITLEMENT_SUSPENDED` |
| 4 | Not answered / not outbound | `CALL_ANSWERED`, `OUTBOUND_CALL` |
| 5 | Missed classification + trigger flags | `NOT_MISSED`, `TRIGGER_DISABLED` |
| 6 | Forwarding requirement (production) | `NOT_FORWARD_EVENT` |
| 7 | Spam heuristics | `SPAM`, `UNKNOWN_CALLER` |
| 8 | Duplicate idempotency key / already sent | `ALREADY_SENT` |
| 9 | Exclusion list (`Suppression` phone or `{workspaceId}:p:{caller}` key; MCTB manual rows use `{workspaceId}:mctb:{phone}` matched via `phone`) when `suppressBlockedNumbers` | `BLOCKED_NUMBER` — **automatic recovery SMS only**; not voice block, forwarding, or voicemail |
| 10 | Contact opt-out | `OPTED_OUT` |
| 11 | Cooldown window + max per caller | `COOLDOWN_ACTIVE` |
| 12 | Schedule pause (`isMctbSchedulePaused`) | `MCTB_DISABLED` |
| 13 | Business/send window | `OUTSIDE_SEND_WINDOW` |
| 14 | Eligible | send pipeline continues |

## After eligibility

- **Consent** (Press 1 / existing consent) — voice + SMS policy, not configured on Recovery page.
- **Messaging approval** — compliance / sender readiness.
- **Message body** — Text Back / template configuration.

## Pause vs call path

Pausing recovery sets schedule/`enabled` state so step 12 returns `MCTB_DISABLED` for new SMS. **Inbound call handling, forwarding, and voicemail TeXML are not disabled by pause.**
