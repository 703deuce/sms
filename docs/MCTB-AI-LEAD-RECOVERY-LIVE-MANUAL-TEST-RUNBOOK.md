# AI Lead Recovery — Live manual test runbook (5 tests)

Synthetic certification (E2E recording adapters, adversarial, stress V2) proves **logic**. This runbook proves the **production chain**: real inbound SMS → DeepSeek semantics → policy/runtime → **real** calendar/provider → persisted state → truthful outbound SMS.

**Run one test at a time.** Finish checklist + calendar inspection before starting the next test.

**Out of scope for this pass:** Text-to-Pay (separate workflow).

---

## Preconditions

| Item | Requirement |
|------|-------------|
| Environment | Staging or production workspace you control (not `LR_CERT_E2E=1`) |
| MCTB | Missed-call text-back enabled; forwarding/live number works |
| Lead Recovery | Enabled in workspace MCTB config with **AI_BOOK** (or your live booking mode) |
| Provider | Microsoft and/or Calendly **connected** — not `HEADLESS_PROVIDER_MODE=recording` |
| Model | Production semantic path (DeepSeek `deepseek-chat` per workspace routing — no cert fallback) |
| Phone | Your mobile as the “customer”; business line receives missed call → opener SMS |
| Clean slate | Prefer a fresh missed-call thread per test (or note `conversationId` before you start) |

**Do not** set `LR_CERT_FORCE_DEEPSEEK`, `LR_CERT_DISABLE_FALLBACK`, or `LR_CERT_E2E` on the server handling live SMS unless you intentionally mirror cert.

---

## After each test — inspect (copy/paste checklist)

```bash
WORKSPACE_ID=<ws> CUSTOMER_PHONE=+1... npx tsx scripts/mctb-lead-recovery-live-inspect.ts
# or
WORKSPACE_ID=<ws> CONVERSATION_ID=<id> npx tsx scripts/mctb-lead-recovery-live-inspect.ts
```

Open the conversation in **MCTB → Conversations** and the appointment in **Microsoft / Calendly** (provider UI).

### LIVE MCTB TEST CHECKLIST

| Check | PASS/FAIL |
|-------|-----------|
| Inbound customer SMS received | |
| Full conversation context loaded | |
| DeepSeek intent correct | |
| Correct workflow/state | |
| No duplicate questions | |
| Actual provider availability used | |
| No invented slot | |
| Correct customer fields persisted | |
| Correct slot selected | |
| Provider booking actually created | |
| Exactly one booking created | |
| Calendar/provider data correct | |
| BOOKING_CONFIRMED persisted | |
| Final SMS truthful | |
| SMS concise / segment count | _____ |
| Errors in logs | _____ (target 0) |

**Log patterns to watch** (server logs / observability):

- `[mctb-ai-booking]` — `scheduler_action`, `availability_query_started`, `slots_offered`, booking create
- Lead recovery intent/policy/runtime (no keyword classifier authority)
- Provider errors (Microsoft Graph, Calendly API)
- Duplicate `create_booking` or stale `pendingAction` / `stateVersion` warnings

---

## Test 1 — Basic booking from scratch

**Goal:** End-to-end book from missed-call opener through slot pick and confirm.

1. Trigger missed call → receive MCTB opener on your phone.
2. Reply: *“I need someone to come look at my water heater.”*
3. Answer collect prompts naturally; ask for **tomorrow afternoon**.
4. Pick **one offered slot** and confirm when asked.

**Verify**

- One appointment in connected calendar (correct local date/time).
- Customer name / phone / reason (or service) match what you sent.
- `BOOKING_CONFIRMED` in conversation booking activity (inspect script).
- LR state: phase complete or idle; no dangling `pendingAction` for stale slot.
- Final SMS describes the same slot as the calendar.

**Fail if:** double booking, wrong timezone, invented time not in provider, or SMS promises a slot that is not on the calendar.

---

## Test 2 — Availability first, then booking

**Goal:** `CHECK_AVAILABILITY` / read path before any write.

1. New thread (new missed call or new conversation).
2. First message: *“Do you have anything tomorrow after 2?”*
3. Expect availability check **without** creating an appointment yet.
4. Reply: *“3 works”* or *“the second one.”*

**Verify**

- Ledger/provider: `find_slots` (or equivalent) before a single `create_booking`.
- Exactly **one** create after selection.
- Revalidation: slot still available at book time (or honest “no longer available” SMS).

**Fail if:** first message creates a booking, or two appointments exist.

---

## Test 3 — Collect information across several texts

**Goal:** Multi-turn field memory.

1. *“My furnace isn’t working.”*
2. Name in one SMS: *“Anthony”*
3. Address in another: *“123 Main St”*
4. Timing: *“Tomorrow morning.”*

**Verify**

- Bot does **not** re-ask for name/address already given.
- `collectedFields` / automation captured fields match (inspect script).
- Booking (if created) carries fields your policy maps to provider/customer record.

---

## Test 4 — Change your mind before booking

**Goal:** Stale action / version protection live.

1. Start booking; receive slot offers.
2. *“3 works”* then quickly *“Actually make it 4:30 instead.”*  
   **Or** change address before final confirm.

**Verify**

- Only the **final** slot/time exists in provider (no 3 PM ghost).
- State `pendingAction` epoch / session `selectedSlot` match latest choice.
- At most one confirmed booking.

---

## Test 5 — Context switch and resume

**Goal:** Offered slots survive an FAQ detour.

1. Start booking until **slots are offered**.
2. *“Before I book, what’s the service fee?”*
3. After answer: *“Okay, the second one works.”*

**Verify**

- No restart (“what day do you want?”) unless slots truly expired.
- Same offered set (or explicit refresh) → one calendar write.
- `offered_slots` in session/state consistent with SMS “second one.”

---

## Recording results

For each test, save:

- `conversationId`, `missedCallEventId` (if any), provider booking id
- Checklist table (PASS/FAIL per row)
- Screenshot or provider URL of calendar event
- Any log excerpt for failures only

When all five pass, you have evidence the **customer-facing path** matches cert semantics.

---

## Related

- Synthetic E2E: `docs/MCTB-AI-LEAD-RECOVERY-E2E-CERTIFICATION.md`
- Onboarding live test (missed call → opener only): `src/lib/mctb/onboarding/live-test.ts`
- Inspect script: `scripts/mctb-lead-recovery-live-inspect.ts`
