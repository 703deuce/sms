# Voice V3 — Post-callback test matrix

Everything **new to test** after the baseline trio:

1. **Microsoft booking** (book + find/cancel/reschedule on frozen BOOK pipeline)
2. **Send-A-Link** booking mode
3. **Callback requests** (`request_callback` / `CallbackRequest`)

Production reference at time of writing: **`4950c526`** (web + voice deployed on Coolify).

Baseline flows are mostly **unchanged in engine**; several got **new transport** (LiveKit on +15717491060) and **new wizard/ops layers** on top.

---

## Deploy boundary (recent pushes)

| SHA | What shipped |
|-----|----------------|
| `1bbf3fad` | **Transfer runtime** — `transfer_call` → authorize on Node → DIRECT / WARM / waterfall in Python |
| `dfe1907f` | **Transfer wizard UI** — emergency & human transfer, multi-dest, waterfall plan |
| `94418c8f` / `18eedf55` | Web build fixes for transfer publish validation (no product change) |
| `24ecca9a` | **Amy native `end_call`** (LiveKit `EndCallTool`, not Astra) |
| `5f2ae375` | **After-hours ops (part 1)** — Messages & callbacks wizard, notifications UI, callback manifest fix, calls list tweak |
| `4950c526` | **After-hours ops (part 2)** — transfer → Node + owner notifications, booking/call-completed notify hooks, call detail + API callback link |

Earlier but still **after callback contract** and required for PSTN on 571: **LiveKit cutover** (`6be8c614` … `6b83dcfb`) — calls hit **GPT-Live + LiveKit worker**, not the old Telnyx-only assistant path for that DID.

---

## 1. Infrastructure / call path (test once, affects everything)

### New behavior

- Inbound **+15717491060** → LiveKit cloud agent (`transovo-voice-v3` profile).
- Voice worker: dual health **8081** (legacy) / **8083** (V3); Python executes transfers and `end_call`.
- Backend HTTP client stays open for the **whole call** (tool bridge reliability).

### How to test

- Place any call: answer, hear Amy, complete a short conversation — no immediate hangup / “no agent”.
- Coolify **transovo-voice** logs: `voice_v3_session_starting`, tool calls to `/api/internal/voice-runtime`.

**Not new product UI** — but if this fails, nothing below will work.

---

## 2. LiveKit intake (per-field tools)

### New behavior

- Amy/Astra can use **`collect_intake_field`** and **`set_intake_<field>`** on the LiveKit path (active collection in the worker), not only bulk `update_intake` on the Node side.

### How to test

- Wizard: custom collect fields still configured as before.
- PSTN: book or callback with a **custom question** — confirm the field shows on **Call detail → Information collected** and in callback payload if applicable.

---

## 3. Interruption policy

### New behavior

- Removed blanket **`disallow_interruptions`** on GPT-Live writes — callers can interrupt during tool work more naturally.

### How to test

- Mid-sentence, talk over Amy while she’s “working”; call should not feel stuck or one-way muted.

---

## 4. Human transfer (`transfer_call`) — major new surface

### New behavior

- **`transfer_call`** only on Astra; Node **authorizes** route/dest; Python runs:
  - **DIRECT** (SIP REFER),
  - **WARM** (`WarmTransferTask`),
  - **WATERFALL** (sequential targets).
- Outcomes: connected vs exhausted; Amy follows **transfer fallback** (return to agent, callback, etc.) from wizard.
- **`4950c526`:** Python reports **`transfer_connected` / `transfer_exhausted`** to Node → `voiceTransfer` row + call outcome + **owner notifications** (if configured).

### Wizard (new UI) — Appointment Receptionist → Call handling

- **Emergency & human transfer** (`EmergencyTransferEditor`):
  - Enable transfer
  - **Single vs waterfall**
  - Multiple destinations (name + E.164)
  - Per-step **Direct / Warm**, ring timeouts
  - **If nobody answers** fallback
