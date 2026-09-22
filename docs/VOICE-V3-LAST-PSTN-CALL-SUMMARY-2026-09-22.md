# Last PSTN call — executive summary (copy-paste)

**Generated (UTC):** 2026-09-22T15:37Z  
**Data sources:** Production Postgres (via web container on Coolify), voice worker logs (`tgjridm6vrmrgljkfrr0rpjn`), `scripts/generate-voice-v3-tool-chain-report.ts`  
**Full tool-chain report (445 lines):** [GitHub — raw file](https://raw.githubusercontent.com/703deuce/sms/master/docs/VOICE-V3-LAST-PSTN-CALL-FORENSICS-2026-09-22.md) · [browse in repo](https://github.com/703deuce/sms/blob/master/docs/VOICE-V3-LAST-PSTN-CALL-FORENSICS-2026-09-22.md)

---

## Did it work?

**Yes — successful Voice V3 after-hours booking call.**

| Field | Value |
|--------|--------|
| **Call ID** | `lk_transovo-call-_[REDACTED]_xFxRUnQsjD2c` |
| **Room suffix** | `xFxRUnQsjD2c` |
| **Direction** | INBOUND PSTN → LiveKit Voice V3 (GPT-Live / `gpt-5.6-sol`) |
| **Dialed (business)** | `+15717491060` |
| **Caller ANI** | `[REDACTED]` |
| **Workspace** | `ws_1` |
| **Agent** | `cmshz2lc25c622c4i58303501` (Riley — WS1 Cert Plumbing Co) |
| **Wall clock** | **2026-09-22T15:29:38.505Z** → **2026-09-22T15:32:16.917Z** (~**2 min 38 sec**) |
| **Status** | `COMPLETED` |
| **Outcome** | **`appointment_booked`** |
| **`appointmentBooked` flag** | **true** |
| **Internal appointment ID** | `cmucu0oe21n296e3v1s3g4y6m` (from execution trace) |
| **Disconnect** | Caller hung up (`CLIENT_INITIATED`) at **15:31:51Z** after booking confirmed in conversation |
| **LiveKit job** | `AJ_suQYAGZWxPKL` |

This call is **Voice AI receptionist / booking**, not Missed Call Text Back (MCTB) TeXML. The recent **marketing/legal homepage merge** (`5df97035`) does not touch voice runtime; voice worker image at call time was still **`ccfa2d3e`** (unchanged from before the homepage deploy).

---

## What happened (conversation)

- Caller reported a **slow toilet leak**, gave name **Anthony Johnson**, phone, address (**123 Main St, Alexandria, VA**), email (**anthony@yahoo.com**).
- Agent (**Riley**) collected intake, asked scheduling preference (**today / earliest**).
- **`find_availability`** returned a slot **today 11:30 AM**; caller accepted.
- First **`book_appointment`** attempt failed **`not_ready`** / **`MISSING_REQUIRED_INFORMATION`** (mother’s name required).
- Agent asked for **mother’s full name** → **Harriet Johnson** → second **`book_appointment`** → **`confirmed`**.
- Agent closed politely; caller said they were done.

---

## Latency & backend timing (high signal)

### Python → Node internal API (`commit_voice_v3_livekit_caller_utterance`)

Typical round-trips during the call: **~11–70 ms** (most under 30 ms; a few up to ~191 ms). All **HTTP 200**.

### Tool execution (Node backend, authoritative for calendar)

| Tool | Result | Node elapsed |
|------|--------|----------------|
| `update_intake` | INTAKE_UPDATED | **9 ms** (also **5 ms** on follow-up intake) |
| `set_scheduling_preference` | SCHEDULING_PREFERENCE_SET | **6 ms** |
| `find_availability` | available | **1033 ms** (~1.0 s Microsoft FIND) |
| `book_appointment` (1st) | not_ready | **4 ms** (missing mother’s name) |
| `book_appointment` (2nd) | **confirmed** | **1967 ms** (~2.0 s Microsoft BOOK) |

### Worker-reported tool durations (`FUNCTION_TOOL_*`)

| Tool | Duration | Status |
|------|----------|--------|
| `update_intake` | 23 ms | INTAKE_UPDATED |
| `set_scheduling_preference` | 20 ms | SCHEDULING_PREFERENCE_SET |
| `find_availability` | **1047 ms** | available |
| `book_appointment` (1st) | 15 ms | not_ready |
| `book_appointment` (2nd) | **1979 ms** | **confirmed** |

### Forensics flush at hangup

- `flush_voice_v3_forensics`: **~2590 ms** (post-disconnect persist).

**Assessment:** Calendar FIND/BOOK latencies are in the **~1–2 second** range (healthy vs known-good baseline). Utterance-commit paths stayed fast. One expected **guardrail retry** on book (mother’s name) before success.

---

## Tool order (actual)

1. `update_intake`  
2. `set_scheduling_preference`  
3. `find_availability` → available  
4. `book_appointment` → **not_ready** (missing required field)  
5. `update_intake` (mother’s name)  
6. `book_appointment` → **confirmed**

---

## Production containers at investigation time

| Service | Container (example) | Image commit |
|---------|---------------------|--------------|
| Web (`transovo.ai`) | `ds8s3hjin60qs6g7s0iqkixs-150048288708` | `5df97035` (post homepage/legal merge) |
| Voice worker | `tgjridm6vrmrgljkfrr0rpjn-015926077209` | `ccfa2d3e` |

---

## How to re-run forensics

On Coolify web container:

```bash
npx tsx scripts/inspect-last-voice-v3-call.ts
npx tsx scripts/generate-voice-v3-tool-chain-report.ts xFxRUnQsjD2c docs/VOICE-V3-LAST-PSTN-CALL-FORENSICS-2026-09-22.md
```

Voice worker logs (room suffix):

```bash
docker logs --since 45m <voice-container> 2>&1 | grep xFxRUnQsjD2c
```

---

## Note on full forensics doc

The auto-generated file `VOICE-V3-LAST-PSTN-CALL-FORENSICS-2026-09-22.md` includes a **stale “Microsoft book pipeline” table dated 2026-09-21** embedded by the report generator from an earlier template — **ignore that table**. Use the **2026-09-22** rows in the “Full tool chain” and “Per-tool latency” sections of that file, or this summary, for this call.
