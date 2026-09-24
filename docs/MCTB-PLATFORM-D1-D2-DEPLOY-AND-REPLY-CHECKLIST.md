# MCTB Platform D1/D2 — Deploy, Verification & Reply Checklist

**Date:** 2026-09-24 (UTC)  
**Merged PR:** [#500](https://github.com/703deuce/sms/pull/500)  
**Production SHA (merge commit):** `ecc93e71378bc87018db2088f07a6fa53b8cd992`

---

## Executive summary

Engineering pass completed: **D1** and **D2** fixed, tests added, scalable **Platform Sender Assignment** documented (not implemented). Do **not** treat shared-number routing as finished until assignment + pool ship; the 14-day resolver remains a **safety fallback** only.

---

## Results

| Item | Result |
|------|--------|
| **D1** | **PASS** — `latestConversationOutboundAt()` / `messages?.[0]`; no crash when nested messages are missing |
| **D2** | **PASS** — `resolvePersistedOutboundMessageFrom()`; `send-quick.ts` persists **senderRoute → explicit from** before workspace `preferredFrom` |
| **Tests** | `npx tsx scripts/test-mctb-message-from-persistence.ts` (+ `test-mctb-platform-sender.ts`, `test-mctb-platform-inbound-tenant-isolation.ts`) |
| **Assignment design** | **YES** — `docs/MCTB-PLATFORM-SENDER-ASSIGNMENT-DESIGN.md` (pool + sticky assignment; **not implemented**) |
| **Audit updated** | `docs/MCTB-PLATFORM-INBOUND-TENANT-AND-AI-AUDIT.md` |

---

## Status table (copy-friendly)

| Field | Value |
|-------|--------|
| **D1** | **PASS** |
| **D2** | **PASS** |
| **new production SHA** | **`ecc93e71378bc87018db2088f07a6fa53b8cd992`** (merged; confirm on `/api/health` after deploy) |
| **new PLATFORM Message.from verification** | **Pending** — requires one **new** outbound after deploy (historical row may still show +15714073615) |
| **resolver result** | **RESOLVED → ws_1** on existing test (unchanged until new send) |
| **assignment design complete** | **YES** |
| **safe to reply** | **NO** until deploy + **new** PLATFORM send proves `Message.from = +18885046264`, then **YES** for ws_1 controlled reply |

---

## What was fixed

### D1 — Platform inbound resolver crash

- **Issue:** `conv.messages[0]` could throw when `messages` was undefined.
- **Fix:** `latestConversationOutboundAt()` / optional chaining on nested `messages`.
- **File:** `src/lib/mctb/messaging/platform-inbound-tenant-resolution.ts`
- **Regression:** `scripts/test-mctb-message-from-persistence.ts`

### D2 — Wrong `Message.from` in database

- **Issue:** Twilio sent from **+18885046264** but DB stored **+15714073615** (workspace preferredFrom overwrote platform route).
- **Fix:** `resolvePersistedOutboundMessageFrom()` precedence:
  1. `poolFrom`
  2. `senderRoute.fromE164`
  3. `input.from`
  4. workspace `preferredFrom`
  5. registration fallback
- **Files:** `src/lib/sms/persisted-message-from.ts`, `src/lib/sms/send-quick.ts`
- **Regression:** same test script (PLATFORM vs WORKSPACE cases)

---

## Scalable routing (documented only)

Target flow:

```
senderMode = PLATFORM
        ↓
Platform Sender Assignment Resolver
        ↓
(customer workspace + consumer)
        ↓
assign/reuse one platform sender (sticky per thread)
        ↓
persist the assignment
        ↓
send

REPLY:
consumer + platform sender
        ↓
exact persisted assignment
        ↓
workspace + conversation
        ↓
AI Lead Recovery
        ↓
that workspace's Brain / booking / calendar
```

**Invariant:** `consumerE164 + platformPhoneNumberId` → at most **one** active customer workspace during reply routing.

**Today:** One approved platform sender **+18885046264**. No pool implementation. Same consumer + two businesses on one sender → **AMBIGUOUS** (fail-closed) until more senders + assignments exist.

**Full design:** `docs/MCTB-PLATFORM-SENDER-ASSIGNMENT-DESIGN.md`  
**Inbound/AI audit:** `docs/MCTB-PLATFORM-INBOUND-TENANT-AND-AI-AUDIT.md`

**Locked invariants (not changed this pass):**

- AI Lead Recovery **receives** `workspaceId`; it does **not** discover tenant.
- Booking/calendar use **resolved customer workspace**, never platform owner `PhoneNumber.workspaceId`.
- No AI, message-body guessing, or recency tie-break for tenant routing.
- Do not modify Voice V3 or Model B Twilio parent send path.

---

## After Coolify deploy — your checklist

1. Confirm health `commitSha` = **`ecc93e71378bc87018db2088f07a6fa53b8cd992`** (or newer containing PR #500).
2. Run **one new** forwarded PLATFORM missed-call + press-1 (old `Message.from` rows may still show 571).
3. Verify **new** row only:
   - Provider actual From = **+18885046264**
   - `Message.from` = **+18885046264**
   - `MissedCallEvent` / metadata `outboundSmsFromE164` = **+18885046264**
4. Run production audit:
   ```bash
   WORKSPACE_ID=ws_1 npx tsx scripts/audit-mctb-platform-inbound-production.ts
   ```
   Expected: **RESOLVED → ws_1**
5. Then reply on the handset to the 888 thread.

**Do not modify:** working platform TFN config, Twilio webhooks, or number placement.

---

## Local test commands

```bash
npx tsx scripts/test-mctb-message-from-persistence.ts
npx tsx scripts/test-mctb-platform-sender.ts
npx tsx scripts/test-mctb-platform-inbound-tenant-isolation.ts
```

---

## Explicit non-goals (this pass)

- No platform sender pool implementation
- No extra platform numbers purchased
- No UI change (customer still chooses **Transovo Platform Number** = `senderMode = PLATFORM`)
- No expansion of AI_BOOK / booking activation

---

## SAFE TO REPLY TO CURRENT 888 THREAD

| When | Answer |
|------|--------|
| Before deploy + new outbound with correct `Message.from` | **NO** |
| After deploy + new PLATFORM send verified + audit RESOLVED → ws_1 | **YES** (ws_1 controlled reply; multi-tenant isolation not proven on production alone) |
