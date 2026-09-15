# Voice V2 — Production Re-Architecture (Caller-First)

**Status:** Caller-first architecture **approved in direction**; Phase 1 + production + **final clarifications** (below) incorporated.  
**Implementation:** **STOP** — do not begin Phase 2A until this document (especially **P7 vs L2** and **Phase 2A acceptance gate**) is reviewed one more time.

---

## Executive summary

Today, PSTN Voice V2 live booking runs as **two Telnyx conversation workflow nodes** (`n_general` → LLM edge → `n_live_booking`), with **V2 tools only on Live Booking**. The first booking-intent turn often follows:

**`n_general` → LLM edge → `n_live_booking` → tool → cold CallContext → tool result → another model pass → TTS**

That is too much machinery for “I need to book.” Reference PSTN: **~7.3s** caller-stop-to-first-audio (`conversation_id` `07844724-0254-4e45-bd5b-00c5b5b21a78`).

**Target:** one conversational Amy; **conversational mode** (Telnyx/session) vs **Transovo authoritative action state** (L1/L2) clearly separated; **versioned L2** for state required before FIND/BOOK; **zero Transovo round-trip** to acknowledge pure booking intent; warmup never delays answer; tools authorized at runtime; truth-blocking only for slot claims and provider CREATE.

**Layer model:**

```
Telnyx / Amy (conversational continuity)
    → L1 CallContext (fast local)
    → L2 Redis (cross-replica session continuity)
    → Durable DB (business records)
Microsoft / providers (external booking truth)
```

---

## Phase 1 review — production amendments (required before Phase 2)

These are **architecture corrections**, not feature additions. Phase 2+ must satisfy all of them.

### P1. CallContext is L1 + L2 — not process-local only

**Rejected:** “Session store — process-local today; may add Redis later.”

**Required layering:**

| Layer | Role |
|-------|------|
| **L1** | In-process cache for fast reads on the handling replica |
| **L2** | Redis (or existing shared low-latency store), keyed by canonical call/session id |
| **Durable DB** | Eventual business records — **not** the per-turn session bus |

**Read path:** L1 hit → use immediately. L1 miss → load L2 → hydrate L1.

**L2 miss during an active known call:** reconstruct only from **enrollment snapshot** (P16: pinned config revisions at call start) + durable references — or **fail safely**. **Never** silently create blank conversational state or mid-call switch to newly published config.

**Write path:** see **§P2b** (not every mutation requires a synchronous L2 round trip). Class A: L1 immediate + **versioned L2 CAS before next authoritative action**. Class B: L1 immediate + **concurrent** L2 mirror. Durable DB remains async for bookkeeping.

**Must survive** replica changes, rolling deploys, restarts, and load balancing without losing: caller fields, booking intent, `askedFields`, offer set, selected slot, stage, scheduling preference, correction history.

**Existing primitive to extend (do not reinvent blindly):** `src/lib/voice/realtime-session/store.ts` — Redis + in-memory fallback, `patch(..., expectedVersion)`, locks. Voice V2 CallContext should follow the same production pattern with a dedicated key namespace (e.g. `voice:v2:ctx:{sessionKey}`).

### P2. `ctx.stateVersion` — optimistic concurrency

Every authoritative mutation increments version (intake save, booking intent, scheduling preference, offer set, slot selection, correction).

**Pattern:** read version *N* → propose update → atomic compare-and-set → version *N+1*. Stale work must not overwrite newer caller intent (e.g. “Tuesday” async finishing after “Actually Wednesday”).

Use **optimistic versioning / atomic Redis op** — not a Postgres transaction per conversational turn.

Surface in durable jobs: `stateVersion` on `intake:persist:{callId}:{stateVersion}`.

### P2b. L2 writes — Class A vs Class B (not all REALTIME-sync)

| Class | Examples | L2 rule |
|-------|----------|---------|
| **A — MUST be shared before next authoritative action** | Canonical intake values for BOOK gate; selected slot; offer set **reference**; caller correction affecting provider action; `bookingPreference` used by FIND; action/idempotency keys | Successful **versioned L2 CAS** before corresponding FIND/BOOK (or gate) proceeds. L1 may update immediately for responsiveness. |
| **B — conversational / non-consequential** | `askedFields`; conversational mode hints; last-question metadata; debug timing | L1 immediately; mirror to L2 **concurrently** where loss would not cause incorrect external side effects. |

