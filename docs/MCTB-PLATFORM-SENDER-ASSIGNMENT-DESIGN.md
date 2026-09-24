# MCTB Platform Sender Assignment — Scalable Tenant Addressing Design

**Status:** Design (not implemented) — **2026-09-24**  
**Prerequisites:** `docs/MCTB-PLATFORM-INBOUND-TENANT-AND-AI-AUDIT.md`, Model B parent-Twilio PLATFORM send  
**Current production:** One approved platform sender `+18885046264` (`platform_mctb_sender`)

---

## 1. Problem statement

With `senderMode = PLATFORM`, many customer workspaces share the same physical SMS sender (today one TFN). Inbound replies arrive as:

```
FROM = consumer E.164
TO   = platform sender E.164
```

`TO` alone cannot identify which **customer workspace** owns the conversation. A time-bounded evidence resolver (14-day pairing window) can **fail closed** as `AMBIGUOUS` when the same consumer has recent PLATFORM activity with two businesses — correct safety, not a scalable primary identity system at ~10k customers.

---

## 2. Why one shared sender is ambiguous

For consumer **X** and platform sender **S**:

| Outbound | Meaning without assignment |
|----------|---------------------------|
| Plumber A → X from S | Workspace A |
| Electrician B → X from S | Workspace B |

Reply **X → S** has two valid workspaces → **addressing collision**. No deterministic tenant without extra state.

---

## 3. Assignment invariant (target)

For active reply routing:

```
(consumerE164, platformPhoneNumberId) → at most ONE customer workspaceId
```

Sticky per **conversation thread**: once workspace A establishes an active assignment on sender S for consumer X, subsequent PLATFORM outbound for that thread **reuses S** until the assignment ends (not a new random sender per message).

---

## 4. Proposed schema (follow Transovo conventions)

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

```
workspace W, consumer X, senderMode PLATFORM
  → find active assignment (W, X) → reuse platformPhoneNumberId
  → else enumerate eligible platform senders {S1..Sn}
  → exclude Si where ∃ active assignment (X, Si) for workspace ≠ W
  → pick eligible Si (capacity, provider, compliance — policy module)
  → insert assignment (W, X, Si), sticky for thread
  → send via Model B / route resolver (unchanged provider path)
  → persist Message.from = actual From (D2)
```

**Pool exhausted:** deterministic `POOL_EXHAUSTED` — do not steal Si from workspace A; do not overwrite active assignment. With **n=1** sender, second workspace for same consumer may be blocked until A’s assignment ends → until then, **legacy 14-day resolver** may still return `AMBIGUOUS` on reply.

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

## 8. Pool exhaustion

When no sender S is collision-free for (W, X):

- Outbound: fail with explicit error / queue / operator signal — **never** reassign S away from an active (A, X, S).
- Inbound: if only legacy resolver applies and 2+ workspaces → **AMBIGUOUS** (today’s behavior).

Document operator messaging: add platform sender to pool or wait for assignment release.

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

1. Ship D1/D2 + correct `Message.from` (this pass).
2. Handset cert on single sender + legacy resolver.
3. Add assignment table + outbound hook on PLATFORM send (reuse sender per thread).
4. Inbound: assignment lookup before legacy.
5. Backfill optional: recent MissedCallEvent + Conversation → assignments for active threads.
6. Add second platform sender when compliance allows; enable pool selection.

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
