# Voice V3 PSTN — latest call audit (booking → callback pivot)

**Date (UTC):** 2026-09-24  
**Call room suffix:** `KydsC6xPmGur`  
**Sources:** Production DB (`VoiceCall`, `CallbackRequest`, `voice_appointments`), `metadata.voiceV3Forensics` / `metadata.voiceV3`, cert workspace inspection

---

## Call at a glance

| Field | Value |
|--------|--------|
| **Live session / `VoiceCall` id** | `lk_transovo-call-<caller_e164>_KydsC6xPmGur` (suffix **`KydsC6xPmGur`**) |
| **When (UTC)** | **~03:39** → **~03:42** (2026-09-24) |
| **Wall duration (DB)** | **~140 s (~2 min 20 s)** |
| **Dialed line** | **+15717491060** (cert / WS1) |
| **Workspace / agent** | `ws_1` / **After-Hours Voice Agent UI CERT TEST 2304** (`cmshz2lc25c622c4i58303501`) |
| **Realtime voice** | **gpt-live-1** |
| **Backend delegated tools** | **`gpt-5.6-sol`** (`VOICE_V3_ASTRA_MODEL` resolved **`default`** — Luna override not active on this container) |
| **DB status** | `COMPLETED` |
| **Outcome** | **`callback_requested`** — **not booked** |
| **`appointmentBooked`** | **false** |
| **`voice_appointments` for this call** | **0** |
| **`transferred`** | **false** |

**Context:** This call is the **latest cert-line PSTN session before/after the Luna booking test** (`jU5s6hKcGXo4`, ~03:08 UTC, `appointment_booked`). It reuses the **same booking-then-callback curveball** pattern as the earlier Sol call **`6sGJc9u42bAZ`** (~01:37 UTC).

---

## Story (caller intent vs runtime)

1. **Booking path started** — Caller described a **leaking toilet** (plumbing / service visit intent) and began **scheduling intake** (name and related fields collected via `update_intake`).

2. **Scheduling tools ran on the booking path:**
   - **`set_scheduling_preference`** — preference set for the visit window.
   - **`find_availability`** — **`available`** (slots returned; timing consistent with prior Sol cert calls on the order of **~0.7–1.4 s** Node-side on similar traces).
   - **`update_intake`** — multiple **`INTAKE_UPDATED`** rounds while the agent collected remaining booking fields.

3. **Early `book_appointment`** — **`not_ready`** / **`MISSING_REQUIRED_INFORMATION`** while intake was still incomplete. **Expected guardrail**, not a provider failure (same pattern as Luna/Sol successful bookings that book on a **second** attempt after intake catches up).

4. **Pivot to callback** — Caller **stopped pursuing the live book** and asked for a **callback** instead (human follow-up rather than confirming a slot on the call).

5. **`request_callback` succeeded** — Tool status **`callback_requested`**; persisted callback row (see below). Agent confirmed callback details verbally; call ended **without** a successful `book_appointment`.

**Verdict:** Runtime behavior matches the **designed** Voice V3 flow: booking tools through FIND + guarded BOOK, then **clean pivot** to **`request_callback`** when the caller changes mind. **No Microsoft calendar book** on this call.

---

## Tool timeline (high level)

Exact monotonic ms rows live in `VoiceCall.metadata.voiceV3Forensics.events` on production; ordering below is authoritative for **what ran**, not necessarily sub-second spacing.

| Phase | Tool | Result |
|--------|------|--------|
| Intake / preference | `update_intake` | OK — `INTAKE_UPDATED` |
| Intake / preference | `set_scheduling_preference` | OK — `SCHEDULING_PREFERENCE_SET` |
| Availability | `find_availability` | **`available`** |
| Guarded book | `book_appointment` | **`not_ready`** — missing required information |
| Intake (continued) | `update_intake` | OK |
| Callback pivot | **`request_callback`** | **`callback_requested`** |

**Not observed on success path for this call:** `book_appointment` → `confirmed`.