**Production principle:** only state required for the **next authoritative action** must be synchronously shared on L2. Redis is not a mandatory round trip before every spoken sentence.

### P2c. `patchVoiceV2CallContext` mutation contract (Phase 2A)

Conceptual API:

```ts
patchVoiceV2CallContext({
  sessionKey,
  expectedVersion,
  mutation, // (draft) => partial state
  writeClass: "A" | "B",
})
```

Returns:

```ts
{ applied: true, newVersion: number }
| { applied: false, reason: "STALE_VERSION", currentVersion: number }
```

On `STALE_VERSION`: **do not** blindly retry the stale mutation. Reload current state, re-evaluate whether the mutation is still valid.

**Example:** v10 `requestedDate=Tuesday`; caller corrects to Wednesday → v11. A late Tuesday CAS from expectedVersion 10 **fails** and must **not** reload v11 and re-apply Tuesday.

Implement via L2 atomic compare-and-set (extend `realtime-session/store.ts` patterns).

### P3. Microsoft token — inspect, do not refresh every call

**Preload at call start:**

- provider identity, connection id, calendar id  
- token **metadata / expiry** from connection config  

**Do not** force `getValidAccessToken` / refresh-token exchange on every inbound call merely because booking *might* happen.

| Condition | Action |
|-----------|--------|
| Access token comfortably valid | No refresh |
| Near expiry **and** live booking enabled | Background refresh **once**, **distributed single-flight** per connection |
| FIND/BOOK runs before warm refresh completes | Frozen Graph path calls `getValidAccessToken` as authoritative fallback |

**Invariant:** `TOKEN_REFRESH_DUPLICATION = 0` — including **across replicas**. An in-process Promise map alone is insufficient when multiple web replicas share one Microsoft connection. Use **distributed lock / Redis lock** (existing primitives in `realtime-session/store.ts` `acquireLock`) around refresh-token rotation so two simultaneous calls → one refresh → both use the result.

### P4. No duplicate business knowledge in CallContext

Separate:

- **A. Conversational business knowledge** — already in Amy’s compiled/published Telnyx prompt (services, hours, FAQs, location, policies).  
- **B. Deterministic runtime configuration** — what code needs to execute tools.

CallContext holds **runtime facts and references**, not a second giant knowledge blob:

- `businessTimezone`, policy ids, connection ids, `businessKnowledgeRevision` / config fingerprint — **not** re-injected FAQ prose per call.

Avoid: published prompt + duplicate per-call knowledge + tool-returned same knowledge (token waste, conflicting authority).

### P5. One Amy — tool eligibility vs Telnyx reality

Collapse **conversational** node handoff (`n_general` → `n_live_booking`). **Do not** recreate handoffs just to hide tools.

**Before Phase 4, verify with Telnyx** (document in `docs/VOICE_V2_TELNYX_TRANSPORT.md`):

- **(A)** Dynamic tool enable/disable within the **same** live node/session without expensive workflow transition, **or**
- **(B)** Fixed small tool set on one Amy + **deterministic runtime authorization** (preferred if Telnyx lacks low-latency dynamic exposure).

**Current V2 live surface (small enough for fixed set):**

- `voice_v2_save_intake_fields`
- `voice_v2_find_availability`
- `voice_v2_book_offered_slot`  
- (later: callback / transfer as needed)

**Runtime must reject** tool actions not permitted by current authoritative state + workspace policy — even if Telnyx exposes the tool definition.

Design for future capability growth without a global “30 tools” bag, but **do not** assume dynamic Telnyx tool replacement without evidence.

### P6. Speech vs tool transport — document before Phase 5

**Do not assume** backend `async` fixes caller silence if Telnyx blocks speech until tool result returns.

For each long operation, classify **actual Telnyx-supported pattern**:

| Case | Pattern |
|------|---------|
| **A** | Telnyx supports non-blocking/async tool execution → ack speech concurrent with operation |
| **B** | Tool call blocks model speech until result → ack via **supported** server/runtime path, then complete into same live session |

**Before Phase 5 implementation**, add **`docs/VOICE_V2_TELNYX_TRANSPORT.md`** (or section herein) documenting verified behavior for:

- speak/ack before FIND  
- speak/ack before BOOK  
- injecting/completing async tool results  
- cancellation when call ends  

No LLM polling.

### P7. Entering booking mode — zero Transovo tool calls (LOCKED)

