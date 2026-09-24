# Voice V3 — Luna vs Sol vs Astra call comparison

**Generated (UTC):** 2026-09-24  
**Workspace:** `ws_1` · **Cert line:** `+15717491060` · **Agent:** After-Hours Voice Agent UI CERT TEST 2304 (`cmshz2lc25c622c4i58303501`)

**Purpose:** Copy-paste summary comparing tonight’s **GPT-6 Luna** booking test against the last **GPT-5.6 Sol** booking in DB and the last **GPT-6 Astra** booking that completed (Sep 19 forensics doc).

---

## Calls compared

| | **GPT-6 Luna (tonight)** | **GPT-5.6 Sol (booked)** | **GPT-6 Astra (booked)** |
|--|--------------------------|---------------------------|---------------------------|
| **When (UTC)** | 2026-09-24 03:08 → 03:10 | 2026-09-22 15:29 → 15:32 | 2026-09-19 ~07:49 → ~07:51 |
| **Line** | +15717491060 | +15717491060 | +15717491060 |
| **Call ID suffix** | `jU5s6hKcGXo4` | `xFxRUnQsjD2c` | `live_u7_…` (v3-basic; see Sep 19 doc) |
| **Wall duration** | **2 min 38 s** (158 s) | **2 min 38 s** (158 s) | **~1 min 36 s** (96 s) |
| **Outcome** | `appointment_booked` | `appointment_booked` | Booked (logs + Graph) |
| **Backend model (forensics)** | **`gpt-6-luna`** only | **`gpt-5.6-sol`** only | **`gpt-6-astra`** (archived forensics) |
| **Voice layer** | `gpt-live-1` | `gpt-live-1` | `gpt-live-1` |

### Astra note (data availability)

In the last ~300 `voiceCall` rows in production Postgres (all workspaces), **zero** rows contain `gpt-6-astra` in metadata. After the Sol era, forensics consistently tag `backend_model` on LiveKit bootstrap. The **Sep 19 Astra** proof is from archived forensics (`docs/VOICE-V3-PSTN-CALL-FORENSICS-2026-09-19-live_u7.md`); that call did not have a durable `voiceCall` / `voice_appointments` row at the time of the write-up, but booking and tools were verified in container logs and Microsoft Graph.

**Related Sol doc (Sep 22 booking):** `docs/VOICE-V3-LAST-PSTN-CALL-SUMMARY-2026-09-22.md`

---

## Luna call tonight — executive summary

| Field | Value |
|--------|--------|
| **Status** | `COMPLETED` |
| **Outcome** | `appointment_booked` |
| **`appointmentBooked`** | `true` |
| **Started** | 2026-09-24T03:08:17.879Z |
| **Ended** | 2026-09-24T03:10:55.744Z |
| **Duration** | **158 s (~2 min 38 s)** |
| **Delegated backend** | **`gpt-6-luna`** (no `gpt-5.6-sol` in forensics) |
| **Transovo appointment** | `cmueyf2f66r44194w0q074j46` |
| **Appointment status** | `confirmed` |
| **Service** | Service Visit |
| **Slot** | Thu 2026-09-24, **9:00–10:00 AM** `America/New_York` |
| **Customer (intake)** | Anthony Johnson |
| **Microsoft Graph** | Real `externalId` (`microsoft:…`) |
| **Book confirmed at** | ~2026-09-24T03:10:16Z |

### Luna tool timeline (authoritative forensics)

| Tool | Result |
|------|--------|
| `set_scheduling_preference` | OK — `SCHEDULING_PREFERENCE_SET` |
| `find_availability` | OK — `available` (~672 ms) |
| `book_appointment` (1st) | **Expected failure** — `not_ready` / `MISSING_REQUIRED_INFORMATION` |
| `update_intake` | OK — multiple rounds (`INTAKE_UPDATED`) |
| `book_appointment` (2nd) | OK — **`confirmed`** (~1,854 ms) |

---

## Did the booking really happen? (Luna vs Sol)

| Check | **Luna (tonight)** | **Sol (Sep 22)** |
|--------|-------------------|------------------|
| `appointmentBooked` | `true` | `true` |
| `voice_appointments` | `confirmed`, Microsoft `externalId` | `confirmed`, Microsoft `externalId` |
| **Appointment id** | `cmueyf2f66r44194w0q074j46` | `cmucu0oe21n296e3v1s3g4y6m` (from execution trace) |
| **Book tool (success)** | `confirmed` ~**1.85 s** | `confirmed` ~**1.97 s** |
| **Early book guardrail** | 1× `not_ready` (missing intake) | 1× `not_ready` (mother’s name required) |

Both paths: real **Microsoft Calendar** write, not voice-only confirmation.

---

## Tool performance

