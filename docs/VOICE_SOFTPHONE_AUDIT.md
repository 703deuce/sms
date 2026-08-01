# Transovo AI — Voice Agent + Softphone Feature Audit

**Generated:** 2026-08-01  
**Live site:** https://transovo.ai  
**Legend:** Full · Partial · Blocked (needs Telnyx number / live telephony) · Missing  

## Bottom line

**You are NOT “just waiting for a number.”**  
Config/UI for both products is largely built. Runtime gaps are being closed on `master` (see “Runtime fixes shipping now”).

| Product | If you buy a number today… |
|---------|----------------------------|
| **AI Voice** | Publish syncs model/voice/instructions (+ knowledge text into instructions). **Runtime now starts the Telnyx AI Assistant** on inbound answer and outbound answer, and starts recording. Mid-call Telnyx tool registration is still partial. |
| **Softphone** | Call Control dial/hold/hangup/blind-transfer/DTMF. **Mute + record now hit Telnyx.** **Call my phone → bridge** is implemented. Browser WebRTC still connects without placing media (use Call my phone until WebRTC `newCall` is finished). Queues are still CRUD-only (no ring runtime). |

### Runtime fixes shipping now
- AI: `ai_assistant_start` after inbound answer + on outbound `call.answered`
- AI: knowledge text injected into assistant instructions on publish
- AI: `record_start` on live AI legs
- Softphone: Telnyx mute/unmute + record start/stop
- Softphone: Call my phone bridge (agent cell → destination)

---

# PART A — AI Voice Agent

## A0. Your specific questions (LLM / TTS / files / role)

| Question | Status |
|----------|--------|
| Model (LLM) selection | **Partial** — free-text model ID saved; synced to Telnyx on publish. Default `meta-llama/llama-3.3-70b-instruct`. Not a curated picker. |
| Text-to-speech / voice | **Partial** — voice ID + speed saved; synced on publish. Default `Telnyx.NaturalHD.andromeda`. No preview. |
| Agent role / instructions / background from UI | **Partial** — system/role/goals/prohibited/raw prompt sync on publish. Conversation-flow “purpose” sections not fully synced. |
| Upload files so agent knows business info | **Missing at call time** — text/URL knowledge ingest + in-app search exist; **not injected into Telnyx assistant / no retrieval tool on the call**. PDF/DOCX/CSV upload missing. |
| Completely hooked until number arrives? | **No** — see blockers below. |

### Env needed for live AI Voice (once number exists)
`TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, `TELNYX_CONNECTION_ID`, `APP_URL`  
Webhook: `https://transovo.ai/api/telnyx/voice`  
Worker/queue recommended for webhook/post-call jobs.  
Optional: `OPENAI_API_KEY` (post-call insights), calendar OAuth.

### Critical blockers (even with a number)
1. Inbound answers the call but **never calls `ai_assistant_start`**.
2. Outbound dial enables AMD if assistant exists but **never starts the assistant**.
3. Tools/KB not registered on the Telnyx assistant for mid-call use.
4. Auto recording / live transcript ingest not started on the call path.

---

## A1. Agent creation & configuration

| Feature | Status |
|---------|--------|
| Create multiple agents | Full |
| Templates: receptionist, lead qualify, booking | Full |
| Templates: support, outbound follow-up, reminders, custom | Partial (subset / types only) |
| Custom name & purpose | Full |
| Inbound / outbound / both | Partial |
| Custom greeting | Partial |
| Full prompt/instructions editor | Full |
| Personality, tone, style, response length | Partial (defaults; thin UI) |
| Voice selection & preview | Partial (ID only; no preview) |
| Speaking speed | Full (synced) |
| Interruption handling | Missing |
| Silence / inactivity timeout | Missing |
| Multiple languages + auto-detect | Partial (primary language) |
| Pronunciation dictionary | Missing |
| Model selection & config | Partial |
| Business hours / after-hours behavior | Partial (routing rules) |
| Draft / test / publish / pause / duplicate / archive | Partial |
| Version history & rollback | Partial (versions listed; no rollback) |

## A2. Inbound calling

| Feature | Status |
|---------|--------|
| Assign phone number to agent | Partial (agent.phoneNumberId; voice numbers page shell) |
| AI answers immediately | **Blocked / broken runtime** — answers PSTN, does not start AI |
| Human rings first, AI if no answer | Partial (routing config; thin runtime) |
| AI after hours only | Partial |
| Overflow routing | Partial |
| Known-contact recognition | Partial |
| Personalized greeting from contact | Partial (prompt-level) |
| Intent / FAQs / collect details / qualify / take message | Partial (prompt/config; needs live AI) |
| Route by dept / language / hours / intent | Partial |
| Voicemail when appropriate | Partial |
| Emergency human fallback | Partial |

## A3. Outbound calling