**Resolved contradiction:** `ZERO_TOOL_BOOKING_ENTRY` does **not** require synchronously writing Redis/L2 merely to acknowledge booking intent. Do **not** replace a blocking save tool with a blocking L2 write.

#### Two state layers

| Layer | What it is | `"I need to book."` |
|-------|------------|---------------------|
| **A. Conversational mode state** | Amy’s same session understands `conversationMode = BOOKING` (Telnyx/model transcript + instructions) | **Immediate** natural response: *“Absolutely. What day works for you?”* **No** Transovo HTTP, **no** Postgres, **no** synchronous Redis for truthfulness of that sentence. |
| **B. Transovo authoritative action state** | Versioned L1/L2 `CallContext` used for gates, FIND, BOOK, intake canonical values | **Not required** until a **legitimate Transovo interaction** needs it (save real intake, FIND, BOOK). |

**Forbidden:**

- `voice_v2_save_intake_fields` (or any HTTP tool) **solely** to enter booking mode or sync intent (e.g. fake `service_reason = "book appointment"`).
- Synchronous L2 update **solely** so Amy can acknowledge booking intent (same latency class as a fake tool).

**Allowed:**

- If Telnyx exposes a **verified** asynchronous session/event callback that mirrors mode into L2 **without** blocking speech or tool round-trip → may use (do not invent).
- On the **next** real Transovo request (save / FIND / BOOK), carry structured hints + reconcile into L2: `bookingIntentActive`, `bookingPreference`, intake values, stage — **Class A** CAS as needed before provider actions.

**Example progression:**

1. `"I need to book."` → conversational BOOKING mode only → spoken ack.  
2. `"Tomorrow afternoon. I'm Anthony."` → now structured data exists → save and/or Class A L2 patch before FIND uses `bookingPreference` + name.

This is the largest user-facing latency win vs today’s tool-first path.

### P7b. Keep P7 user-facing invariant (exact)

Caller: `"I need to book."` — Amy must **not** have to: call Transovo, write Postgres, **write Redis synchronously merely to acknowledge**, switch conversational agents, run Microsoft, save fake intake, run audit, or wait for CRM before responding.

### P8. `askedFields` — real state (Class B)

Before Amy asks e.g. email, record:

```ts
askedFields.email = { count: 1, lastAskedAt: ISO }
```

**L1 immediately;** mirror to L2 concurrently (Class B). Prevents re-ask after delays; must eventually be visible cross-replica for consistency, but must not block the next spoken line.

### P9. `bookingPreference` in session state

Explicit conversational scheduling state (newest correction wins):

```ts
bookingPreference?: {
  requestedDate?: string      // YYYY-MM-DD when resolved
  requestedTime?: string
  windowStart?: string
  windowEnd?: string
  daypart?: string
  exclusions?: string[]
  updatedAt?: string
}
```

Enables “I need tomorrow afternoon” to persist while Amy asks another question — no forced repeat of date/time after intake. Fields used by **FIND** are **Class A** before FIND runs; may exist in conversational context earlier via transcript until reconciled at first Transovo touch.

### P10. Preload never delays answer

**Order (mandatory):**

```
answer call → greeting (Lane A)
concurrently: initializeVoiceV2CallContext / warmup (Lane B) — NEVER awaited before answer/greet
```

**Certification metrics:**

- `PSTN_INGRESS_TO_ANSWER_MS`  
- `ANSWER_TO_FIRST_GREETING_AUDIO_MS`  

CallContext warmup **must not** increase either (no return of 5–6 ring behavior).

### P11. Warmup lifecycle + cancellation

No anonymous `Promise.allSettled` without call ownership.

- Each warmup task registered on session (`ctx.warmup.{taskId}`) with `AbortController` where applicable.  
- **On call termination:** abort in-flight provider warmup; stop useless work; **do not** apply late L2 patches to terminated/replaced session.  
- Work that must survive hangup → **durable BACKGROUND_VOICE job**, not call-owned promise.

### P12. Queue isolation — not everything on `voice-calls`

Observed risk: real-time call work waiting behind unrelated voice jobs.

| Class | Queue / isolation | Examples |
|-------|-------------------|----------|
| **REALTIME_CALL_SESSION** | Dedicated queue or strict priority | Time-critical **call** hooks only — not every Class B L2 mirror |
| **BACKGROUND_VOICE** | Separate queue | intake durable persist, CRM, analytics, audit, post-call enrichment |

