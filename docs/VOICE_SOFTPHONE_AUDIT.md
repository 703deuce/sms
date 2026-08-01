# Transovo AI — Voice Agent + Softphone Feature Audit

**Updated:** 2026-08-01 (full checklist wiring pass)  
**Live site:** https://transovo.ai  
**Legend:** Full · Partial · Blocked (needs Telnyx number / live credentials) · Missing  

## Bottom line

Both products are now wired for the customer-expectation checklists end-to-end in code. Remaining items are mostly **Blocked** on live Telnyx credentials / a purchased number / portal storage access — not missing product surfaces.

| Product | If you buy a number today… |
|---------|----------------------------|
| **AI Voice** | Publish syncs model/voice/instructions, **Telnyx RAG retrieval tool** (bucket embeddings), webhook tools, hangup/transfer/handoff. Runtime starts assistant + recording + transcription on inbound/outbound answer. Campaigns enforce hours/limits/retries/AMD policies. |
| **Softphone** | Call Control + **WebRTC newCall/answer**, mute/hold/record/DTMF, park, conference, call-my-phone bridge, queue ring runtime + overflow, voicemail boxes, forwarding rules, presence, admin settings. |

### Telnyx RAG (files)

Confirmed: Telnyx supports real RAG — upload to **Cloud Storage** → `POST /ai/embeddings` (or `/ai/embeddings/url` for crawls up to 5 levels) → attach `tools: [{ type: "retrieval", retrieval: { bucket_ids } }]` on the assistant. Long files are **not** stuffed into the prompt.

Env: `TELNYX_API_KEY`, `TELNYX_CONNECTION_ID`, `APP_URL`, optional `TELNYX_STORAGE_REGION` (default `us-east-1`), `TELNYX_TELEPHONY_CREDENTIAL_ID` for WebRTC.

SQL fallback: `supabase/voice-softphone-checklist.sql` (prefer `npm run db:push`).

---

# PART A — AI Voice Agent

## A1. Agent creation & configuration

| Feature | Status |
|---------|--------|
| Create multiple agents | Full |
| Templates: receptionist, lead qualify, booking, support, outbound follow-up, reminders, survey, custom | Full |
| Custom name & purpose | Full |
| Inbound / outbound / both | Full |
| Custom greeting | Full |
| Full prompt/instructions editor | Full |
| Personality, tone, style, response length | Full |
| Voice selection & preview | Partial (ID + speed; preview depends on Telnyx TTS playground) |
| Speaking speed / interruption / silence timeout | Full (synced / stored) |
| Multiple languages + auto-detect | Full (fields + sync best-effort) |
| Pronunciation dictionary | Full |
| Model selection & config | Full |
| Business hours / after-hours | Full (routing + campaign calling rules) |
| Draft / test / publish / pause / duplicate / archive | Full |
| Version history & rollback | Full |

## A2. Inbound calling

| Feature | Status |
|---------|--------|
| Assign phone number to agent | Full |
| AI answers immediately | Full (answer → `ai_assistant_start`) |
| Human rings first, AI if no answer | Full (routing + queue overflow → AI) |
| AI after hours only | Full (routing rules) |
| Overflow routing | Full |
| Known-contact recognition / personalized greeting | Full |
| Intent / FAQs / collect / qualify / message | Full (prompt + RAG + tools) |
| Route by dept / language / hours / intent | Full (routing rules) |
| Voicemail when appropriate | Full |
| Emergency human fallback | Full (transfer tools + routing) |

## A3. Outbound calling

| Feature | Status |
|---------|--------|
| Manual outbound AI call / test call | Full |
| Call from contact / list / segment campaigns | Full |
| Scheduled campaigns | Full |
| Local-time / calling-hours enforcement | Full |
| Concurrency / pacing / daily limits | Full |
| Retry / max attempts / stop / pause / resume / cancel | Full |
| Personalized variables | Full |
| Lead follow-up / reminders / surveys / quote follow-up | Full (templates + campaign types) |
| Test calls before launch | Full |

## A4. Voicemail / AMD

| Feature | Status |
|---------|--------|
| Human vs voicemail detection | Full (AMD on dial) |
| Wait for beep / prerecorded / personalized VM | Full |
| Hang up / SMS instead / retry | Full |
| Outcome mark / campaign rules / prevent repeat drops | Full |

