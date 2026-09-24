# MCTB Platform Sender — Active Conversation Ownership (Operational Model)

**Status:** Approved direction — **2026-09-24**  
**Companion:** `docs/MCTB-PLATFORM-SENDER-ASSIGNMENT-DESIGN.md` (engineering schema)  
**Current sender:** `+18885046264` (single verified platform TFN)

---

## SMS hard limit (cannot code around)

An ordinary inbound SMS exposes only:

| Field | Example |
|-------|---------|
| From | Consumer E.164 |
| To | Our receiving number (e.g. 888) |
| Body | Message text |

There is **no** hidden workspace ID, conversation ID, or tenant token on the wire.

Twilio routes SMS conversations by the **To/From number pair**. Only **one active conversation** can own a given pair at a time (same mental model as Twilio Conversations / Proxy: participant + proxy address cannot be ambiguous while both sessions are live).

**Implication:** Our routing choices are narrower than “pick any business that texted this person recently.”

---

## Better approach for Transovo (now): one 888 + active ownership

**Do not** assume we need a second platform number merely because the same homeowner contacted two Transovo businesses within 14 days.

**Do** define who **currently owns** `(consumer + platform sender)` for an **active** MCTB recovery thread.

### Sequential reuse (common case — works with one 888)

```
Monday — Caller → Plumber A
         888 texts caller
         Plumber A owns: (caller + 888)  [ACTIVE]

         Conversation finishes / expires
         → RELEASE (caller + 888)

Wednesday — Caller → Electrician B
            888 texts caller
            Electrician B owns: (caller + 888)  [ACTIVE]

Consumer replies to 888
            → routes to Electrician B (current active owner)
```

Monday plumber vs Wednesday electrician **does not** require another number if the plumber thread is **no longer active**.

### Durable record (target)

```
consumerE164 + platformPhoneNumberId (888)
        ↓
CURRENT ACTIVE OWNER
        ↓
customer workspaceId (e.g. Electrician)
        ↓
conversationId / thread reference
```

Inbound lookup: **exactly one** active row for `(consumer, 888)` → deterministic tenant → AI Lead Recovery → **that** workspace’s Brain / booking / calendar.

**Sticky sender:** Same thread keeps using 888; do not rotate platform numbers per outbound message (one SMS thread on the handset).

---

## What we are NOT optimizing for

| Old mental model | Better model |
|------------------|--------------|
| “Any business that texted this consumer in the last 14 days” | **Active** conversation owner for `(consumer + 888)` |
| Large TFN pool as default scale strategy | **One 888** + ownership lifecycle; pool only for rare concurrent collision |
| 14-day resolver as permanent identity | 14-day evidence resolver = **migration / safety fallback** only |

The existing 14-day `AMBIGUOUS` when two workspaces show recent evidence is **correct fail-closed** until assignment exists; it should **not** be the long-term definition of “collision.”

---

## Genuinely impossible case (physics + SMS)

No database design removes this:

| Time | Event |
|------|--------|
| 10:00 | Caller contacts **Plumber A** — active thread, expecting reply |
| 10:15 | Caller contacts **Electrician B** — active thread, expecting reply |
| Both | Outbound from **same 888** |
| Inbound | Consumer texts: *“Yes, come tomorrow.”* |

The SMS contains **no** signal for which business they mean.

Twilio Proxy addresses this by giving **different proxy numbers** when the same participant needs **concurrent** sessions; the same participant/proxy combination cannot be used concurrently because it would be ambiguous.

**Transovo options when two active owners need the same (consumer + 888) at once:**

1. **Fail closed** (`AMBIGUOUS` / hold / no AI auto-reply) — safe default  
2. **Second platform address** for the second active session only (expensive, compliance-heavy)  
3. **Business-specific re-entry** (link, keyword, short code) — product decision, not LLM guessing  

**Do not:** AI tenant routing, message-body guessing, or “newest outbound wins.”

At scale, optimize for **rare concurrent collision**, not provisioning another verified TFN per customer.

---

## Platform number pool — not the default plan

Before designing “thousands of businesses on shared 888,” reconcile **Twilio compliance** (published as of 2026):

- Toll-free numbers used for messaging require **verification**; additional justification often required above **five** TFNs per business.
- Rejection codes describe TFN messaging as generally **1:1 to a single business**, with **limited ISV exceptions** when the ISV controls opt-in and message content.

The current `+18885046264` was approved under Transovo’s **sender-of-record / ISV** structure — that approval may remain valid. **Before** scaling many customer workspaces on one TFN, explicitly reconcile that approval with Twilio’s current multi-business / ISV documentation (legal + compliance pass). This gate is **more important** than buying extra numbers for routing convenience.

**Engineering default:** single 888 + active ownership lifecycle.  
**Pool growth:** only when (a) concurrent active collision rate demands it **and** (b) compliance allows additional verified senders.

---

## Active vs released (product rules — to implement)

**Active** (owns the pair):

- Open MCTB recovery conversation with recent outbound/inbound per policy  
- Or explicit “awaiting reply” window after last PLATFORM send  
- Renew `lastUsedAt` on each message in thread  

**Released** (pair available for another workspace):

- Conversation closed / recovered / staff resolved  
- Opt-out / suppression  
- Idle timeout (product-defined; may align with but not equal “14-day evidence window”)  
- Handoff complete  

**Outbound when pair is owned by another workspace:**

- Do **not** steal ownership  
- With one 888: block or queue until release, or escalate to concurrent-collision handling (second address or fail closed)

---

## Inbound resolution order (target)

```
1. Active PlatformSenderAssignment (consumer + platformPhoneNumberId)
      → RESOLVED (one workspace)

2. Legacy 14-day evidence resolver
      → RESOLVED | AMBIGUOUS | UNMATCHED (fail-closed, no tie-break)

3. Never: LLM or body parsing for tenant
```

---

## AI / booking (unchanged invariants)

- AI Lead Recovery **receives** `workspaceId`; it does **not** discover tenant.  
- Booking/calendar use **resolved customer workspace**, never platform owner `PhoneNumber.workspaceId`.

---

## Summary table

| Question | Answer |
|----------|--------|
| Can one 888 serve many businesses? | **Yes**, over time, via **released** pairs |
| Must we add a number for plumber Monday + electrician Wednesday? | **No**, if Monday thread is **released** before Wednesday |
| When do we need another address? | **Concurrent** active conversations on same (consumer + 888) |
| Default scale strategy | **Active ownership**, not TFN pool |
| Blocker before massive shared-TFN scale | **Twilio TFN / ISV multi-business reconciliation** |

---

## Related engineering

- D1/D2 fixes + deploy checklist: `docs/MCTB-PLATFORM-D1-D2-DEPLOY-AND-REPLY-CHECKLIST.md`  
- Schema & algorithms: `docs/MCTB-PLATFORM-SENDER-ASSIGNMENT-DESIGN.md`  
- Inbound/AI audit: `docs/MCTB-PLATFORM-INBOUND-TENANT-AND-AI-AUDIT.md`