Post-call/background backlog **must not** delay live-call session work.

### P13. Provider ops — single-flight + idempotency

| Op | Rule |
|----|------|
| **FIND** | Same logical request may share in-flight work where safe |
| **BOOK** | Same offer/slot + logical invocation → **one** Microsoft event; persist provider success before confirmation is final |
| **Delivery** | After Graph success, TTS/delivery retry only — **never** recreate Microsoft event |

### P14. Full live transcript — default

Active call: **full conversation** remains available to the model. No summarization in this refactor. Structured state = action authority; transcript = memory/recovery. Compaction only if production evidence shows context limits.

### P15. Revised implementation order

| Phase | Scope |
|-------|--------|
| **2A** | Shared CallContext + `stateVersion` + L1/L2 store — **no conversational behavior change** |
| **2B** | Warmup at call start — prove pickup/greeting metrics (P10) |
| **3** | Noncritical persistence / audit / linkage off critical path; durable BACKGROUND_VOICE jobs |
| **4** | Collapse General → Live Booking into one Amy; **P7 zero-tool booking entry**; capability-scoped tools |
| **5** | Ack/hold per **documented Telnyx transport** (P6) |
| **6** | Headless + regression + load/concurrency (multi-replica L2, version races, TOKEN_REFRESH_DUPLICATION) |
| **7** | Deploy |
| **8** | One PSTN certification — STOP |

### P16. Call enrollment snapshot (L2 miss / reconstruct)

At call enroll (VoiceCall create / AI start), persist **configuration identity** on the call record or immutable enroll blob — not “whatever config is in DB right now” on every reconstruct:

- `publishedConfigRevision` / agent version id  
- `businessKnowledgeRevision`  
- `agentRevision`  
- `workspaceId`, `agentId`  
- `providerConfigRevision` (where applicable)

**L2 miss on an active call:** rebuild CallContext from enroll snapshot + durable references. **Do not** silently apply newly published workspace config mid-call because a process restarted. New config applies to **new** calls unless explicitly designed otherwise.

### P17. Offer set / slot — authoritative references (L2 + durable store)

**BOOK on replica B after FIND on replica A** must work without process-local memory.

- **`offer-set-store`** (`voiceV2OfferSet` table) is already the **canonical durable store** for offer identity and slots — do not duplicate conflicting copies in Redis.  
- **CallContext (L2)** holds **reference + minimal state**: `offerSetId`, selected `slot_id`, expiry, stage — Class A before BOOK.  
- Canonical slot instants remain in offer-set persistence; CallContext points to them.

### P18. Phase 2A acceptance gate (before any 2B code)

Phase 2A alone must pass (headless / dual-store simulation):

| Test | Requirement |
|------|-------------|
| `L1_HIT` | PASS |
| `L1_MISS_L2_HIT` | PASS |
| `REPLICA_A_WRITE_REPLICA_B_READ` | PASS |
| `STATE_VERSION_INCREMENT` | PASS |
| `STALE_CAS_REJECTED` | PASS |
| `STALE_VALUE_NOT_REAPPLIED` | PASS |
| `ACTIVE_CALL_L2_MISS_FAILS_SAFE` | PASS (no blank state) |
| `CONFIG_REVISION_PRESERVED` | PASS |
| `OFFER_REFERENCE_SURVIVES_REPLICA` | PASS |
| `DISTRIBUTED_TOKEN_LOCK_PRIMITIVE` | IDENTIFIED (implementation may land 2B; design locked in 2A) |

**Also required for 2A sign-off:**

- **NO** conversational behavior change  
- **NO** FIND / BOOK / Microsoft changes  
- **NO** new caller latency  

### P19. Phase 2B pickup gate

Warmup is certified only with before/after comparison of:

- `PSTN_INGRESS_TO_ANSWER_MS`  
- `ANSWER_TO_FIRST_GREETING_AUDIO_MS`  

**Phase 2B FAILS** if warmup measurably adds caller-visible startup latency. Warmup begins **after** the answer/greeting fast path has been released (P10).

---

## Final architecture review — clarifications (incorporated)

Sections **P7 (two-layer state)**, **P2b (Class A/B L2)**, **P2c (patch contract)**, **P5 (Telnyx tool verify)**, **P16–P19** above satisfy the final review checklist. No Phase 2A implementation until explicit approval.