- Requires **Transfer calls** capability on Goals.

### PSTN tests

| # | Scenario | Pass criteria |
|---|----------|----------------|
| T1 | **Direct** to a number that answers | Caller leaves Amy; connected party; call detail **Transferred**; optional **Successful emergency transfer** SMS if enabled |
| T2 | **Warm** to answering dest | Consult leg + bridge; same as above |
| T3 | **Waterfall** — first fails, second answers | Detail shows attempts; one connected notification |
| T4 | **Waterfall exhausted** | Amy returns per fallback; **Transfer failed** badge; **Failed emergency transfer** (+ **Emergency** if route id/label looks emergency) notifications |
| T5 | Invalid dest / not configured | Amy does not claim success; no fake “connected” |

**Logs:** `VOICE_V3_TRANSFER_*` in voice container; web: `record_voice_v3_transfer_outcome`.

**Still no new tool** — only `transfer_call`.

---

## 5. Native end call (Amy only)

### New behavior

- **`end_call`** is a **LiveKit native tool on Amy**, not in Astra `toolSchemas`.
- Policy: wrap-up → goodbye → end; **`delete_room=True`**; telemetry `VOICE_V3_END_CALL_*`.
- Successful **transfer** ending the call is **not** the same code path as Amy `end_call`.

### How to test

| # | Scenario | Pass criteria |
|---|----------|----------------|
| E1 | Normal close: “That’s all, thanks” | Polite close, line drops, room ends |
| E2 | After **booking** or **callback** complete | Same — no “stuck on the line” |
| E3 | Mid-booking | Amy should **not** end call just because booking is in progress |
| E4 | After **transfer connected** | Caller may disappear via carrier; don’t require Amy `end_call` |

**Logs:** `amyNativeTools: ["end_call"]` at session start.

---

## 6. Messages & callbacks (wizard + manifest) — productization, same engine

### New / fixed (not a second “take message” tool)

- Call handling section **“Messages & callbacks”**:
  - Toggle **Take messages and callback requests** → `callbackRequestsEnabled`
  - **What should Amy collect?** → `callbackRequiredCollectFieldIds` (standard + custom intake IDs)
- **Manifest fix:** `callbackRequiredCollectFieldIds` now **save → reload → publish → runtime** (cert matrix was failing before).
- Astra **`request_callback`** description explicitly includes **“leave a message”** / have someone call back.

### Browser tests

1. Enable messages/callbacks; pick Name, Phone, Service + one custom field; **Save → reload → Publish**.
2. Inspect published config: `callHandling.callbackRequiredCollectFieldIds` matches UI.
3. Confirm there is **no** `take_message` tool in published tool list.

### PSTN

- “I’d like to **leave a message** about my water heater” → still **`request_callback`**, collects only **missing** required fields → `CallbackRequest` in DB → owner notify if recipients configured.

---

## 7. After-hours notifications (new)

### New behavior

- Wizard block **After-hours notifications** (same Call handling step):
  - Per-event SMS/email toggles: messages/callbacks, emergency, failed/successful transfer, appointment booked, appointment changes, every completed call.
  - **Recipients** (label, SMS E.164, email, channel toggles).
- Runtime: deterministic dispatch after events — **not** an LLM tool.
- Idempotency: `voiceCall.metadata.voiceV3NotificationsSent` (no duplicate SMS on retries).

### Wired today (`4950c526`)

| Event | When it fires |
|--------|----------------|
| `callback.requested` | After `CallbackRequest` persisted |
| `transfer.connected` / `transfer.failed` | After Python reports transfer outcome |
| `emergency` | Same transfer hook if route id/label matches emergency/urgent/escalat heuristic |
| `appointment.booked` | After `markVoiceCallBooked` |
| `call.completed` | Post-call, **appointment-receptionist** agents only, if toggle on |

### Not fully wired (UI only)