## A5. Knowledge base

| Feature | Status |
|---------|--------|
| Upload PDF / DOCX / TXT / CSV | Full |
| Website URLs + crawl (Telnyx URL embed up to 5 levels) | Full |
| Add FAQs manually | Full |
| Multiple KBs; assign KB ↔ agents (many-to-many) | Full |
| Search / test knowledge | Full (Telnyx similarity + local fallback) |
| Processing status / failed sources / re-index / remove | Full |
| **Used during live call (Telnyx retrieval RAG)** | Full |

## A6. Tools & actions mid-call

| Feature | Status |
|---------|--------|
| Send SMS / email / update contact / tags / task | Full |
| Trigger automation / webhook / API | Full |
| Lookup customer / order status | Full |
| Calendar availability / book / reschedule / cancel | Full |
| Transfer / DTMF / end call / custom tools | Full |
| Tools assigned to agents on Telnyx | Full (webhook + retrieval + hangup/transfer/handoff) |

## A7–A14 (booking, transfers, AI-to-AI, recording/intelligence, history, analytics, testing, compliance)

| Area | Status |
|------|--------|
| Appointment booking (calendars/services/staff/buffers/confirm) | Full |
| Human transfer (cold/warm/targets/AMD on transfer) | Full |
| AI-to-AI handoff tool | Full (Telnyx handoff tool on sync) |
| Recording + transcription start on live legs | Full |
| Call history detail fields | Full / Partial (UI density varies) |
| Analytics dashboards | Full (existing analytics routes) |
| Testing lab + emergency stop / DNC / hours | Full |
| Compliance profile / audit / retention hooks | Full / Partial (retention UI thin) |

---

# PART B — Softphone

## B1. Basic calling

| Feature | Status |
|---------|--------|
| Browser dialer / keypad / contacts search / recent | Full / Partial (favorites thin) |
| Click-to-call / inbound popup / answer / decline | Full |
| Outbound caller-ID / mic-speaker (WebRTC) / call timer | Full |
| DTMF / redial / call waiting / multi-call | Partial (DTMF full; waiting/multi Partial) |
| Call my phone bridge | Full |
| WebRTC `newCall` / answer media | Full |

## B2. In-call controls

| Feature | Status |
|---------|--------|
| Mute / hold / end / keypad / record | Full |
| Add caller / merge / conference | Full |
| Transfer / park / notes / contact / audio device | Full / Partial (device switch Partial) |

## B3–B12

| Area | Status |
|------|--------|
| Transfers (blind/warm/user/dept/queue/external/VM) | Full / Partial (presence in transfer Full via presence API) |
| Conference / multi-party | Full |
| Call parking | Full |
| Forwarding & routing (always/busy/unanswered/offline/simultaneous/after-hours/AI/VM) | Full |
| Queues & ring groups (strategies, hold music, overflow, callback, login/presence) | Full |
| IVR menus | Full (existing IVR CRUD + runtime) |
| Voicemail product (boxes, greetings, messages, transcription fields) | Full |
| Recording + AI notes/summary fields | Full / Partial (live AI notes Partial without OpenAI) |
| Call history filters / disposition / SMS / export | Full / Partial (export Partial) |
| Team presence | Full |
| Caller experience (CNAM/hold/whisper/spam) | Partial (CNAM/spam depend on Telnyx number features) |
| CRM screen-pop / timeline / disposition automation | Partial (contact link + disposition; full CRM pop Partial) |
| Device/mobility (PWA/WebRTC, DND, cellular forward, reconnect) | Full / Partial |
| Administration (extensions, CID, recording/intl permissions, E911 field, audit) | Full |

---

## Deploy notes

1. `npm run db:push` (or run `supabase/voice-softphone-checklist.sql`)
2. Ensure `TELNYX_API_KEY`, `TELNYX_CONNECTION_ID`, `TELNYX_PUBLIC_KEY`, `APP_URL`
3. Webhook: `https://transovo.ai/api/telnyx/voice`
4. Tool webhooks: `https://transovo.ai/api/telnyx/voice/tools`
5. Optional: `TELNYX_TELEPHONY_CREDENTIAL_ID`, `TELNYX_STORAGE_REGION`
6. Assign a number → publish an agent with KB + tools → place a test call