---

## A. Current call graph

### A.1 Call establishment (before first caller word)

| Step | Where | Notes |
|------|--------|--------|
| PSTN ingress | `src/lib/voice/telnyx/webhook-handlers.ts` | `call.initiated` → routing / AI |
| VoiceCall row | `handleInboundCallEvent` → `src/lib/voice/inbound.ts` | No V2 CallContext |
| Answer + mask | `startAiOnInboundCall` | Must remain first; warmup is concurrent only (P10) |
| AI start | `startAiAssistantOnCall` | Workflow `start_node_id: n_general` |
| Workflow | `conversation-workflow.ts` | V2 tools only on `n_live_booking` today |

### A.2 Reference utterance: **"I need to book."** (today — anti-pattern)

```
Caller → STT (n_general)
  → LLM edge e_general_live_booking
  → n_live_booking
  → tool-only turn → voice_v2_save_intake_fields
  → cold ensureVoiceV2CallContext (config + schema + booking cfg)
  → attachBookingWorkflow + auditLog await
  → post-tool model → TTS
```

**Target (Phase 4 + P7):** same Amy, **conversational BOOKING mode** immediately, spoken ack, **no Transovo round-trip**; authoritative L2 reconciled on first real save/FIND/BOOK.

### A.3 Later turns

Unchanged frozen FIND/BOOK primitives; FIND/BOOK still reload config today (to be served from CallContext after 2B).

### A.4 Model hops (today)

Workflow LLM edge + post-tool model pass. **Target:** eliminate edge handoff; minimize tool turns not carrying real intake/provider work.

---

## B. Sync / await inventory (first booking-intent path)

See Phase 1 table — key blockers: Telnyx edge/inference, save webhook, cold `ensureVoiceV2CallContext`, duplicate config load in `loadVoiceV2PstnLiveBookingFlag`, `auditLog.create`.

**After Phase 4 + P7:** booking-intent-only utterance removes B4–B13 from the first response path (conversational mode only; no sync L2 for ack).

---

## C. One-agent target graph

```
Call start
  Lane A: answer → greeting (never await CallContext)
  Lane B: owned warmup tasks (abort on hangup) → L1+L2 ctx + ctx.ready.*

Caller: "I need to book."
  → conversationMode = BOOKING (Telnyx session — no Transovo, no sync Redis for ack)
  → speak: "Absolutely. What day works for you?"

Caller: "Tomorrow afternoon — I'm Anthony."
  → save intake + Class A L2: bookingPreference, name (first legitimate Transovo touch)
  → speak: "Thanks, Anthony. Let me check tomorrow."
  → FIND (MUST_BLOCK slot claims; L2 Class A satisfied before provider)

Caller: "One P.M."
  → ack → BOOK (MUST_BLOCK booked claim)
  → confirm only after BOOKING_CONFIRMED
```

**Tools:** fixed small set on one Amy if Telnyx requires (P5); runtime rejects disallowed actions; no workflow node hop.

---

## D. Preload plan (Phase 2B)

**Runtime configuration only (P4)** — store on versioned `VoiceV2CallContext` in L2 (+ L1 cache):

| Item | In CallContext |
|------|----------------|
| ids | `callId`, `telnyxCallControlId`, `telnyxConversationId`, `workspaceId`, `agentId` |
| enroll snapshot | `publishedConfigRevision`, `businessKnowledgeRevision`, `agentRevision`, `providerConfigRevision` (P16) |
| intake | compiled schema, values, `askedFields`, `stateVersion` |
| booking | provider, connectionId, calendarId, duration, timezone, policy, token **metadata** |
| scheduling | `bookingPreference` (P9) |
| capabilities | flags; runtime tool authorization (P5) |
| references | config fingerprint — **not** duplicate FAQ text (P4) |
| workflow | `bookingWorkflow`, `currentOfferSet` **ref** (P17), stage |

**Token (P3):** inspect expiry; conditional single-flight refresh — not unconditional `getValidAccessToken` on every call.

**Hook:** fire-and-forget after answer/greet — `initializeVoiceV2CallContext({ warmup: true, signal: abortSignal })`.

```ts
ctx.ready = {
  workspace: Promise<void>,
  intake: Promise<void>,
  booking: Promise<void>,  // connection + token metadata; conditional refresh
}
```

---

## E. Async plan