- **`appointment.changed`** (reschedule/cancel notify) — treat as **off** until a later pass.

### Browser tests

- Configure recipients + toggles; save/reload/publish; invalid phone/email validation.
- Defaults: messages, emergency, failed transfer **on**; successful transfer, every call, appointment **off** unless you turned them on.

### PSTN / side effects

- Callback → SMS/email with short reason + **View call** link (`/voice/calls/:id`, auth required).
- Failed transfer → concise “tried X — no answer” style (not full transcript).
- **Notification failure must not undo** callback/booking/transfer truth.

---

## 8. Calls inbox & call detail (new UX)

### New behavior

- **`/voice/calls`**: demo/mock fallback **disabled** when API is empty; filters include **Messages**; badges include **Callback Requested**, **Transfer Failed**, **Emergency**.
- **`/voice/calls/[id]`**:
  - Outcome badges (no LiveKit room id in header)
  - **Callback requested** card when API finds `CallbackRequest` via `metadata.voiceV3.callId`
  - **Outcomes** list from real transfer/booking/message state
  - **Information collected** from structured message + insights (not raw JSON)
  - Transcript / recording when DB has them (no fake recording UI if none)

### How to test

- After each PSTN scenario below, open Calls list (mobile width too) → open detail → summary, outcomes, callback block, transcript.

---

## 9. What we did **not** add (don’t hunt for these)

- No `take_message`, `notify_owner`, `send_call_summary` tools.
- No Website / GBP knowledge, Calendly/Google Calendar in this wave.
- No new Microsoft **BOOK** pipeline (still frozen); find/cancel/reschedule unchanged from your earlier Microsoft pass.
- Send-A-Link **mode** unchanged except living on the same LiveKit stack.

---

## Suggested PSTN certification pack (A–D + extras)

Use **+15717491060** after wizard **Save + Publish** with notifications configured.

| Call | Script | Verify |
|------|--------|--------|
| **A – Message** | “Leave a message to call me about replacing my water heater.” | `request_callback`, required fields only, `CallbackRequest`, notification, Calls **Callback Requested**, detail callback card |
| **B – Transfer fail** | Emergency/waterfall to numbers that won’t answer | Exhausted fallback, **Transfer Failed**, failed (+ emergency) notifications once each |
| **C – Book** | Full Microsoft book (existing flow) | Still books; optional **Appointment bookings** email/SMS if enabled |
| **D – Info only** | Hours/FAQ, goodbye | No callback/booking/emergency notify; call still in list; optional **Every completed call** only if you enabled it |
| **+ End call** | Any non-transfer wrap-up | Clean hangup via Amy `end_call` |
| **+ Transfer success** | One answering dest | Transferred badge + optional connected notification |

---

## Wizard map (where to click)

**Appointment Receptionist wizard → Call handling**

1. **Emergency & human transfer** — transfer system
2. **Messages & callbacks** — toggle + required collect fields
3. **After-hours notifications** — events + recipients

**Publish** after each change; voice worker must match web for transfer reporting (same git SHA on app 2).

---

## Automated sanity checks (not PSTN)

```bash
npx tsx scripts/test-voice-v3-wizard-cert-matrix.ts
npx tsx scripts/test-voice-v3-after-hours-notifications.ts
npx tsx scripts/test-voice-v3-callback-wizard-roundtrip.ts
npm run test:voice-v3-transfer-system
npx tsx scripts/test-voice-v3-end-call-native.ts
cd voice-runtime-python && python3 -m pytest tests/test_voice_v3_end_call_tool.py -q
```

---

## Architecture reminders (for debugging)

- **Take a message** = **`request_callback`** only (one business operation).
- **Notifications** = policy after authoritative events; Amy/Astra do not send owner SMS.
- **Transfer truth** = Python executor + Node `record_voice_v3_transfer_outcome`; UI badges from `voiceCall.outcome` / transfers, not transcript LLM.