| Feature | Status |
|---------|--------|
| Manual outbound AI call / test call | Partial (dials; AI not attached) |
| Call from contact profile | Partial |
| List / segment campaigns | Partial (list enroll) |
| Scheduled campaigns | Missing |
| Local-time / calling-hours enforcement | Missing |
| Concurrency / pacing | Partial |
| Daily call limits | Missing |
| Retry / max attempts | Partial |
| Stop after goal / cancel | Missing (pause only) |
| Personalized variables | Partial (stored; not rendered live) |
| Lead follow-up / reminders / reactivation / surveys / quote follow-up | Partial (templates/types) |
| Test calls before launch | Partial |

## A4. Voicemail / AMD

| Feature | Status |
|---------|--------|
| Human vs voicemail detection | Partial (outbound AMD) |
| Wait for beep / prerecorded / personalized VM | Missing |
| Hang up / SMS instead / retry | Partial |
| Outcome mark / campaign rules / prevent repeat drops | Partial |

## A5. Knowledge base

| Feature | Status |
|---------|--------|
| Upload PDF / DOCX / TXT / CSV | Missing (text + URL only) |
| Website URLs | Partial (single-page fetch) |
| Crawl website | Missing |
| Add FAQs manually | Partial (free text) |
| Services / pricing / policies structured | Partial |
| Multiple knowledge bases | Full |
| Assign KB ↔ agents (many-to-many) | Missing (schema unused) |
| Search / test knowledge | Full (in-app) |
| Processing status / failed sources | Full |
| Re-index | Partial |
| **Used during live call** | **Missing** |

## A6. Tools & actions mid-call

| Feature | Status |
|---------|--------|
| Send SMS | Partial (executor exists; not on live Telnyx call) |
| Send email | Missing |
| Update contact / tags / task | Partial / Missing |
| Trigger automation | Partial (offline executor) |
| Webhook / API request | Partial (offline executor) |
| Lookup customer / order status | Missing |
| Calendar availability / book / reschedule / cancel | Partial (book works offline; not mid-call) |
| Transfer call | Partial (Telnyx transfer exists; not tool-driven mid-call) |
| DTMF / end call / custom tools | Missing |
| Tools assigned to agents on Telnyx | Missing |

## A7. Appointment booking

| Feature | Status |
|---------|--------|
| Calendars (internal / Google / MS) | Partial (OAuth optional) |
| Services / staff / duration / buffers | Full |
| Locations / min notice / round-robin | Missing |
| Live availability / verbal slots / confirm on call | Blocked (needs live AI tools) |
| Create booking | Full |
| Reschedule / cancel | Partial |
| Duplicate prevention | Full |
| SMS/email confirmation | Missing |
| Never claim booked until calendar confirms | Partial (prompt rule; needs tool loop) |

## A8. Human transfer

| Feature | Status |
|---------|--------|
| Cold / blind transfer | Partial |
| Warm transfer | Partial (AI path SIP header summary) |
| Internal user / dept / queue / voicemail | Partial (destination string) |
| Conference / AI introduce / stay on call | Missing |
| Timeout / fallbacks / return to AI | Partial |
| Dest voicemail detect | Partial |
| Summary to human | Partial (SIP header) |

## A9. AI-to-AI transfer

| Feature | Status |
|---------|--------|
| Receptionist → sales / booking / support / language | Missing |
| Preserve context / conditions / loop avoid / markers | Missing |

## A10. Recording, transcription, intelligence

| Feature | Status |
|---------|--------|
| Auto recording / disclosure / channels | Missing / Partial |
| Playback / download | Full (when URL exists) |
| Transcription + speakers + timestamps | Partial (UI/schema; live ingest weak) |
| Search transcript | Missing |
| Summary / intent / qualify / score / sentiment / topics / objections / outcome / actions | Partial (heuristics; OpenAI upgrade) |
| Needs review flag | Full |
| Provider-independent STT | Missing |

## A11. Call history & analytics

| Feature | Status |
|---------|--------|
| Call detail (caller, agent, direction, recording, transcript, tools, cost…) | Full when data present |
| Analytics dashboards / CSV | Full (core metrics) |

## A12. Testing & reliability

| Feature | Status |
|---------|--------|
| Browser mic level test | Full |
| Real test call | Partial |
| Test knowledge / tools / booking separately | Partial |
| Live transcript / tool trace / latency-cost in lab | Missing |
| Emergency stop | Full |
| Webhook signature + idempotency | Full |

## A13. Compliance (voice)

| Feature | Status |
|---------|--------|
| DNC / suppression on dial | Partial |
| Calling hours / TZ / frequency limits | Missing |
| Recording consent | Missing |
| Audit / retention / roles | Partial |
| Emergency pause | Full |
| Intl restrictions / spend limits | Missing |

---

# PART B — Business Softphone

## B0. Specific answers