| Operation | Target | Queue class |
|-----------|--------|-------------|
| L2 Class A CAS | Sync in request path before FIND/BOOK/gate | In-process + Redis (not a separate queue) |
| L2 Class B mirror | Concurrent best-effort | Optional REALTIME only if async mirror needed |
| Intake snapshot → VoiceCall.metadata | Durable job | BACKGROUND_VOICE |
| auditLog traces | Durable job | BACKGROUND_VOICE |
| CRM / linkage / analytics | Durable job | BACKGROUND_VOICE |
| Post-call reconcile | Existing hooks | BACKGROUND_VOICE / POST_CALL_ONLY |
| Graph CREATE | Sync in BOOK tool | MUST_BLOCK **claim**; speech per P6 |

**Idempotency:** `intake:persist:{callId}:{stateVersion}`, Graph transaction id, BOOK single-flight (P13).

---

## F. MUST_BLOCK list (unchanged — confirmed correct)

Block the **claim**, not all speech:

- Actual availability before stating openings  
- Revalidate + provider CREATE before “you’re booked”  
- Transfer / payment when applicable  

Everything else: preparation, persistence, observability, enrichment — **default DEFER**.

---

## G. File plan (revised phases)

| File | Phase | Why |
|------|-------|-----|
| `docs/VOICE_V2_CALLER_FIRST_ARCHITECTURE.md` | 1 + amendments | This document |
| `docs/VOICE_V2_TELNYX_TRANSPORT.md` | Before 5 | P6 transport truth |
| `src/lib/voice-v2/session/call-context-store.ts` (new) | 2A | L1+L2, `patchVoiceV2CallContext` (P2c) |
| `src/lib/voice-v2/call-context.ts` (new) | 2A | Enroll snapshot (P16), reconstruct, fail-safe |
| `scripts/test-voice-v2-call-context-2a.ts` (new) | 2A | P18 acceptance gate |
| `src/lib/voice-v2/intake/types.ts` | 2A | `stateVersion`, `bookingPreference`, capabilities |
| `src/lib/voice-v2/intake/session-store.ts` | 2A | L1 facade over store |
| `src/lib/voice-v2/intake/load-call-context.ts` | 2A | Read L1→L2→reconstruct |
| `src/lib/voice/inbound.ts` | 2B | Concurrent warmup; metrics |
| `src/lib/voice-v2/provider/token-readiness.ts` (new) | 2B | P3 inspect + single-flight refresh |
| `src/lib/voice-v2/intake/persist-deferred.ts` + worker | 3 | BACKGROUND_VOICE jobs |
| Telnyx V2 routes | 3 | Defer audit |
| `conversation-workflow.ts` | 4 | One node; fixed V2 tool set + runtime auth (P5) |
| `save-intake-fields.ts` | 3–4 | `askedFields`; version checks; no booking-mode-only saves |
| `runtime/hold-ladder.ts` | 5 | After transport doc |
| `scripts/test-voice-v2-caller-first-headless.ts` | 6 | P7, L2, versioning, queues |

---

## H. Frozen primitives and refactor boundaries

### H.1 `FROZEN_BOOKING_PRIMITIVES`

Unchanged — see `src/lib/voice-v2/baseline-lock.ts` (`VOICE_V2_FROZEN_PATHS`).

### H.2 `FROZEN_INTAKE_PRIMITIVES`

`validate-fields.ts`, `normalize-email.ts`, `compile-schema.ts`, `wizard-config.ts` — semantics frozen; **where** compile runs may move to call init.

### H.3 `ALLOWED_REFACTOR_BOUNDARIES`

| Allowed | Not allowed |
|---------|-------------|
| L1+L2 session, versioning, warmup, workflow collapse, defer audit | Changing FIND/BOOK Graph semantics |
| Capability-scoped Telnyx tool exposure | Semantic regex booking intent |
| Adapter routes, booking-gate reads L2 | Second scheduling LLM |
| P7 conversational booking entry; L2 reconcile on real actions | Process-local-only session; sync L2 solely to ack intent |

**Removed from allowed:** “Redis later” for session authority — **L2 is required for production.**

---

## I. Test plan (extended)

### I.1 Existing regression scripts — mandatory

Unchanged list from Phase 1.

### I.2 New invariants

