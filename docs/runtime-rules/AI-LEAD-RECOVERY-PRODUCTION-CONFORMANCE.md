# AI Lead Recovery — Production Reliability Conformance Matrix

**Purpose:** Map the [Text/SMS Master Reliability Specification](#locked-text-agent-architecture) (voice-derived, text-applicable) to **existing** MCTB AI Lead Recovery code. **Audit and harden — do not rebuild parallel engines.**

**Status vocabulary**

| Status | Meaning |
|--------|---------|
| `CONNECTED_AND_WORKING` | Implemented and wired on production path |
| `PARTIAL` | Present but incomplete, not on all paths, or weak guarantees |
| `MISSING` | Not implemented; spec requires it |
| `NOT_APPLICABLE_TEXT_CHANNEL` | Voice/telephony-only concern |
| `LEGACY_CONFLICT` | Legacy path can still bypass or diverge |

**Production SMS path (canonical order):**  
`customer-sms.ts` → handoff → `handleMctbLeadRecoveryInboundSms` (`conversation-runtime.ts`) → else legacy AI booking → John fallback (`john-policy-guard.ts`).

**Engine inventory (target: 1 each)**

| Engine | Canonical location | Status |
|--------|-------------------|--------|
| Lead Recovery runtime | `src/lib/mctb/lead-recovery/*` | `CONNECTED_AND_WORKING` |
| Booking orchestrator | `src/lib/mctb/ai-booking/orchestrator.ts` | `CONNECTED_AND_WORKING` (delegated from LR) |
| Policy config store | `customFieldsConfig.mctb.leadRecovery` via `config.ts` | `CONNECTED_AND_WORKING` |
| Intent layer | `intent-agent.ts` | `CONNECTED_AND_WORKING` |
| John legacy | `customer-llm-loop` + `john-policy-guard.ts` | `LEGACY_CONFLICT` (fallback only) |

**P0 gaps (text-specific, align with voice lesson)**

1. **`stateVersion` / stale-action guard** — `conversation-guard.ts` + cancel/opt-out invalidation (rules 40–42); booking/payment preflight still needs epoch check at provider write (rule 41).
2. **Conversation-level lock** — in-process `withLeadRecoveryConversationLock` (rule 37, 40); multi-worker DB lock still `MISSING`.
3. **Inbound provider message dedupe** — `processedInboundIds` + `providerMessageId` on Telnyx path (rule 38); outbound idempotency still body-sliced in places.
4. **Capability exposure** — LR path is policy-driven; John fallback still exposes broad LLM tools (rule 12–13, 74–75).

---

## Conformance matrix (rules 1–100)

| Rule | Voice / reliability principle | Applies to text? | Existing implementation | Status | Gap | Required change (harden, not rebuild) | Test / audit |
|------|------------------------------|------------------|-------------------------|--------|-----|--------------------------------------|--------------|
| 1 | Single engine — no duplicate LR/booking/intent/policy | YES | `lead-recovery/*`, `ai-booking/orchestrator.ts`, `config.ts` | `CONNECTED_AND_WORKING` | AI booking session parallel to LR state | Document single delegation; avoid new orchestrators | `test-mctb-lead-recovery-conformance-audit.ts` |
| 2 | Deterministic app shell around LLM | YES | `conversation-runtime.ts` intent→policy→actions | `PARTIAL` | John path still “big loop” | Narrow John; keep LR as primary | `test-mctb-lead-recovery-intent-policy-separation.ts` |
| 3 | Strip voice-only layers | N/A (meta) | Not ported in LR | `CONNECTED_AND_WORKING` | — | — | — |
| 4 | Runtime owns durable conversation state | YES | `state-store.ts` → `mctbConversationAutomationState` | `PARTIAL` | Missing `stateVersion`, `actionHistory`, `policyVersion` on state | Extend `LeadRecoveryConversationState` + persist | Extend simulation + integration tests |
| 5 | Incremental state, not reclassify whole thread each turn | YES | `mergeIntentIntoState`, `loadLeadRecoveryState` | `PARTIAL` | Re-runs intent agent each message; context via state not full history | Pass prior state into intent agent; merge entities | `test-mctb-lead-recovery-multi-intent.ts` |
| 6 | Universal intent taxonomy | YES | `types.ts` `LEAD_RECOVERY_INTENTS`, `AI-LEAD-RECOVERY-INTENT-CATALOG.md` | `CONNECTED_AND_WORKING` | Catalog vs spec naming drift | Align docs only | `test-mctb-lead-recovery-intent.ts` |
| 7 | Structured intent output (schema) | YES | `intent-agent.ts`, `normalizeStructuredIntent` | `CONNECTED_AND_WORKING` | — | — | `test-mctb-lead-recovery-intent.ts` |
| 8 | Intent ≠ policy | YES | `policy-engine.ts`, `intent-plan.ts`, docs | `CONNECTED_AND_WORKING` | — | — | `test-mctb-lead-recovery-intent-policy-separation.ts` |
| 9 | Intent agent does not execute actions | YES | Intent module has no SMS/booking sends | `CONNECTED_AND_WORKING` | — | — | conformance audit script |
| 10 | Specialists understand, not execute | YES | `ai-booking/agents/scheduling-specialist.ts` | `PARTIAL` | Specialist wired mainly on AI booking delegate path | Keep booking specialist out of side effects | AI booking tests |
| 11 | Not one agent per intent | YES | Single intent agent + policy | `CONNECTED_AND_WORKING` | John is second conversational stack | — | — |
| 12 | Capability resolution before model | YES | Policy `nextActions`; LR turn is not tool-bag LLM | `PARTIAL` | John fallback after LR | LR-only path for enabled workspaces | policy tests |
| 13 | No global tool bag | YES | Action registry + policy actions | `PARTIAL` | John runtime tools | Guard or disable tools on John when LR enabled | `john-policy-guard.ts` tests |
| 14 | Runtime authorizes every consequential action | YES | `policy-engine.ts`, `action-runtime.ts`, orchestrator preflight | `PARTIAL` | Not all actions have uniform preflight object | Shared `authorizeAction()` wrapper | New headless auth tests |
| 15 | Never trust model authoritative IDs | YES | Booking links from DB; calendars via orchestrator | `CONNECTED_AND_WORKING` | Audit John extracts | Extend john guard | conformance audit |
| 16 | Narrow tool/action schemas | YES | `action-registry.ts` typed actions | `PARTIAL` | John may use generic runtime turn | — | legacy prompt audit |
| 17 | Tools are thin adapters to services | YES | `action-runtime.ts` → handoff, booking config, T2P hooks | `CONNECTED_AND_WORKING` | — | — | conformance audit (no direct provider) |
| 18 | Read vs state write vs side effect | YES | Implicit in action types | `PARTIAL` | Not formal enum layer | Tag actions in registry | — |
| 19 | Internal state updates not always tools | YES | `field-collection.ts`, `applyCollectedField` | `CONNECTED_AND_WORKING` | — | — | — |
| 20 | Confirmation gates for consequential actions | YES | AI booking stages + slot selection | `PARTIAL` | LR booking link send lacks explicit confirm record | `confirmation` on state for BOOKING/PAYMENT | scenario tests |
| 21 | SMS consent / opt-out authoritative | YES | STOP in `intent-agent`, `customer-sms`, suppression | `CONNECTED_AND_WORKING` | HELP/consent mode spread across MCTB setup | Centralize in messaging policy | opt-out scenario |
| 22 | Success only after authoritative success | YES | Orchestrator + provider adapters | `PARTIAL` | LR templates can imply success before send completes | Gate reply on `sendQuickSms` result | — |
| 23 | Typed action outcomes | YES | Policy + action strings; booking typed errors | `PARTIAL` | Not unified `ActionOutcome` enum for all actions | Normalize in `action-runtime.ts` | — |
| 24 | Fallback chains | YES | `fallbackPolicy`, AI booking `fallback.ts` | `PARTIAL` | Not all intents have documented chain | Map per intent in policy defaults | simulation UI |
| 25 | Universal SAFE_FALLBACK | YES | `fallbackPolicy`, UNKNOWN intent handling | `PARTIAL` | — | Explicit `SAFE_FALLBACK` action | — |
| 26 | Do not optimize for full automation | YES | Product/docs | `CONNECTED_AND_WORKING` | — | — | — |
| 27 | Prompt / RAG / runtime truth model | YES | FAQ policy, AI booking knowledge | `PARTIAL` | John may still RAG broadly | Shared knowledge compilation with voice | `test-mctb-lead-recovery-legacy-prompt-audit.ts` |
| 28 | Common facts without RAG | YES | FAQ/hours in policy + config | `PARTIAL` | — | Prompt-first FAQ path | scenario |
| 29 | Narrow RAG | YES | Provider rulebooks | `PARTIAL` | John path unverified | — | — |
| 30 | RAG not transactional truth | YES | Availability via orchestrator | `CONNECTED_AND_WORKING` | — | — | provider audits |
| 31 | Prompt injection resistance | YES | Policy engine authoritative | `PARTIAL` | LLM layers can still be manipulated in phrasing | Runtime deny on policy | injection scenarios |
| 32 | Business policies config-driven | YES | `config.ts`, `customFieldsConfig.mctb.leadRecovery` | `CONNECTED_AND_WORKING` | — | — | `test-mctb-lead-recovery-policy.ts` |
| 33 | Structured config authoritative | YES | `loadLeadRecoveryConfig` | `CONNECTED_AND_WORKING` | — | — | — |
| 34 | Persist entities incrementally | YES | `mergeIntentIntoState`, COLLECT_FIELD | `CONNECTED_AND_WORKING` | — | — | — |
| 35 | Do not re-ask known fields | YES | `collectedFields`, `missingFields` | `PARTIAL` | Intent agent may still ask in delegate paths | — | — |
| 36 | Multi-field SMS OK | YES | Product choice | `CONNECTED_AND_WORKING` | — | — | — |
| 37 | Multi-message burst / ordering | YES | `conversation-guard.ts` `mergeBurstFragments` + lock | `PARTIAL` | No cross-worker inbox queue | DB-ordered inbox + debounce | `mctb-lead-recovery-deepseek-cert.ts` |
| 38 | Inbound webhook dedupe | YES | `registerInboundProviderMessage` on LR ingress | `PARTIAL` | Outbound keys still body-sliced | Extend dedupe to all ingress paths | cert concurrency suite |
| 39 | Out-of-order delivery events | YES | Delivery trace separate | `PARTIAL` | LR state not delivery-aware | Document boundaries | — |
| 40 | Conversation locking | YES | `withLeadRecoveryCrossWorkerLock` | `PARTIAL` | PG advisory when DB available; E2E CAS | multi-instance CAS cert | cert cross-worker |
| 41 | Stale model result / state version | YES | `stateVersion`, `pendingActionEpoch` | `PARTIAL` | Provider writes lack epoch gate | Preflight book/pay/SMS vs epoch | stale action test |
| 42 | Change of mind | YES | `shouldInvalidatePendingActions` | `PARTIAL` | No durable pending action queue | Wire epoch to action-runtime | cert stale test |
| 43 | Corrections (latest wins) | YES | New message overwrites via merge | `PARTIAL` | No explicit correction trace | Field-level `confirmedAt` | — |
| 44 | Multi-intent messages | YES | `secondary_intents`, `intent-plan.ts` | `CONNECTED_AND_WORKING` | — | — | `test-mctb-lead-recovery-multi-intent.ts` |
| 45 | Secondary intent execution deterministic | YES | `evaluateLeadRecoveryPolicyMulti`, precedence doc | `PARTIAL` | Precedence not exhaustive in code | `policy-precedence.ts` enforcement | multi-intent tests |
| 46 | Confidence is signal only | YES | `confidence` on intent | `PARTIAL` | Low confidence → clarify not fully wired | Threshold → clarify → fallback | — |
| 47 | UNKNOWN valid | YES | UNKNOWN intent + fallback | `CONNECTED_AND_WORKING` | — | — | — |
| 48 | Do not invent capabilities | YES | `policy-health.ts`, disabled scenarios | `CONNECTED_AND_WORKING` | John may over-promise | john-policy-guard | policy health UI |
| 49 | Booking link mode | YES | `SEND_BOOKING_LINK` in `action-runtime.ts` | `CONNECTED_AND_WORKING` | — | — | — |
| 50 | AI booking mode | YES | Delegate to `ai-booking/conversation-runtime.ts` | `CONNECTED_AND_WORKING` | — | — | AI booking tests |
| 51 | Slot tokens / offered times | YES | `slot-id.ts`, session store | `CONNECTED_AND_WORKING` | LR path separate from slot session | — | — |
| 52 | Revalidate availability before book | YES | Orchestrator preflight | `CONNECTED_AND_WORKING` | — | — | Microsoft/Calendly audits |
| 53 | Provider rulebooks authoritative | YES | `docs/runtime-rules/providers/*` | `CONNECTED_AND_WORKING` | — | — | provider conformance audits |
| 54 | Payment requests — no LLM amount | YES | T2P paths in action-runtime | `PARTIAL` | Amount authority rules need test coverage | Stripe rulebook tests | Stripe audit |
| 55 | Payment status from provider | YES | Stripe integration | `PARTIAL` | SMS reply may not always query state | Read canonical PaymentRequest | — |
| 56 | Pricing policy | YES | FAQ/pricing policy shapes | `PARTIAL` | John PRICE_IN_REPLY guard | Extend to LR replies | john guard test |
| 57 | Service area structured | YES | `serviceAreaPolicy` in config | `PARTIAL` | — | — | — |
| 58 | Emergency immediate actions | YES | Policy actions + notify | `CONNECTED_AND_WORKING` | — | — | — |
| 59 | Callback destinations from config | YES | Handoff notifications | `CONNECTED_AND_WORKING` | — | — | — |
| 60 | Complaints modify behavior | YES | Intent flag `complaint` | `PARTIAL` | Policy hooks incomplete | Complaint policy preset | — |
| 61 | OPT_OUT overrides | YES | OPT_OUT intent + suppression | `CONNECTED_AND_WORKING` | — | — | opt-out scenario |
| 62 | Idempotent side effects | YES | `domain-events.ts`, handoff keys, booking idempotency | `PARTIAL` | Keys sometimes body-sliced | Canonical keys per action type | duplicate test |
| 63 | Action state machine | YES | Domain events kinds | `PARTIAL` | Not full REQUESTED→SUCCEEDED on all actions | `mctbConversationBookingActivity` model | — |
| 64 | Durable action history | YES | `mctbConversationBookingActivity`, LR state | `PARTIAL` | Not all actions logged | Expand `recordLeadRecoveryDomainEvent` | — |
| 65 | Limit retries | YES | `clarificationAttempts` | `PARTIAL` | No global retry budget | — | — |
| 66 | No-progress detection | YES | — | `MISSING` | — | Loop detector on state | — |
| 67 | Bound action chain depth | YES | Policy `nextActions` lists | `PARTIAL` | — | Max steps constant | — |
| 68 | Normalized provider failures | YES | AI booking + provider adapters | `PARTIAL` | LR SMS errors generic | Map to typed outcomes | — |
| 69 | Task-specific prompts | YES | Intent agent system; AI booking prompts | `PARTIAL` | John still large | Shrink John context | legacy prompt audit |
| 70 | Prompts describe behavior not policy | YES | Docs + intent agent wording | `CONNECTED_AND_WORKING` | — | — | conformance audit |
| 71 | Context isolation | YES | State + single message to intent agent | `PARTIAL` | John uses longer history | — | — |
| 72 | Customer knowledge compilation | YES | Shared with voice via wizard/policy bridge (voice); MCTB config for text | `PARTIAL` | Unify FAQ compilation | Reuse voice prompt compilers where safe | — |
| 73 | Custom instructions cannot override policy | YES | Policy engine | `PARTIAL` | UI custom instructions scope unclear | Hard guard | — |
| 74 | Legacy John bounded | YES | `john-policy-guard.ts` | `PARTIAL` | John still runs if LR returns `handled: false` | Tighten fallback conditions | john guard tests |
| 75 | Single authoritative action path | YES | conformance audit forbids direct provider in LR | `PARTIAL` | John + old booking path | Repo audit script | `test-mctb-lead-recovery-conformance-audit.ts` |
| 76 | Domain events | YES | `domain-events.ts` | `PARTIAL` | Not full spec event list | Emit ACTION_* events | — |
| 77 | Version everything | YES | Fingerprint on voice; LR config versions partial | `PARTIAL` | No per-turn version bundle on SMS | Persist `policyVersion`, `intentSchemaVersion` on state | — |
| 78 | Failure classification | YES | — | `MISSING` | — | Taxonomy in observability | — |
| 79 | No prompt-only structural fixes | YES | Engineering principle | `CONNECTED_AND_WORKING` | — | Use this matrix before prompts | — |
| 80 | Headless / automated certification | YES | `simulation.ts`, API simulate route | `PARTIAL` | Not full multi-turn burst harness | Text headless cert (like voice) | `test-mctb-lead-recovery-*.ts` |
| 81 | Two test layers (deterministic + model) | YES | Policy tests + intent tests | `PARTIAL` | No recording provider adapters suite | Add layer B with mock SMS | — |
| 82 | Intent variation tests | YES | Scenarios in `scenarios.ts` | `PARTIAL` | Coverage incomplete | Expand scenario catalog | simulation drawer |
| 83 | Multi-message burst tests | YES | — | `MISSING` | — | Rule 37 test suite | — |
| 84 | Stale action race tests | YES | — | `MISSING` | — | Rule 41 tests | — |
| 85 | Booking race tests | YES | AI booking tests partial | `PARTIAL` | — | Slot unavailable scenario | — |
| 86 | Provider disconnect tests | YES | `policy-health.ts`, readiness | `PARTIAL` | — | — | readiness UI |
| 87 | Payment safety tests | YES | Stripe audit docs | `PARTIAL` | — | Automated no-amount test | Stripe audit |
| 88 | Prompt-first knowledge tests | YES | — | `MISSING` | — | RAG count assertion | — |
| 89 | RAG tests | YES | — | `MISSING` | — | — | — |
| 90 | Opt-out tests | YES | STOP handling | `PARTIAL` | — | Dedicated regression | — |
| 91 | Secondary intent tests | YES | `test-mctb-lead-recovery-multi-intent.ts` | `CONNECTED_AND_WORKING` | — | — | — |
| 92 | Change of mind tests | YES | — | `MISSING` | — | — | — |
| 93 | Duplicate webhook tests | YES | — | `MISSING` | — | — | — |
| 94 | Out-of-order delivery tests | YES | — | `MISSING` | — | — | — |
| 95 | Concurrency load tests | YES | — | `MISSING` | — | — | — |
| 96 | Metrics | YES | AI booking observability partial | `PARTIAL` | LR-specific metrics thin | Dashboard fields | — |
| 97 | Internal conversation review | YES | Simulation UI, handoff snapshots | `PARTIAL` | No single LR debug timeline | Build on booking activity + state | — |
| 98 | Production failure → regression | YES | Principle | `PARTIAL` | No formal LR regression bank | `scenarios.ts` from incidents | — |
| 99 | Product priority order | YES | Docs | `CONNECTED_AND_WORKING` | — | — | — |
| 100 | Final invariant (runtime decides) | YES | LR architecture intent | `PARTIAL` | John path drifts | Close gaps in rows 37–41, 74–75 | matrix review quarterly |

---

## Voice-only principles (do not port to text)

These appear in the voice master spec but are **`NOT_APPLICABLE_TEXT_CHANNEL`** for Lead Recovery SMS:

| Topic | Notes |
|-------|--------|
| STT / TTS / VAD / barge-in | No audio path in LR SMS |
| PSTN / codecs / microphone / speaker | MCTB voice is separate product surface |
| Turn-end / end-of-speech detection | SMS is message-bound, not utterance-bound |
| Spoken latency fillers | N/A |
| Call hangup / recording disclosure | TeXML/voice only |
| Telnyx tool webhook timing | Voice `send_resource` only; SMS uses `customer-sms.ts` |
| Sub-second tool callback latency | SMS allows seconds; still avoid hangs |

---

## Locked text-agent architecture (reference)

```
INBOUND SMS → INGESTION/DEDUPE → CONVERSATION RUNTIME → INTENT AGENT
→ DURABLE STATE → POLICY → WORKFLOW/PRECEDENCE → CAPABILITY RESOLVER
→ CONVERSATIONAL MODEL (when needed) → ACTION REQUEST → RUNTIME VALIDATOR
→ DETERMINISTIC SERVICE → PROVIDER ADAPTER → AUTHORITATIVE RESULT
→ STATE UPDATE → CUSTOMER RESPONSE
```

**Text-specific invariant (from voice lesson, adapted):**

> A model or policy decision is valid only against the **conversation state version** it was produced from. A newer customer message may invalidate a pending side effect before execution.

Implement as: `stateVersion` increment on each inbound message; action preflight checks `decisionStateVersion === currentStateVersion`.

---

## Related docs

- `AI-LEAD-RECOVERY-POLICY-ENGINE.md`
- `AI-LEAD-RECOVERY-ACTION-REGISTRY.md`
- `AI-LEAD-RECOVERY-INTENT-CATALOG.md`
- `AI-LEAD-RECOVERY-POLICY-PRECEDENCE.md`
- `AI-LEAD-RECOVERY-CAPABILITY-MODEL.md`
- Provider rulebooks under `docs/runtime-rules/providers/`

---

## Next hardening passes (recommended order)

1. **Concurrency + versioning** (rules 37, 40–41, 84) — highest ROI for SMS reliability.  
2. **Inbound dedupe** on provider message ID (rule 38, 93).  
3. **Headless certification** — multi-turn burst + race scenarios (rules 80–84).  
4. **John fallback shrink** when LR enabled (rules 12–13, 74–75).  
5. **Do not trust `verbal_sms_consent` in tool args** — voice lesson; for text, **session consent flags** before side effects (rule 20–21 analog).

*Last updated: 2026-09-13 — initial matrix from repo audit (`lead-recovery/*`, `customer-sms.ts`, `ai-booking/*`).*