| Question | Answer |
|----------|--------|
| Mute / hold / transfer / record / merge wired? | Hold, hangup, answer, blind transfer, DTMF → Telnyx Call Control. **Mute = DB only.** Record/merge/conference/park = **Missing**. |
| Call my phone then bridge? | **Missing** |
| WebRTC needs? | `TELNYX_API_KEY` + `TELNYX_TELEPHONY_CREDENTIAL_ID` (+ connection for Call Control). Client connects but **does not `newCall`/answer media**. |
| Without number vs without telephony credential? | No Active number → outbound fails. No telephony credential → WebRTC mock; Call Control dial still possible but **no browser audio**. |

## B1. Basic calling

| Feature | Status |
|---------|--------|
| Browser dialer | Partial / Blocked media |
| Keypad + DTMF | Partial / Full (CC DTMF) |
| Contact search / recent / favorites / click-to-call | Missing |
| Inbound popup | Partial (poll) |
| Answer / decline | Partial (CC answer; no browser media) |
| Outbound caller-ID select | Full |
| Mic/speaker/headset/ring device select | Missing |
| Call timer / redial / call waiting / multi-call | Missing |
| Call my phone bridge | Missing |

## B2. In-call controls

| Feature | Status |
|---------|--------|
| Mute | Partial (UI/DB only) |
| Hold / resume | Full (CC) |
| End call | Full (CC) |
| Keypad | Partial |
| Record start/stop | Missing |
| Add / merge / conference | Missing |
| Transfer | Partial (blind E.164) |
| Park | Missing |
| Notes / contact details / change audio | Partial / Missing |

## B3–B5. Transfers / conference / parking

| Feature | Status |
|---------|--------|
| Blind transfer | Partial |
| Warm / consult / presence | Missing |
| Transfer to user/dept/queue/VM | Missing |
| Conference / merge / multi-party | Missing |
| Call parking | Missing |

## B6. Forwarding & routing

| Feature | Status |
|---------|--------|
| Number voiceForwardTo persisted | Partial (not applied in webhook) |
| Forward busy/unanswered/offline | Missing |
| Simultaneous / sequential ring | Missing (queue strategies stored only) |
| Business / after-hours / holiday | Partial (AI Voice routing) |
| AI / VM fallback | Partial |

## B7. Queues / ring groups

| Feature | Status |
|---------|--------|
| Queue CRUD + strategies stored | Full / Partial |
| **Ring runtime (actually ring agents)** | **Missing** |
| Hold music / announcements / wait estimate | Missing |
| Agent login/logout / pause / availability | Missing |
| Overflow / max wait | Partial (config; not executed) |
| Queue VM / callback / analytics | Missing |

## B8. IVR

| Feature | Status |
|---------|--------|
| Greeting + DTMF menu | Full (runtime) |
| Route forward / hangup / VM / queue note / agent note | Partial |
| Hours menus / multi-level | Missing |
| Invalid / timeout reprompt | Partial |

## B9. Voicemail (softphone)

| Feature | Status |
|---------|--------|
| Personal / shared / queue mailboxes | Missing |
| Custom greetings / upload / transcription / email | Missing |
| IVR leave-a-message record | Partial |
| Playback if recording URL present | Partial |

## B10. Recording + AI (softphone)

| Feature | Status |
|---------|--------|
| Manual/auto recording, pause, disclosure, RBAC | Missing |
| Live transcript / AI notes on HumanCall | Missing (AI Voice path only) |
| Disposition | Partial |

## B11–B16. History, presence, caller UX, CRM, mobility, admin

| Area | Status |
|------|--------|
| Call history basic + disposition | Full / Partial |
| Team phone presence | Missing |
| CNAM / whisper / screening / spam / block | Missing |
| CRM screen-pop | Missing |
| PWA/push for calls / call flip / device handoff | Missing / Partial (PWA exists, not call-aware) |
| Number assign to users / port ticket | Full |
| Extensions / E911 / phone permissions | Missing |

---

# PART C — Launch readiness

## Ready (scaffolding you already have)
- Agent CRUD, publish → Telnyx assistant create/update (instructions, model, voice, speed)
- Knowledge text/URL ingest + in-app search
- Tools CRUD + offline test executor
- Calendars/services/staff + booking API
- Softphone shell + Call Control dial/hold/hangup/blind transfer/DTMF
- Queues/IVR admin CRUD; IVR gather runtime
- Call history/analytics UIs; emergency stop; webhook idempotency

## Must fix before “number → works”
1. **Start Telnyx AI Assistant on inbound + outbound answered legs** (`ai_assistant_start`)
2. **Register tools + inject/sync knowledge on the assistant**
3. Softphone: **WebRTC dial/answer media** OR **call-my-phone bridge**
4. Softphone: **mute via Telnyx**; record start/stop
5. Queue **ring runtime** if advertising queues
6. Env: `TELNYX_*` + Active number + webhook URL + worker

## Explicitly not “just waiting for number”
Anything marked **Missing** or runtime-broken above still needs engineering after the number arrives.

---

*Canonical copy also mirrored under `docs/VOICE_SOFTPHONE_AUDIT.md` when committed.*
