# MCTB Platform Sender Assignment — Scalable Tenant Addressing Design

**Status:** **Implemented** — **2026-09-24** (active ownership model; single 888; no pool)  
**Operational model:** `docs/MCTB-PLATFORM-ACTIVE-CONVERSATION-OWNERSHIP.md`  
**Prerequisites:** `docs/MCTB-PLATFORM-INBOUND-TENANT-AND-AI-AUDIT.md`, Model B parent-Twilio PLATFORM send  
**Current production:** One approved platform sender `+18885046264` (`platform_mctb_sender`)

---

## 1. Problem statement

With `senderMode = PLATFORM`, many customer workspaces share the same physical SMS sender (today one TFN). Inbound SMS carries only **From**, **To**, and **body** — no workspace or conversation ID on the wire. Twilio-style routing uses the **To/From pair**; only one **active** session should own that pair at a time.

`TO` alone cannot identify which **customer workspace** owns the reply. The durable answer is **active conversation ownership**: `(consumerE164, platformPhoneNumberId) → current customer workspaceId` while the thread is active, then **release** when the conversation ends so the same pair can serve another business later.

The interim 14-day **evidence** resolver can **fail closed** as `AMBIGUOUS` when it sees recent activity with two workspaces. That is a **safety fallback**, not the product definition of collision (which is **two concurrent active owners**, not “two businesses texted this person within 14 days”).

---

## 2. When is routing ambiguous?

**Not ambiguous (one 888 is enough):** Plumber A texts Monday; thread **closes/expires**; Electrician B texts Wednesday → B becomes active owner of `(consumer, 888)`; reply routes to B.

**Ambiguous (cannot be solved in software alone):** At 10:00 Plumber A and at 10:15 Electrician B both have **active** threads expecting replies, both from the same **S**. Inbound *“Yes, come tomorrow”* has no tenant signal. Options: fail closed, second platform address for one session, or consumer re-entry via business-specific flow — **not** AI/body guessing.

| Situation | Need second number? |
|-----------|---------------------|
| Same consumer, two businesses, **sequential** active threads | No — release pair between threads |
| Same consumer, two businesses, **concurrent** active threads on same S | Yes **or** fail closed / re-entry |

---

## 3. Assignment invariant (target)

For **active** reply routing only:

```
(consumerE164, platformPhoneNumberId) → at most ONE customer workspaceId  [state = active]
```

When the conversation **finishes / expires / releases**, that pair may be assigned to another workspace for the same consumer.

Sticky per **conversation thread**: workspace A’s active assignment on S for consumer X **reuses S** for all messages in that thread until release (no per-message sender rotation).

**Rename mentally:** `PlatformSenderAssignment` = **active conversation ownership** of the SMS address pair, aligned with Twilio’s one-active-binding-per-pair constraint.

---

## 4. Schema (as-built — 2026-09-24)

See `docs/MCTB-PLATFORM-ACTIVE-CONVERSATION-OWNERSHIP-IMPLEMENTATION.md` for migration path, modules, and certification checklist.

**State enum:** `ACTIVE` | `RELEASED` (not separate `expired` row state — idle uses `RELEASED` + `releaseReason: IDLE_TIMEOUT`).

**Idle safety net:** 72h (`MCTB_PLATFORM_SENDER_ASSIGNMENT_IDLE_MS`), not the 14-day evidence window.

---

## 4a. Original proposed schema (reference)

**New table (name TBD — e.g. `MctbPlatformSenderAssignment`):**

| Field | Purpose |
|-------|---------|
| `id` | cuid |
| `workspaceId` | **Customer** workspace (not platform owner) |
| `consumerE164` | Normalized caller/recipient |
| `platformPhoneNumberId` | FK → `PhoneNumber` (`platform_mctb_sender` role) |
| `conversationId` | Optional canonical MCTB thread |
| `missedCallEventId` | Optional originating event |
| `state` | `active` \| `released` \| `expired` |
| `activeUntil` | Optional TTL / renewal |
| `createdAt`, `lastUsedAt` | Lifecycle |
| `releasedAt` | When thread closed or superseded |

**Unique constraint (active):** `(consumerE164, platformPhoneNumberId)` where `state = active` (partial unique index).

**Reuse existing models where possible:**

- `Conversation.phoneNumberId` already stores outbound sender id — align with assignment on create.
- `MissedCallEvent.metadata` outbound fields — audit trail, not primary lookup.
- Do **not** store assignment only in `Message.from` without the assignment row.

Platform **owner** workspace (`PhoneNumber.workspaceId` for the TFN row) remains **infrastructure only**.

---

## 5. Outbound allocation algorithm (future)

**Default path (single 888):**

```
workspace W, consumer X, senderMode PLATFORM
  → active assignment (W, X) on S? → reuse S, send
  → else ∃ active assignment (X, S) for workspace ≠ W?
        → CONCURRENT_PAIR_OWNED: block, queue, or collision policy (see §8)
  → else create active assignment (W, X, S), send
  → persist Message.from = actual From (D2)
```

**Optional second sender (exception, not default scale):**

Only when policy requires a **concurrent** second active thread for the same consumer and releasing/waiting is unacceptable:

