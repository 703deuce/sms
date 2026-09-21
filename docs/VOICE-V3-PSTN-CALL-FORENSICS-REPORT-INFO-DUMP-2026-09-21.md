# Voice V3 PSTN — “info dump upfront” call forensics

**Date (UTC):** 2026-09-21  
**Test intent:** Caller gave **all** booking details **before** being asked (name, phone, address, email, mother’s name) to see whether Amy would still prompt for fields and whether **booking** would succeed.

**Room suffix:** `vcrbyQoJ7aLi`

---

## How this report was collected (SSH + DB)

### SSH — Coolify host `coolify-server` (`128.140.102.51`)

| Role | Container | Image / notes |
|------|-----------|-------------|
| **Voice worker** | `tgjridm6vrmrgljkfrr0rpjn-113845871330` | `56bda9063dcef0c6eb6fda0246fa2bf2ca16f579` |
| **Web (Next.js)** | `ds8s3hjin60qs6g7s0iqkixs-124253672189` | Auto-deployed web app |

**Voice worker (example):**

```bash
ssh coolify-server 'docker logs --since 45m tgjridm6vrmrgljkfrr0rpjn-113845871330 2>&1 | grep vcrbyQoJ7aLi'
```

**Web app (example):**

```bash
ssh coolify-server 'docker logs --since 45m ds8s3hjin60qs6g7s0iqkixs-124253672189 2>&1 | grep -E "vcrbyQoJ7aLi|book_appointment|find_availability|confirmed|microsoft"'
```

Observed on voice worker: LiveKit job `AJ_ww2YDEac8PWh`, `voice_v3_session_starting`, multiple `execute_voice_v3_livekit_tool` HTTP 200s, `VOICE_V3_CALLER_DISCONNECTED` at **13:06:38 UTC**. No `NameError` / forensics tool failures.

Observed on web: `VOICE_TOOL_EXECUTION_SUCCEEDED` for **`find_availability`** and **`book_appointment`** with **`status: 'confirmed'`**, **`provider: 'microsoft'`**.

### Database (production `DATABASE_URL`)

- `scripts/inspect-last-voice-v3-call.ts`
- `VoiceCall` + `metadata.voiceV3Forensics` tool events
- `voice_appointments` by `callId` and by time window
- `CallbackRequest` — **not** used on this call

---

## Call at a glance

| Field | Value |
|--------|--------|
| **`VoiceCall` id** | `lk_transovo-call-<caller_e164>_vcrbyQoJ7aLi` |
| **LiveKit job** | `AJ_ww2YDEac8PWh` |
| **Started (UTC)** | **13:03:49.479** |
| **Ended (UTC)** | **13:07:03.994** |
| **Duration** | **~194.5 s (~3 min 15 s)** |
| **Disconnect (worker)** | **13:06:38.152** |
| **Line** | **+15717491060** |
| **Agent** | `cmshz2lc25c622c4i58303501` / `ws_1` |
| **Realtime** | **gpt-live-1**, voice **vesper** |
| **Backend tools** | **gpt-5.6-sol** |
| **GPT-Live session** | `live_u1_EQXyQp3oNLUlkOZ40P012CFGt7hb74Qr` |
| **Status** | `COMPLETED` |

---

## What you said (info-dump test)

Early in the call (multiple utterances, **before** scheduling Q&A), you provided roughly:

| Field | What you said |
|--------|----------------|
| Issue | Plumbing / **toilet leak**, need appointment |
| Name | **Anthony Johnson** |
| Phone | **571-477-6175** (spoken as five seven one…) |
| Address | **123 Main Street, Alexandria, Virginia** |
| Email | **Anthony at yahoo dot com** |
| Security / mom | **Harriet** |

Transcript also shows Amy’s greeting **after** some of your speech (normal overlap/barge-in ordering).

---

## Did Amy still ask for information?

**Yes — partially.** She did **not** skip straight to calendar after the dump.