---

## Callback persistence (authoritative)

| Field | Value |
|--------|--------|
| **`callbackRequestId`** | **`cmueziy641q6f6f5528125n4s`** |
| **Reason (summary)** | **Leaking toilet** / plumbing service (aligned with intake topic) |
| **Source route** | `voice_v3_request_callback` (Voice V3 tool pipeline) |
| **Outcome on `VoiceCall`** | `callback_requested` |

Expect matching fields under `VoiceCall.metadata.voiceV3` (e.g. `callbackRequestId`, `callbackReason`) after the tool succeeded — same shape as documented in `docs/VOICE-V3-PSTN-CALL-FORENSICS-REPORT-CALLBACK-2026-09-21.md`.

---

## Comparison: same-night Sol calls on cert line

| | **01:37 UTC (`6sGJc9u42bAZ`)** | **03:39 UTC (`KydsC6xPmGur`) — this audit** | **03:08 UTC (`jU5s6hKcGXo4`) — Luna book** |
|--|--------------------------------|---------------------------------------------|------------------------------------------|
| **Backend** | `gpt-5.6-sol` | `gpt-5.6-sol` | **`gpt-6-luna`** |
| **Duration** | ~149 s | **~140 s** | ~158 s |
| **Outcome** | `callback_requested` | `callback_requested` | `appointment_booked` |
| **Callback id** | `cmuev6arf5w0p3g1n4q0t696a` | **`cmueziy641q6f6f5528125n4s`** | — |
| **Appointments** | 0 | **0** | 1 (`cmueyf2f66r44194w0q074j46`) |

Both callback calls: **FIND succeeded**, **BOOK blocked on intake**, then **`request_callback`**. The Luna call completed intake and **second BOOK** succeeded.

---

## Canonical agent & routing

This call should have resolved the **canonical cert agent** (`cmshz2lc…`) on **+15717491060** after PR **#490** / `canonical-workspace-agent` routing (no stray “Danny” or parked wizard agent). If forensics show a different `voiceAgentId`, treat that as a **routing regression** and re-run workspace enforcement (`scripts/voice-v3-enforce-canonical-agent.ts` once the `server-only` container entry is fixed).

---

## Ops notes

- **Delegated model:** Forensics/bootstrap on this call show **`gpt-5.6-sol`** with env source **`default`**. To resume Luna tests, set **`VOICE_V3_ASTRA_MODEL=gpt-6-luna`** on the Coolify web app and **recreate** the container (see rollback section in `docs/VOICE-V3-LUNA-VS-SOL-VS-ASTRA-CALL-COMPARISON-2026-09-24.md`).
- **Redis / call history:** Upstash rate limiting has intermittently blocked `voice_v3_call_history` enqueue; **forensics on `VoiceCall` remain the audit source of truth** when history rows are missing.
- **Re-inspect in production:**

```bash
ssh coolify-server
CID=$(docker ps -q -f name=ds8s3hjin | head -1)
docker exec "$CID" npx tsx -e "
  const { getPrisma } = require('./src/lib/db');
  (async () => {
    const p = getPrisma();
    const call = await p.voiceCall.findFirst({
      where: { workspaceId: 'ws_1', metadata: { path: ['roomName'], string_contains: 'KydsC6xPmGur' } },
      orderBy: { startedAt: 'desc' },
    });
    console.log(JSON.stringify(call, null, 2));
    await p.\$disconnect();
  })();
"
```

---

## Related docs

- Luna vs Sol vs Astra comparison (same night): `docs/VOICE-V3-LUNA-VS-SOL-VS-ASTRA-CALL-COMPARISON-2026-09-24.md`
- Prior callback curveball (Sep 21): `docs/VOICE-V3-PSTN-CALL-FORENSICS-REPORT-CALLBACK-2026-09-21.md`
- Canonical inbound agent trace: `docs/CALL-HANDLING-V3-INBOUND-AGENT-RESOLUTION-TRACE.md`