```
  → enumerate eligible platform senders {S1..Sn}
  → exclude Si where ∃ active assignment (X, Si) for workspace ≠ W
  → pick eligible Si (compliance + capacity)
```

**Do not** plan a large TFN pool as the primary multi-tenant strategy without a **Twilio TFN / ISV multi-business** compliance reconciliation (see operational doc § compliance). Verification burden grows with TFN count; published rules emphasize 1:1 business mapping with limited ISV exceptions.

---

## 6. Inbound resolution (future preferred order)

```
Twilio/Telnyx inbound (FROM=X, TO=S)
  1. Resolve platform PhoneNumber for S
  2. Lookup active PlatformSenderAssignment (X, S)
       → exactly one → workspaceId + conversationId
  3. Else legacy loadPlatformMctbReplyContexts (14-day evidence)
       → RESOLVED | AMBIGUOUS | UNMATCHED (unchanged semantics)
  4. acceptMctbInboundSmsIngress(workspaceId from step 2 or 3)
```

No recency tie-break when step 3 sees 2+ workspaces.

---

## 7. Assignment lifetime

- **Created** on first successful PLATFORM outbound to consumer X on sender S for workspace W.
- **Renewed** (`lastUsedAt`) on each outbound/inbound on that triple.
- **Released** when: conversation resolved/closed, opt-out, explicit handoff end, or TTL expired (product-defined, likely ≥ reply window).
- **Sticky:** same thread keeps same S; do not rotate sender mid-thread.

---

## 8. Concurrent collision & pool exhaustion

**Concurrent active ownership (fundamental):** Two workspaces both need `(X, S)` active at once → inbound cannot disambiguate. Outbound for B should not steal A’s assignment.

| Policy | Behavior |
|--------|----------|
| Default (n=1) | Outbound for B blocked until A releases; or fail closed on ambiguous inbound |
| Exception | Allocate S2 from small verified pool **only** for concurrent case |
| Never | Overwrite A’s active assignment; LLM/body tenant pick |

**Pool exhausted** (no collision-free S for concurrent need): deterministic `POOL_EXHAUSTED` / operator signal — wait for release or fail closed.

**Sequential reuse:** With one S, plumber-then-electrician on different days is **not** pool exhaustion — release between threads.

---

## 9. Number / provider migration

- Assignments reference `platformPhoneNumberId`, not raw E.164 alone.
- Migration: mark old assignments `released`; new sends create assignments on new id; legacy resolver covers in-flight replies during dual-run window.
- Provider move (Twilio → Telnyx) is a **new** `PhoneNumber` row + role marker, not customer config change.

---

## 10. Legacy resolver fallback

Keep `loadPlatformMctbReplyContexts` + `resolvePlatformInboundReplyFromContexts` for:

- Pre-assignment historical threads
- Missing assignment row (bug, partial deploy)
- Single-sender collision safety
- Migration backfill validation

Assignment layer is **primary** when present; legacy is **secondary**, same fail-closed rules.

---

## 11. AI / booking tenant propagation (locked)

```
resolved workspaceId (assignment or legacy resolver)
  → acceptMctbInboundSmsIngress
  → handleMctbCustomerSmsReply(workspaceId)
  → handleMctbLeadRecoveryInboundSms(workspaceId)
  → loadMctbApprovedBusinessInformation(workspaceId)
  → booking link / calendar / AI_BOOK (if ever enabled)
```

**Never:** `platform PhoneNumber.workspaceId` → customer Brain or calendar.

AI Lead Recovery **receives** `workspaceId`; it does **not** discover tenant from `To` or LLM body classification.

---

## 12. Multi-tenant tests (required when pool ships)

Synthetic:

- `ws_platform` owns platform `PhoneNumber`
- `ws_customer_A`, `ws_customer_B` outbound to `consumer_X`
- With pool: different senders → inbound resolves A vs B
- With n=1: second assignment attempt → collision / POOL_EXHAUSTED / AMBIGUOUS on reply

Scripts today: `test-mctb-platform-inbound-tenant-isolation.ts` (resolver only).

---

## 13. Migration strategy

1. Ship D1/D2 + correct `Message.from` (done).
2. Handset cert on single sender + legacy resolver.
3. **Compliance:** Reconcile existing 888 approval with Twilio published TFN / ISV multi-business rules before massive shared-TFN scale.
4. Add **active ownership** table + outbound hook on PLATFORM send; define release rules (close, idle, opt-out).
5. Inbound: active assignment lookup **before** legacy 14-day evidence.
6. Backfill optional: only **still-active** threads → assignments.
7. Add second platform sender **only** if concurrent-collision rate + compliance justify it — not as default per-customer provisioning.

---

## 14. Non-goals (current implementation pass)

- No additional platform numbers purchased
- No fake multi-sender pool behavior
- No UI exposing literal TFN list
- No AI / message-body tenant routing
- No Voice V3 changes
- No expansion of `AI_BOOK` launch scope
- No replacing Model B Twilio parent send path

---

## UI contract (unchanged)

Customer selects **Transovo Platform Number** → `senderMode = PLATFORM`. Internal assignment chooses physical sender; customer never picks `888-A` vs `888-B`.
