# AI Lead Recovery — Semantic Routing Audit

**Date:** 2026-09-13  
**Rule:** LLM classifies meaning; runtime owns policy, capabilities, state, and provider writes.

## Counts (production target)

| Metric | Before audit | After fix |
|--------|----------------|-----------|
| `SEMANTIC_ROUTING_REGEX_COUNT` (production intent authority) | **>1** (`deterministicLeadRecoveryIntent` + E2E shortcuts) | **0** |
| `TEST_ONLY_SEMANTIC_SHORTCUT_COUNT` | 1 (E2E bypass) | **1** (isolated fixture only) |
| `LEGACY_SEMANTIC_REGEX_COUNT` | 2+ | **2** (documented) |

## Inventory

| File | Function | Production? | Disposition |
|------|----------|-------------|-------------|
| `intent-agent.ts` | `runLeadRecoveryIntentAgent` | Yes | **FIXED** — LLM only; protocol for STOP/HELP/WRONG_NUMBER |
| `intent-agent.ts` | `deterministicLeadRecoveryIntent` (removed) | — | **MOVED** to `testing/legacy-keyword-intent-classifier.ts` (TEST ONLY) |
| `protocol-intent.ts` | `protocolLeadRecoveryIntent` | Yes | **VALID_DETERMINISTIC_SYNTAX** (SMS compliance) |
| `conversation-guard.ts` | `CANCEL_RE`, `shouldInvalidatePendingActions` | Yes | **VALID_DETERMINISTIC_SYNTAX** (cancel/stale protocol) |
| `conversation-runtime.ts` | `awaitingSlot` → `lastIntent` | Yes | **VALID** (workflow state, not keyword intent) |
| `cert-e2e` (removed) | `LR_CERT_E2E` intent shortcut | Test | **REMOVED** — was **TEST_ONLY_SHORTCUT** |
| `ai-booking/agents/router.ts` | `deterministicIntentRouter` | Fallback only | **LEGACY** — not used as authority; LLM → UNKNOWN fallback |
| `ai-booking/agents/router.ts` | `AWAITING_SLOT_SELECTION` shortcut | Yes | **VALID** (workflow stage gate) |
| `ai-booking/agents/scheduling-specialist.ts` | `deterministicSchedulingSpecialist` | Fallback / slot stage | **PARTIAL** — NL scheduling fallback uses `interpretSchedulingUtterance` (not LR intent) |
| `ai-booking/scheduling-interpreter.ts` | keyword time parsing | Yes | **PARTIAL** — entity/window extraction; prefer LLM specialist when configured |
| `john-policy-guard.ts` | `inferIntentFromJohnTurn` | John only | **LEGACY_CONFLICT** — guard boundary, not LR runtime |
| `slot-presentation.ts` | `resolveOfferedSlotChoice` | Yes | **VALID** — resolves against **persisted offered slots** |
| `field-collection.ts` | format validation | Yes | **VALID_DETERMINISTIC_SYNTAX** |

## Fixes made

1. Removed keyword-based `deterministicLeadRecoveryIntent` from production `intent-agent.ts`.
2. Added `protocol-intent.ts` for STOP / HELP / WRONG_NUMBER only.
3. Removed `LR_CERT_E2E` bypass that returned keyword intent without DeepSeek.
4. Removed production path that preferred deterministic intent when `confidence >= 0.9` or LLM confidence lower than keyword classifier.
5. Removed AI booking **cert** router/scheduling shortcuts that skipped LLM (`LR_CERT_E2E` blocks).
6. AI booking router LLM failure → **UNKNOWN**, not keyword router.
7. Added **8 negation regression** scenarios (`cert-semantic-negation.ts`) on real DeepSeek intent path.
8. Relocated legacy keyword classifier to `testing/legacy-keyword-intent-classifier.ts` for old unit scripts only.

## Negation regression scenarios

Run:

```bash
LR_CERT_E2E=1 LR_CERT_FORCE_DEEPSEEK=1 LR_CERT_DISABLE_FALLBACK=1 \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
npx tsx scripts/mctb-lead-recovery-semantic-routing-audit.ts
```

Scenarios:

1. No payment + want book  
2. No book + want price  
3. Already paid + need schedule  
4. Pay when they arrive (no deposit link)  
5. No appointment + callback  
6. Payment method FAQ  
7. Pricing question not payment request  
8. Failed payment (no new link)  

## Certification note

Prior **40/40 E2E** included cert shortcuts that could bypass DeepSeek for booking/payment intent. After this audit, **full E2E should be re-run** to confirm green on the real path (`mctb-lead-recovery-e2e-cert.ts`). Intent cert (`deepseek-cert.ts`) remains the authoritative intent accuracy suite.

## Remaining follow-ups (not blockers for this audit)

- Wire DeepSeek into AI booking router/specialist/phrasing when `LR_CERT_FORCE_DEEPSEEK=1` (today those agents use OpenAI JSON helper).
- Replace `interpretSchedulingUtterance` keyword NL with specialist LLM + runtime slot resolution only.
- John `inferIntentFromJohnTurn` keyword map — replace with structured John output when John is redesigned.