1. After you shared the block of details, she said something like: *“Thank you for sharing all that… just a second while I check for you.”*
2. She then still asked: **“What day and time would work best for the service visit?”**
3. You said **today, soonest possible** → she ran availability → offered **11:00** → you said **yes** → she said she was **booking** → closed with **“You’re all set for today at 11 a.m.”**

So the **conversational** flow still has a **scheduling preference** step even when many fields were spoken upfront. Intake may have been updated via tools, but the **script did not treat “I already told you everything” as complete for booking without day/time confirmation.**

---

## Tools / booking — was it successful?

### Runtime tool chain (forensics monotonic ms)

| ~ms from call start | Tool | Result | Latency |
|---------------------|------|--------|---------|
| **51,540** | `update_intake` | **INTAKE_UPDATED** | ~13 ms (Node) |
| **103,960** | `set_scheduling_preference` | **SCHEDULING_PREFERENCE_SET** | ~6 ms |
| **119,750** | `find_availability` | **available** | **~1,468 ms** |
| **151,209** | **`book_appointment`** | **`confirmed`** | **~1,638 ms** (Node); ~1,785 ms worker |

Function call id for successful book: **`call_1q45tRWbe1qQ05ohBrPrgqXW`**.

### Web / Microsoft

- `find_availability` → **`VOICE_TOOL_EXECUTION_SUCCEEDED`**
- `book_appointment` → **`VOICE_TOOL_EXECUTION_SUCCEEDED`**, **`status: 'confirmed'`**, **`provider: 'microsoft'`**

### Verdict for “did booking work?”

| Layer | Result |
|--------|--------|
| **Tool / provider** | **Yes** — `book_appointment` returned **`confirmed`** (Microsoft). |
| **What Amy said** | **Yes** — confirmed **11 a.m. today**. |
| **`VoiceCall.appointmentBooked`** | **`false`** (flag not set) |
| **`voice_appointments` row for this `callId`** | **None** (0 rows) |

Same persistence gap as the earlier successful-book PSTN call: **runtime booking succeeded; DB appointment flags/rows on the call are not updated.**

**Practical verification:** Check Microsoft 365 for **Anthony Johnson**, **today 11:00**, **anthony@yahoo.com**, **123 Main St Alexandria VA**, created around **~13:06 UTC**.

---

## Caller turns (worker)

**13** committed caller utterances (`voice_v3_caller_utterance_committed`).

Notable sequence:

1. Hello  
2. Long dump (leak + book + Anthony…)  
3–8. Continuation (Johnson, phone, address, email, Harriet)  
9–11. “Um… today the soonest possible”  
12. “Yes” (to 11 a.m.)  
13. “No, that’s it”  

---

## Comparison to your test goal

| Goal | Outcome |
|------|---------|
| Give all info before being asked | **Done verbally** in first ~30–45 s of caller speech |
| Avoid redundant questions | **Not fully** — Amy still asked **day/time** explicitly |
| Successful book | **Tool-level yes** (`confirmed`); **call flag / voice_appointments no** |

---

## Related calls (same day)

| Suffix | Scenario | Book? |
|--------|----------|-------|
| `YUoMbNMpscEF` | Normal book flow | `book_appointment` **confirmed** |
| `a32W4yyajhZc` | Callback curveball | **No book**; `request_callback` |
| **`vcrbyQoJ7aLi`** | **Info dump upfront** | **`book_appointment` confirmed** |

Earlier reports:

- `docs/VOICE-V3-PSTN-CALL-FORENSICS-REPORT-2026-09-21.md`
- `docs/VOICE-V3-PSTN-CALL-FORENSICS-REPORT-CALLBACK-2026-09-21.md`

---

## Short checklist

| Question | Answer |
|----------|--------|
| Info dump upfront? | **Yes** (name, phone, address, yahoo email, mom) |
| Still asked for scheduling? | **Yes** (day/time) |
| Find calendar? | **Yes** (~1.5 s) |
| Book successful at runtime? | **Yes** — **`confirmed`** / Microsoft |
| `appointmentBooked` on call? | **No** |
| Call length | **~194 s** |

---

*Generated 2026-09-21 from SSH logs (voice + web containers) and production DB forensics.*