| Metric | Assertion |
|--------|-----------|
| `BOOKING_MODE_ENTRY_TOOL_CALLS` | **0** for utterance-only “I need to book.” (P7) |
| `BOOKING_MODE_ENTRY_SYNC_L2_FOR_ACK` | **0** — no Redis solely to acknowledge intent |
| `KNOWN_FIELD_REASKS` | 0 with real `askedFields` (P8) |
| `TOKEN_REFRESH_DUPLICATION` | 0 under concurrent FIND/warmup (P3) |
| `STALE_VERSION_OVERWRITE` | 0 — Tuesday/Wednesday race (P2) |
| `L2_SESSION_SURVIVES_REPLICA` | headless: write on “replica A”, read on “replica B” (mock store) |
| `BLANK_STATE_ON_L2_MISS` | 0 for active call without reconstruct |
| `PSTN_INGRESS_TO_ANSWER_MS` / `ANSWER_TO_FIRST_GREETING_AUDIO_MS` | no regression vs baseline after 2B |
| `SECOND_CONVERSATIONAL_AGENT` | 0 after Phase 4 |
| Queue isolation | BACKGROUND backlog does not delay REALTIME job (P12) |
| Prior §21 metrics | DUPLICATE_BOOKINGS, BLOCKING_* writes, etc. |

### I.3 Cases A–J + booking-intent latency

Case A first turn: **no tool**; immediate ack. Case B/C: multi-field capture without re-ask. Scheduling preference retained (P9). F–I: frozen FIND/BOOK fixtures.

### I.4 Phase 2A gate (P18)

Run `scripts/test-voice-v2-call-context-2a.ts` (or equivalent) — all P18 rows PASS before 2B.

### I.5 PSTN certification (Phase 8)

Natural call per original script; trace shows no save on pure booking intent, no General→Live handoff, single Graph event.

---

## §15 Operation classification (updated)

| Operation | Target class |
|-----------|----------------|
| L2 Class A CAS | Before FIND/BOOK/gate — not Postgres per turn |
| L2 Class B mirror | RUN_CONCURRENTLY |
| Call init config compile | PRELOAD_AT_CALL_START (2B, concurrent) |
| Token refresh | RUN_CONCURRENTLY + **distributed** single-flight (P3) |
| `getValidAccessToken` at Graph | MUST_BLOCK at provider call (fallback) |
| Enter booking mode | **Conversational only** — no tool, no sync L2 for ack (P7) |
| Reconcile booking intent into L2 | Class A at first save/FIND/BOOK that needs it |
| save_intake | Only when capturable fields — MUST_BLOCK tool JSON only |
| audit / CRM / metadata | BACKGROUND_VOICE |
| FIND / BOOK executors | Frozen; MUST_BLOCK claims |

Default if unclear: **DEFER_AFTER_RESPONSE**.

---

## §24 Implementation checkpoint

| Phase | Status |
|-------|--------|
| 1 — Inventory | Done |
| 1 — Production amendments | Incorporated |
| Final clarifications (P7/L2, Class A/B, P16–P19) | **Incorporated — awaiting review** |
| **2A — L1/L2 + versioning + P18 tests** | **Implemented — not deployed** |
| 2B — Warmup + pickup metrics | Not started |
| 3 — Defer + queue isolation | Not started |
| 4 — One Amy + P7 | Not started |
| 5 — Transport-documented ack | Not started |
| 6 — Tests | Not started |
| 7 — Deploy | Not started |
| 8 — PSTN cert | Not started |

**STOP:** No Phase 2A code until plan is explicitly approved (especially **P7 two-layer state**, **P2b Class A/B**, **P18 gate**).

---

## Appendix: key file index

| Concern | Path |
|---------|------|
| Workflow graph | `src/lib/voice/telnyx/conversation-workflow.ts` |
| Inbound / answer | `src/lib/voice/inbound.ts` |
| Lazy CallContext (today) | `src/lib/voice-v2/intake/load-call-context.ts`, `session-store.ts` |
| **Reference L1/L2 pattern** | `src/lib/voice/realtime-session/store.ts` |
| Save orchestration | `src/lib/voice-v2/intake/save-intake-fields.ts` |
| Booking stages | `src/lib/voice-v2/booking-workflow.ts` |
| Job enqueue | `src/lib/messaging/enqueue-advance.ts`, `src/lib/jobs/bullmq.ts` |
| Frozen baseline | `src/lib/voice-v2/baseline-lock.ts` |
| Offer set durable store | `src/lib/voice-v2/offer-set-store.ts` |