| Tool | **Luna** | **Sol (book)** | **Astra (Sep 19)** |
|------|----------|----------------|---------------------|
| `set_scheduling_preference` | OK (~11 ms) | OK (~6 ms) | OK (~13 ms) |
| `find_availability` | OK **~672 ms** | OK **~1,033 ms** | OK **~2,099 ms** |
| `update_intake` | **5** successful rounds (duplicate node/python telemetry can show 10 `COMPLETED` events) | **4** rounds | **5** rounds → `INTAKE_OBJECTIVE_COMPLETED` |
| `book_appointment` failures | 1× `not_ready` (too early) | 1× `not_ready` (mother’s name) | **0** (single book after intake complete) |
| `book_appointment` success | **~1,854 ms** | **~1,967 ms** | **~2,501 ms** |

**FIND:** Luna was fastest in this sample (~0.7 s vs ~1.0 s Sol vs ~2.1 s Astra). Calendar and slot context vary per call.

**BOOK:** All three in the **~1.8–2.5 s** band — consistent with healthy Microsoft BOOK.

---

## Delegated backend usage (session forensics)

| | **Luna** | **Sol (book)** | **Astra (Sep 19 doc)** |
|--|----------|----------------|-------------------------|
| **Backend input tokens** (peak usage snapshot) | ~**215,000** | ~**126,000** | Not in same DB shape; **8 delegations**, median Astra turn ~**1,503 ms** |
| **Backend output tokens** | ~**543** | ~**356** | — |
| **Live audio session (reported)** | ~132 s | ~132 s | ~96 s total call |

Luna showed higher delegated input tokens on this call, aligned with more intake turns before book (not necessarily “Luna is heavier” by default).

---

## Sol callback call (same day, pre-Luna) — context only

| Field | Value |
|--------|--------|
| **Call suffix** | `6sGJc9u42bAZ` |
| **When** | 2026-09-24 ~01:37–01:40 UTC |
| **Duration** | **~149 s (~2 min 29 s)** |
| **Backend** | `gpt-5.6-sol` |
| **Outcome** | `callback_requested` (no book) |
| **Callback id** | `cmuev6arf5w0p3g1n4q0t696a` |
| **Tools** | `set_scheduling_preference`, `find_availability` (~1.4 s), `update_intake`, `request_callback` (needs_info then success) |

---

## Astra reference call (2026-09-19) — from forensics doc

Source: `docs/VOICE-V3-PSTN-CALL-FORENSICS-2026-09-19-live_u7.md`

| Field | Value |
|--------|--------|
| **Stack** | `gpt-live-1` + **`gpt-6-astra`** |
| **Duration** | ~96 s |
| **Booking** | Real — `book_appointment` → `confirmed`, Graph event created |
| **Tool runs** | 8/8 succeeded (0 failed) |
| **find_availability** | ~2,099 ms |
| **book_appointment** | ~2,501 ms |
| **Median Astra turn latency** | ~1,503 ms (per doc) |

---

## Takeaways

1. **Luna test succeeded** end-to-end: guardrailed early book → intake → **confirmed** book + **Microsoft** id — same class of success as the Sep 22 Sol booking.
2. **Tonight’s booking call used Luna only** — bootstrap `backend_model: gpt-6-luna`, delegation metrics show `gpt-6-luna`; **no `gpt-5.6-sol`** on that call.
3. **Vs last Sol booking:** Same **~2:38** wall time, similar BOOK latency; Luna **faster FIND** on this pair; **more intake turns** (higher token usage).
4. **Vs last Astra booking (Sep 19):** Shorter wall clock in that trace, slower FIND/BOOK in that one sample, cleaner path (no failed book attempt). Astra comparison is from **forensics doc**, not current `voiceCall` metadata.

---

## Rollback: Sol after Luna test

Production override (Coolify web app):

```bash
# Use Sol again (or remove the line to use code default)
VOICE_V3_ASTRA_MODEL=gpt-5.6-sol
```

Code default when env unset: `gpt-5.6-sol` (`VOICE_V3_ASTRA_MODEL_DEFAULT` in `src/lib/voice-v3/intake/delegation-config.ts`).

Luna test value used:

```bash
VOICE_V3_ASTRA_MODEL=gpt-6-luna
```

After changing env, recreate the web container (Coolify redeploy or `docker compose up -d --force-recreate` in the app directory).

---

## API reference (model switch only)

- Live voice stays **`gpt-live-1`**.
- Delegated backend: **`delegation.responses.model`** / LiveKit `responses_options.model` ← `VOICE_V3_ASTRA_MODEL`.
- OpenAI: [Live delegation guide](https://developers.openai.com/api/docs/guides/live-delegation), [GPT-6 Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna).
- SDK-valid backend examples include `gpt-6-luna`, `gpt-5.6-luna`, `gpt-5.6-sol`, `gpt-6-astra` (`openai` package `ChatModel` / Responses types).
